import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const cadastroSchema = z.object({
  tenantSlug: z.string().min(1),
  nome: z.string().min(1, "Informe o nome completo"),
  email: z.string().email("E-mail invalido"),
  telefone: z.string().min(8, "Telefone invalido"),
  senha: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
});

// UC01 — cliente cria conta informando nome completo, e-mail, telefone e
// senha. Necessario para acessar os servicos e realizar agendamentos (RN02).
export async function POST(request: Request) {
  const body = await request.json();
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

  const existente = await prisma.usuario.findUnique({
    where: { tenantId_email: { tenantId: tenant.id, email } },
  });
  if (existente) {
    return NextResponse.json(
      { error: "Ja existe uma conta com esse e-mail nesta estetica" },
      { status: 409 }
    );
  }

  const senhaHash = await bcrypt.hash(senha, 10);
  await prisma.usuario.create({
    data: {
      tenantId: tenant.id,
      nome,
      email,
      telefone,
      senhaHash,
      role: "CLIENTE",
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
