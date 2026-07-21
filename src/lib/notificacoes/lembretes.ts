import { prisma } from "@/lib/prisma";
import { dispararNotificacao } from "./index";

const HORA_EM_MS = 1000 * 60 * 60;

// RF09, RN08, Gatilhos 2 e 3 (secao 3.4) — lembretes de 24h e 2h antes,
// disparados apenas se o agendamento foi feito com antecedencia suficiente
// para cada intervalo, e apenas uma vez por tipo.
export async function verificarEEnviarLembretes() {
  const agora = new Date();

  const agendamentosAtivos = await prisma.agendamento.findMany({
    where: {
      status: { in: ["PENDENTE_PAGAMENTO", "PIX_PENDENTE", "CONFIRMADO"] },
      dataHora: { gt: agora },
    },
    include: { notificacoes: true },
  });

  let lembretes24h = 0;
  let lembretes2h = 0;

  for (const agendamento of agendamentosAtivos) {
    const horasAte = (agendamento.dataHora.getTime() - agora.getTime()) / HORA_EM_MS;
    const horasDeAntecedenciaNaCriacao =
      (agendamento.dataHora.getTime() - agendamento.criadoEm.getTime()) / HORA_EM_MS;

    const jaTem24h = agendamento.notificacoes.some((n) => n.tipo === "LEMBRETE_24H");
    const jaTem2h = agendamento.notificacoes.some((n) => n.tipo === "LEMBRETE_2H");

    if (
      horasAte <= 24 &&
      horasAte > 2 &&
      horasDeAntecedenciaNaCriacao >= 24 &&
      !jaTem24h
    ) {
      await dispararNotificacao(agendamento.id, "LEMBRETE_24H");
      lembretes24h++;
    }

    if (horasAte <= 2 && horasAte > 0 && horasDeAntecedenciaNaCriacao >= 2 && !jaTem2h) {
      await dispararNotificacao(agendamento.id, "LEMBRETE_2H");
      lembretes2h++;
    }
  }

  return { lembretes24h, lembretes2h, verificados: agendamentosAtivos.length };
}
