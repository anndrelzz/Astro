import type { TipoNotificacao } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { FUSO } from "@/lib/fuso";
import { withTenant } from "@/lib/tenant-db";
import { enviarEmail } from "./email";
import { enviarTelegram } from "./telegram";

const ASSUNTOS: Record<TipoNotificacao, string> = {
  CONFIRMACAO_AGENDAMENTO: "Agendamento confirmado",
  LEMBRETE_24H: "Lembrete: seu agendamento e amanha",
  LEMBRETE_2H: "Lembrete: seu agendamento e em 2 horas",
  CONFIRMACAO_CANCELAMENTO: "Agendamento cancelado",
};

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

// Fluxo de Notificacoes (secao 3.4 do RFC) — fila simples com registro de
// tentativas. E-mail sempre disparado (RN13); Telegram apenas se vinculado.
//
// Em dois passos, porque o envio NAO pode acontecer dentro da transacao que
// grava o agendamento. La dentro, um Telegram fora do ar desfazia o
// agendamento depois de o e-mail ja ter saido, e um envio lento estourava o
// limite de 5 s da transacao. No cron, o rollback apagava o registro de
// "lembrete ja enviado" e a rodada seguinte mandava tudo de novo.
//
//   1. registrarNotificacao — dentro da transacao do chamador (withTenant),
//      grava o aviso como PENDENTE. Vai junto com o commit, ou com o rollback.
//   2. enviarNotificacao — DEPOIS do commit, fora de qualquer transacao,
//      envia e grava ENVIADA ou FALHA. Nunca lanca erro.

export type NotificacaoPendente = { tenantId: string; notificacaoId: string };

export async function registrarNotificacao(
  tx: Prisma.TransactionClient,
  agendamentoId: string,
  tipo: TipoNotificacao
): Promise<NotificacaoPendente | null> {
  const agendamento = await tx.agendamento.findUnique({
    where: { id: agendamentoId },
    select: { tenantId: true },
  });
  if (!agendamento) return null;

  const notificacao = await tx.notificacao.create({
    data: { tenantId: agendamento.tenantId, agendamentoId, tipo, status: "PENDENTE" },
  });
  return { tenantId: agendamento.tenantId, notificacaoId: notificacao.id };
}

export async function enviarNotificacao(pendente: NotificacaoPendente | null) {
  if (!pendente) return;
  const { tenantId, notificacaoId } = pendente;

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

    let emailEnviado = false;
    try {
      const resultado = await enviarEmail(usuario.email, ASSUNTOS[notificacao.tipo], texto);
      emailEnviado = resultado.enviado;
    } catch (erro) {
      console.error("[email:ERRO]", erro);
    }

    if (usuario.telegramChatId) {
      try {
        await enviarTelegram(usuario.telegramChatId, texto);
      } catch (erro) {
        console.error("[telegram:ERRO]", erro);
      }
    }

    await withTenant(tenantId, (tx) =>
      tx.notificacao.update({
        where: { id: notificacaoId },
        data: {
          status: emailEnviado ? "ENVIADA" : "FALHA",
          enviadoEm: emailEnviado ? new Date() : null,
          tentativas: { increment: 1 },
        },
      })
    );
  } catch (erro) {
    // O agendamento ja esta salvo; uma falha aqui so deixa o aviso PENDENTE.
    console.error("[notificacao:ERRO]", notificacaoId, erro);
  }
}
