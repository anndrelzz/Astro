import type { TipoNotificacao } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
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
  const dataFormatada = dataHora.toLocaleString("pt-BR");
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
export async function dispararNotificacao(
  agendamentoId: string,
  tipo: TipoNotificacao
) {
  const agendamento = await prisma.agendamento.findUnique({
    where: { id: agendamentoId },
    include: { usuario: true, servico: true },
  });
  if (!agendamento) return;

  const notificacao = await prisma.notificacao.create({
    data: { agendamentoId, tipo, status: "PENDENTE" },
  });

  const texto = montarMensagem(tipo, agendamento.servico.nome, agendamento.dataHora);
  const assunto = ASSUNTOS[tipo];

  const resultadoEmail = await enviarEmail(agendamento.usuario.email, assunto, texto);

  if (agendamento.usuario.telegramChatId) {
    await enviarTelegram(agendamento.usuario.telegramChatId, texto);
  }

  await prisma.notificacao.update({
    where: { id: notificacao.id },
    data: {
      status: resultadoEmail.enviado ? "ENVIADA" : "FALHA",
      enviadoEm: resultadoEmail.enviado ? new Date() : null,
      tentativas: { increment: 1 },
    },
  });
}
