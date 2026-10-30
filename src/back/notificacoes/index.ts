import "server-only";
import type { CanalNotificacao, TipoNotificacao } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { FUSO } from "@/compartilhado/fuso";
import { prisma } from "@/back/prisma";
import { withTenant } from "@/back/tenant-db";
import { enviarEmail } from "@/back/notificacoes/email";
import { enviarTelegram } from "@/back/notificacoes/telegram";

const ASSUNTOS: Record<TipoNotificacao, string> = {
  CONFIRMACAO_AGENDAMENTO: "Agendamento confirmado",
  LEMBRETE_24H: "Lembrete: seu agendamento e amanha",
  LEMBRETE_2H: "Lembrete: seu agendamento e em 2 horas",
  CONFIRMACAO_CANCELAMENTO: "Agendamento cancelado",
};

// Quantas vezes um aviso que falhou e tentado, contando a primeira.
export const MAX_TENTATIVAS = 3;

// Pendente ha mais tempo que isso nao esta mais "a caminho": o servidor caiu
// entre o commit e o envio, e o after() que mandaria o aviso nunca rodou.
export const PENDENTE_ESQUECIDA_MS = 5 * 60 * 1000;

function montarMensagem(
  tipo: TipoNotificacao,
  servicoNome: string,
  dataHora: Date
) {
  // Sem timeZone, o texto sairia no fuso do servidor (UTC na nuvem): o cliente
  // agendado para 10:00 leria 13:00 no e-mail.
  const dataFormatada = dataHora.toLocaleString("pt-BR", {
    timeZone: FUSO,
    dateStyle: "short",
    timeStyle: "short",
  });
  switch (tipo) {
    case "CONFIRMACAO_AGENDAMENTO":
      return `Seu agendamento de ${servicoNome} foi confirmado para ${dataFormatada}.`;
    case "LEMBRETE_24H":
      return `Lembrete: voce tem ${servicoNome} agendado para amanha, ${dataFormatada}.`;
    case "LEMBRETE_2H":
      return `Lembrete: voce tem ${servicoNome} agendado em 2 horas, as ${dataFormatada}.`;
    case "CONFIRMACAO_CANCELAMENTO":
      return `Seu agendamento de ${servicoNome} em ${dataFormatada} foi cancelado.`;
  }
}

// Fluxo de Notificacoes (secao 3.4 do RFC) — fila com registro de tentativas e
// reenvio. E-mail sempre (RN13); Telegram apenas se vinculado.
//
// Em dois passos, porque o envio NAO pode acontecer dentro da transacao que
// grava o agendamento. La dentro, um Telegram fora do ar desfazia o
// agendamento depois de o e-mail ja ter saido, e um envio lento estourava o
// limite de 5 s da transacao. No cron, o rollback apagava o registro de
// "lembrete ja enviado" e a rodada seguinte mandava tudo de novo.
//
//   1. registrarNotificacao — dentro da transacao do chamador (withTenant),
//      grava uma linha PENDENTE por canal. Vai junto com o commit, ou com o
//      rollback.
//   2. enviarNotificacoes — DEPOIS do commit, fora de qualquer transacao,
//      envia cada canal e grava ENVIADA ou FALHA. Nunca lanca erro.
//
// O que nao sai na hora e reenviado pelo cron (reenviarNotificacoes): pendente
// esquecida (o servidor caiu antes do passo 2) e falha com menos de
// MAX_TENTATIVAS.

export type NotificacaoPendente = { tenantId: string; notificacaoId: string };

export async function registrarNotificacao(
  tx: Prisma.TransactionClient,
  agendamentoId: string,
  tipo: TipoNotificacao
): Promise<NotificacaoPendente[]> {
  const agendamento = await tx.agendamento.findUnique({
    where: { id: agendamentoId },
    select: { tenantId: true, usuario: { select: { telegramChatId: true } } },
  });
  if (!agendamento) return [];

  const canais: CanalNotificacao[] = agendamento.usuario.telegramChatId
    ? ["EMAIL", "TELEGRAM"]
    : ["EMAIL"];

  const pendentes: NotificacaoPendente[] = [];
  for (const canal of canais) {
    const notificacao = await tx.notificacao.create({
      data: { tenantId: agendamento.tenantId, agendamentoId, tipo, canal, status: "PENDENTE" },
    });
    pendentes.push({ tenantId: agendamento.tenantId, notificacaoId: notificacao.id });
  }
  return pendentes;
}

