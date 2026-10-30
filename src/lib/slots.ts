import type { Prisma, Servico, Tenant } from "@/generated/prisma/client";
import { fimDoDia, inicioDoDia, minutosNoFuso, partesNoFuso } from "@/lib/fuso";

// Quanto tempo antes do inicio um horario ainda pode ser reservado: da tempo
// de o cliente chegar e de a estetica se preparar.
export const ANTECEDENCIA_MINIMA_MIN = 30;

// RF02, RN06, RNF02 — calcula os slots de horario disponiveis para um dia,
// respeitando a grade de funcionamento, o intervalo configurado e a
// capacidade simultanea do tenant. Recebe o client de transacao ja
// contextualizado por withTenant (RLS) — nunca importa o `prisma` global.
//
// `data` e qualquer instante do dia consultado. Dia da semana, limites do dia
// e horario de cada agendamento sao lidos no fuso da estetica (lib/fuso.ts),
// nao no fuso do servidor.
//
// Horario que ja passou, ou que comeca em menos de ANTECEDENCIA_MINIMA_MIN, nao
// entra na lista. Como a confirmacao (POST /api/agendamentos) reconfere a vaga
// por esta mesma funcao, ela tambem recusa esses horarios. `agora` so existe
// para os testes fixarem o relogio.
export async function calcularSlotsDisponiveis(
  tx: Prisma.TransactionClient,
  tenant: Tenant,
  servico: Servico,
  data: Date,
  agora: Date = new Date()
) {
  const { diaSemana } = partesNoFuso(data);

  const horario = await tx.horarioFuncionamento.findUnique({
    where: { tenantId_diaSemana: { tenantId: tenant.id, diaSemana } },
  });
  if (!horario) return [];

  const inicioDia = inicioDoDia(data);
  const fimDia = fimDoDia(data);
  const primeiroInicioPermitido =
    agora.getTime() + ANTECEDENCIA_MINIMA_MIN * 60_000;

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

    // Brasilia nao tem horario de verao desde 2019: o dia tem sempre 24h e o
    // minuto N do dia e meia-noite + N minutos.
    if (inicioDia.getTime() + inicioMin * 60_000 < primeiroInicioPermitido) {
      continue;
    }

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
