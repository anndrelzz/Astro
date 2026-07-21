import type { Servico, Tenant } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// RF02, RN06, RNF02 — calcula os slots de horario disponiveis para um dia,
// respeitando a grade de funcionamento, o intervalo configurado e a
// capacidade simultanea do tenant.
export async function calcularSlotsDisponiveis(
  tenant: Tenant,
  servico: Servico,
  data: Date
) {
  const diaSemana = data.getDay();

  const horario = await prisma.horarioFuncionamento.findUnique({
    where: { tenantId_diaSemana: { tenantId: tenant.id, diaSemana } },
  });
  if (!horario) return [];

  const inicioDia = new Date(data);
  inicioDia.setHours(0, 0, 0, 0);
  const fimDia = new Date(data);
  fimDia.setHours(23, 59, 59, 999);

  const agendamentosDoDia = await prisma.agendamento.findMany({
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
      const aInicio =
        agendamento.dataHora.getHours() * 60 + agendamento.dataHora.getMinutes();
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