export async function enviarNotificacoes(pendentes: NotificacaoPendente[]) {
  for (const pendente of pendentes) await enviarNotificacao(pendente);
}

async function enviarNotificacao({ tenantId, notificacaoId }: NotificacaoPendente) {
  try {
    const notificacao = await withTenant(tenantId, (tx) =>
      tx.notificacao.findUnique({
        where: { id: notificacaoId },
        include: { agendamento: { include: { usuario: true, servico: true } } },
      })
    );
    if (!notificacao) return;

    const { usuario, servico, dataHora } = notificacao.agendamento;
    const texto = montarMensagem(notificacao.tipo, servico.nome, dataHora);

    let enviado = false;
    try {
      if (notificacao.canal === "EMAIL") {
        enviado = (await enviarEmail(usuario.email, ASSUNTOS[notificacao.tipo], texto)).enviado;
      } else if (usuario.telegramChatId) {
        // Se o cliente desvinculou o Telegram depois do registro, nao ha para
        // onde mandar: fica FALHA, e o reenvio tambem nao acha o chat.
        enviado = (await enviarTelegram(usuario.telegramChatId, texto)).enviado;
      }
    } catch (erro) {
      console.error(`[${notificacao.canal.toLowerCase()}:ERRO]`, erro);
    }

    await withTenant(tenantId, (tx) =>
      tx.notificacao.update({
        where: { id: notificacaoId },
        data: {
          status: enviado ? "ENVIADA" : "FALHA",
          enviadoEm: enviado ? new Date() : null,
          tentativas: { increment: 1 },
        },
      })
    );
  } catch (erro) {
    // O agendamento ja esta salvo; uma falha aqui so deixa o aviso PENDENTE,
    // e o reenvio do cron o pega depois.
    console.error("[notificacao:ERRO]", notificacaoId, erro);
  }
}

// Chamado pelo cron. Tenta de novo, estetica por estetica, o que nao saiu:
//   - PENDENTE ha mais de PENDENTE_ESQUECIDA_MS (o servidor caiu antes do envio);
//   - FALHA com menos de MAX_TENTATIVAS.
// So reenvia o que ainda faz sentido: confirmacao de agendamento que nao foi
// cancelado, e lembrete de horario que nao passou nem foi cancelado. O aviso
// de cancelamento vale sempre.
export async function reenviarNotificacoes(agora = new Date()) {
  // Tenant nao tem RLS: enumerar aqui so expoe a lista de esteticas.
  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  let reenviadas = 0;
  for (const { id } of tenants) {
    reenviadas += (await reenviarNotificacoesDoTenant(id, agora)).reenviadas;
  }
  return { reenviadas };
}

export async function reenviarNotificacoesDoTenant(tenantId: string, agora = new Date()) {
  const esquecidaAntesDe = new Date(agora.getTime() - PENDENTE_ESQUECIDA_MS);
  const aReenviar = await withTenant(tenantId, (tx) =>
    tx.notificacao.findMany({
      where: {
        tenantId,
        AND: [
          {
            OR: [
              { status: "PENDENTE", criadoEm: { lt: esquecidaAntesDe } },
              { status: "FALHA", tentativas: { lt: MAX_TENTATIVAS } },
            ],
          },
          {
            OR: [
              { tipo: "CONFIRMACAO_CANCELAMENTO" },
              {
                tipo: "CONFIRMACAO_AGENDAMENTO",
                agendamento: { status: { not: "CANCELADO" } },
              },
              {
                tipo: { in: ["LEMBRETE_24H", "LEMBRETE_2H"] },
                agendamento: { status: { not: "CANCELADO" }, dataHora: { gt: agora } },
              },
            ],
          },
        ],
      },
      select: { id: true },
      orderBy: { criadoEm: "asc" },
    })
  );

  await enviarNotificacoes(aReenviar.map((n) => ({ tenantId, notificacaoId: n.id })));
  return { reenviadas: aReenviar.length };
}
