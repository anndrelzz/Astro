import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { lerJson } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant-db";

const cadastroSchema = z.object({
  tenantSlug: z.string().min(1),
  nome: z.string().min(1, "Informe o nome completo"),
  email: z
    .string()
    .email("E-mail invalido")
    .transform((v) => v.toLowerCase()),
  telefone: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 10 || v.length === 11, {
      message: "Telefone invalido - informe DDD + numero (10 ou 11 digitos)",
    }),
  // As tres regras aparecem no medidor de forca da tela 03. Servidor e tela
  // precisam exigir exatamente o mesmo: prometer "1 maiuscula" e aceitar uma
  // senha sem maiuscula transforma o medidor em enfeite.
  senha: z
    .string()
    .min(8, "Senha deve ter ao menos 8 caracteres")
    .refine((s) => /\d/.test(s), "Senha deve conter ao menos 1 numero")
    .refine((s) => /[A-Z]/.test(s), "Senha deve conter ao menos 1 letra maiuscula"),
});

// UC01 — cliente cria conta informando nome completo, e-mail, telefone e
// senha. Necessario para acessar os servicos e realizar agendamentos (RN02).
export async function POST(request: Request) {
  const body = await lerJson(request);
  if (body === null) {
    return NextResponse.json({ error: "Corpo invalido" }, { status: 400 });
  }
  const parsed = cadastroSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados invalidos" },
      { status: 400 }
    );
  }
  const { tenantSlug, nome, email, telefone, senha } = parsed.data;

  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) {
    return NextResponse.json({ error: "Estetica nao encontrada" }, { status: 404 });
  }

  const senhaHash = await bcrypt.hash(senha, 10);

  const resultado = await withTenant(tenant.id, async (tx) => {
    const existente = await tx.usuario.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email } },
    });
    if (existente) {
      return { error: "Ja existe uma conta com esse e-mail nesta estetica" } as const;
    }

    await tx.usuario.create({
      data: {
        tenantId: tenant.id,
        nome,
        email,
        telefone,
        senhaHash,
        role: "CLIENTE",
      },
    });
    return { ok: true } as const;
  });

  if ("error" in resultado) {
    return NextResponse.json({ error: resultado.error }, { status: 409 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
