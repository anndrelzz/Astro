import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { enviarEmail } from "@/back/notificacoes/email";
import { montarEmailConfirmacao } from "@/back/notificacoes/modelo-email";
import { gerarTokenEmail } from "@/back/token-email";
import { DOMINIO } from "@/compartilhado/dominio";

// Confirmacao do e-mail (decisoes de 29/10 e 04/11). E-mail digitado errado
// mandaria os dados do agendamento para um estranho (LGPD): por isso os avisos
// por e-mail so saem depois que o cliente prova que abre a caixa. O link vale
// 7 dias e uma vez so; o Perfil reenvia, no maximo 3 por hora (contando o do
// cadastro).

const VALIDADE_DIAS = 7;
export const MAX_LINKS_POR_HORA = 3;

// O papel decide o texto: o cliente confirma para receber a confirmacao e os
// lembretes dos agendamentos dele; o dono (ADMIN), os avisos de novos
// agendamentos e cancelamentos da estetica.
type Conta = { id: string; tenantId: string; email: string; nome: string; role?: "ADMIN" | "CLIENTE" };
type Estetica = { nome: string; slug: string; logoUrl: string | null };

// Cria o link dentro da transacao de quem chama. Devolve null quando a conta
// ja pediu links demais na ultima hora.
export async function criarLinkDeConfirmacao(tx: Prisma.TransactionClient, conta: Conta, slug: string) {
  const agora = new Date();
  const naUltimaHora = await tx.tokenEmail.count({
    where: {
      usuarioId: conta.id,
      tipo: "CONFIRMAR_EMAIL",
      criadoEm: { gt: new Date(agora.getTime() - 60 * 60 * 1000) },
    },
  });
  if (naUltimaHora >= MAX_LINKS_POR_HORA) return null;

  const { token, tokenHash } = gerarTokenEmail();
  await tx.tokenEmail.create({
    data: {
      tenantId: conta.tenantId,
      usuarioId: conta.id,
      tipo: "CONFIRMAR_EMAIL",
      tokenHash,
      criadoEm: agora,
      expiraEm: new Date(agora.getTime() + VALIDADE_DIAS * 24 * 60 * 60 * 1000),
    },
  });
  return `https://${DOMINIO}/api/auth/confirmar-email?slug=${encodeURIComponent(slug)}&token=${token}`;
}

// Envia depois do commit, fora da transacao: o e-mail nao segura o banco.
export function enviarLinkDeConfirmacao(conta: Conta, estetica: Estetica, link: string) {
  const dono = conta.role === "ADMIN";
  const pedido = dono
    ? `A ${estetica.nome} esta pronta no Astro. Confirme que este e-mail e seu para receber aqui os avisos de novos agendamentos e cancelamentos`
    : `Sua conta na ${estetica.nome} esta pronta. Confirme que este e-mail e seu para receber a confirmacao e os lembretes dos seus agendamentos`;
  return enviarEmail(
    conta.email,
    "Confirme seu e-mail",
    `${pedido}: ${link}\n\nO link vale por 7 dias. Se nao foi voce que criou a conta, ignore este e-mail.`,
    montarEmailConfirmacao({ clienteNome: conta.nome, estetica, link, dono })
  );
}
