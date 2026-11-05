import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { lerJson, respostaDadosInvalidos } from "@/back/api-helpers";
import { prisma } from "@/back/prisma";
import { withTenant } from "@/back/tenant-db";
import { hashDoToken } from "@/back/token-email";
import { senhaSchema } from "@/compartilhado/validacoes/senha";

// RFC 6.2 — a senha nova, pelo link do e-mail (ver esqueci-senha). O link
// vale 1 hora e uma vez so; usar um link fecha tambem os outros que ainda
// estavam abertos. Como so quem abre a caixa recebe o link, usa-lo confirma o
// e-mail (decisao de 04/11).

const redefinicaoSchema = z.object({
  tenantSlug: z.string().min(1),
  token: z.string().min(1),
  senha: senhaSchema,
});

const LINK_INVALIDO = { error: "Este link expirou ou já foi usado. Peça um novo." };

export async function POST(request: Request) {
  const body = await lerJson(request);
  if (body === null) {
    return NextResponse.json({ error: "Corpo invalido" }, { status: 400 });
  }
  const parsed = redefinicaoSchema.safeParse(body);
  if (!parsed.success) {
    return respostaDadosInvalidos(parsed.error);
  }
  const { tenantSlug, token, senha } = parsed.data;

  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true } });
  if (!tenant) {
    return NextResponse.json(LINK_INVALIDO, { status: 400 });
  }

  const agora = new Date();
  // O hash da senha fica fora da transacao: o bcrypt leva uns 100 ms, e a
  // transacao do Prisma tem limite de 5 s.
  const senhaHash = await bcrypt.hash(senha, 10);

  const email = await withTenant(tenant.id, async (tx) => {
    // O RLS ja esconde o token de outra estetica; o tenantId repete a regra.
    const pedido = await tx.tokenEmail.findUnique({
      where: { tokenHash: hashDoToken(token) },
      include: { usuario: true },
    });
    if (
      !pedido ||
      pedido.tenantId !== tenant.id ||
      pedido.tipo !== "REDEFINIR_SENHA" ||
      pedido.usadoEm !== null ||
      pedido.expiraEm <= agora
    ) {
      return null;
    }

    await tx.usuario.update({
      where: { id: pedido.usuarioId },
      data: {
        senhaHash,
        emailConfirmadoEm: pedido.usuario.emailConfirmadoEm ?? agora,
        // Issue #107: quem ficou bloqueado por errar a senha sai por aqui.
        tentativasErradas: 0,
        bloqueadoAte: null,
      },
    });
    await tx.tokenEmail.updateMany({
      where: { usuarioId: pedido.usuarioId, tipo: "REDEFINIR_SENHA", usadoEm: null },
      data: { usadoEm: agora },
    });
    return pedido.usuario.email;
  });

  if (!email) {
    return NextResponse.json(LINK_INVALIDO, { status: 400 });
  }
  return NextResponse.json({ email });
}
