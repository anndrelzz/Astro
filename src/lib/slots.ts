import type { Prisma, Servico, Tenant } from "@/generated/prisma/client";
import { fimDoDia, inicioDoDia, minutosNoFuso, partesNoFuso } from "@/lib/fuso";

// RF02, RN06, RNF02 — calcula os slots de horario disponiveis para um dia,
// respeitando a grade de funcionamento, o intervalo configurado e a
// capacidade simultanea do tenant. Recebe o client de transacao ja
// contextualizado por withTenant (RLS) — nunca importa o `prisma` global.
//
// `data` e qualquer instante do dia consultado. Dia da semana, limites do dia
// e horario de cada agendamento sao lidos no fuso da estetica (lib/fuso.ts),
// nao no fuso do servidor.
export async function calcularSlotsDisponiveis(
  tx: Prisma.TransactionClient,
  tenant: Tenant,
  servico: Servico,
  data: Date
) {
  const { diaSemana } = partesNoFuso(data);

  const horario = await tx.horarioFuncionamento.findUnique({
    where: { tenantId_diaSemana: { tenantId: tenant.id, diaSemana } },
  });
  if (!horario) return [];

  const inicioDia = inicioDoDia(data);
  const fimDia = fimDoDia(data);

  const agendamentosDoDia = await tx.agendamento.findMany({
    where: {
      tenantId: tenant.id,
      dataHora: { gte: inicioDia, lte: fimDia },
      status: { not: "CANCELADO" },
    },
    include: { servico: true },
  });

  const slots: string[] = [];

  for (
    let inicioMin = horario.horaInicioMin;
    inicioMin + servico.duracaoMin <= horario.horaFimMin;
    inicioMin += tenant.intervaloMinutos
  ) {
    const fimMin = inicioMin + servico.duracaoMin;

    const ocupados = agendamentosDoDia.filter((agendamento) => {
      const aInicio = minutosNoFuso(agendamento.dataHora);
      const aFim = aInicio + agendamento.servico.duracaoMin;
      return aInicio < fimMin && aFim > inicioMin; // sobreposicao de intervalos
    }).length;

    if (ocupados < tenant.capacidadeSimultanea) {
      const horas = String(Math.floor(inicioMin / 60)).padStart(2, "0");
      const minutos = String(inicioMin % 60).padStart(2, "0");
      slots.push(`${horas}:${minutos}`);
    }
  }

  return slots;
}
