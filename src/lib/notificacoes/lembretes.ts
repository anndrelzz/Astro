import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant-db";
import { enviarNotificacoes, registrarNotificacao, type NotificacaoPendente } from "./index";

const HORA_EM_MS = 1000 * 60 * 60;

// RF09, RN08, Gatilhos 2 e 3 (secao 3.4) — lembretes de 24h e 2h antes,
// disparados apenas se o agendamento foi feito com antecedencia suficiente
// para cada intervalo, e apenas uma vez por tipo. Roda tenant por tenant
// (RLS exige o contexto de app.tenant_id setado para ler agendamento).
export async function verificarEEnviarLembretes(agora = new Date()) {
  let lembretes24h = 0;
  let lembretes2h = 0;
  let verificados = 0;

  // Tenant nao tem RLS — enumerar aqui e seguro (nao expoe dados sensiveis
  // de outros tenants, so a lista de tenants existentes).
  const tenants = await prisma.tenant.findMany({ select: { id: true } });

  for (const tenant of tenants) {
    const r = await verificarLembretesDoTenant(tenant.id, agora);
    lembretes24h += r.lembretes24h;
    lembretes2h += r.lembretes2h;
    verificados += r.verificados;
  }

  return { lembretes24h, lembretes2h, verificados };
}

// Primeiro registra, numa transacao curta e so de banco, todos os lembretes
// devidos; depois envia um por um, fora dela. O registro e o que impede o
// lembrete repetido: como ele ja esta salvo antes do envio, um e-mail lento ou
// um erro do Telegram nao o desfaz, e a proxima rodada nao cria outro. Um
// envio que falha fica como FALHA e e tentado de novo pelo reenvio do cron
// (reenviarNotificacoes), ate MAX_TENTATIVAS.
export async function verificarLembretesDoTenant(tenantId: string, agora = new Date()) {
  let lembretes24h = 0;
  let lembretes2h = 0;

  const { pendentes, verificados } = await withTenant(tenantId, async (tx) => {
    const agendamentosAtivos = await tx.agendamento.findMany({
      where: {
        tenantId,
        status: { in: ["PENDENTE_PAGAMENTO", "PIX_PENDENTE", "CONFIRMADO"] },
        dataHora: { gt: agora },
      },
      include: { notificacoes: true },
    });

    const pendentes: NotificacaoPendente[] = [];

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
        pendentes.push(...(await registrarNotificacao(tx, agendamento.id, "LEMBRETE_24H")));
        lembretes24h++;
      }

      if (
        horasAte <= 2 &&
        horasAte > 0 &&
        horasDeAntecedenciaNaCriacao >= 2 &&
        !jaTem2h
      ) {
        pendentes.push(...(await registrarNotificacao(tx, agendamento.id, "LEMBRETE_2H")));
        lembretes2h++;
      }
    }

    return { pendentes, verificados: agendamentosAtivos.length };
  });

  await enviarNotificacoes(pendentes);

  return { lembretes24h, lembretes2h, verificados };
}
