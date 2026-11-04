import { NextResponse } from "next/server";
import { z } from "zod";
import { lerJson, respostaDadosInvalidos } from "@/back/api-helpers";
import { enviarEmail } from "@/back/notificacoes/email";
import { montarEmailRedefinicao } from "@/back/notificacoes/modelo-email";
import { prisma } from "@/back/prisma";
import { withTenant } from "@/back/tenant-db";
import { gerarTokenEmail } from "@/back/token-email";
import { DOMINIO } from "@/compartilhado/dominio";
import { LIMITES } from "@/compartilhado/validacoes/limites";

// RFC 6.2 — "esqueci minha senha", com as regras combinadas em 04/11:
// - a resposta e sempre a mesma, tenha conta ou nao: a tela nao pode servir
//   para descobrir quem e cliente da estetica;
// - o link vale 1 hora e uma vez so (ver redefinir-senha);
// - no maximo 3 pedidos por hora para a mesma conta, para ninguem usar a tela
//   para encher a caixa de alguem;
// - funciona mesmo com o e-mail ainda nao confirmado: so quem abre a caixa
//   recebe o link, e usar o link confirma o e-mail.
// O coringa (agendamento pelo Admin) nao recupera senha: ninguem entra com ele.

const VALIDADE_DO_LINK_MIN = 60;
const MAX_PEDIDOS_POR_HORA = 3;

const pedidoSchema = z.object({
  tenantSlug: z.string().min(1),
  email: z
    .string()
    .trim()
    .email("E-mail invalido")
    .max(LIMITES.email, "E-mail muito longo")
    .transform((v) => v.toLowerCase()),
});

const RESPOSTA = { ok: true } as const;

export async function POST(request: Request) {
  const body = await lerJson(request);
  if (body === null) {
    return NextResponse.json({ error: "Corpo invalido" }, { status: 400 });
  }
  const parsed = pedidoSchema.safeParse(body);
  if (!parsed.success) {
    return respostaDadosInvalidos(parsed.error);
  }
  const { tenantSlug, email } = parsed.data;

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, nome: true, slug: true, logoUrl: true },
  });
  if (!tenant) {
    return NextResponse.json(RESPOSTA);
  }

  const agora = new Date();
  const pedido = await withTenant(tenant.id, async (tx) => {
    const usuario = await tx.usuario.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email } },
    });
    if (!usuario || usuario.coringa) return null;

    const pedidosNaUltimaHora = await tx.tokenEmail.count({
      where: {
        usuarioId: usuario.id,
        tipo: "REDEFINIR_SENHA",
        criadoEm: { gt: new Date(agora.getTime() - 60 * 60 * 1000) },
      },
    });
    if (pedidosNaUltimaHora >= MAX_PEDIDOS_POR_HORA) return null;

    const { token, tokenHash } = gerarTokenEmail();
    await tx.tokenEmail.create({
      data: {
        tenantId: tenant.id,
        usuarioId: usuario.id,
        tipo: "REDEFINIR_SENHA",
        tokenHash,
        criadoEm: agora,
        expiraEm: new Date(agora.getTime() + VALIDADE_DO_LINK_MIN * 60 * 1000),
      },
    });
    return { usuario, token };
  });

  if (pedido) {
    const link = `https://${DOMINIO}/${tenant.slug}/redefinir-senha?token=${pedido.token}`;
    await enviarEmail(
      pedido.usuario.email,
      "Redefinir sua senha",
      `Recebemos um pedido para criar uma senha nova na sua conta da ${tenant.nome}. ` +
        `Use este link, que vale por 1 hora e funciona uma vez so: ${link}\n\n` +
        "Se nao foi voce que pediu, ignore este e-mail: sua senha continua a mesma.",
      montarEmailRedefinicao({ clienteNome: pedido.usuario.nome, estetica: tenant, link })
    );
  }

  return NextResponse.json(RESPOSTA);
}
