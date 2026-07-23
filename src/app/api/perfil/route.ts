import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { lerJson } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

// Tela 05 (Editar perfil) — o cliente atualiza os proprios dados de contato.
// E-mail nao e alterado aqui: e a credencial de login (unique por tenant) e
// trocá-lo invalidaria a sessao ativa; por isso o modal o mantem somente leitura.
const perfilSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome completo"),
  telefone: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 10 || v.length === 11, {
      message: "Telefone invalido - informe DDD + numero (10 ou 11 digitos)",
    }),
});

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  const body = await lerJson(request);
  if (body === null) {
    return NextResponse.json({ error: "Corpo invalido" }, { status: 400 });
  }
  const parsed = perfilSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados invalidos" },
      { status: 400 }
    );
  }

  await prisma.usuario.update({
    where: { id: session.user.id },
    data: { nome: parsed.data.nome, telefone: parsed.data.telefone },
  });

  return NextResponse.json({ ok: true });
}
