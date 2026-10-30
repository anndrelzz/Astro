import { describe, expect, test } from "vitest";
import type { Prisma, Servico, Tenant } from "@/generated/prisma/client";
import { calcularSlotsDisponiveis } from "@/back/slots";

// RF02, RN06 — quais horarios o cliente pode escolher num dia. O calculo le a
// grade do dia e os agendamentos ja marcados; aqui o banco e trocado por um
// objeto que devolve dados fixos, para testar so a regra.

type AgendamentoFalso = { dataHora: Date; servico: { duracaoMin: number } };

function bancoFalso(
  grade: { horaInicioMin: number; horaFimMin: number } | null,
  agendamentos: AgendamentoFalso[] = []
) {
  const consultas: unknown[] = [];
  const tx = {
    horarioFuncionamento: {
      findUnique: async (args: unknown) => {
        consultas.push(args);
        return grade;
      },
    },
    agendamento: {
      findMany: async (args: unknown) => {
        consultas.push(args);
        return agendamentos;
      },
    },
  } as unknown as Prisma.TransactionClient;
  return { tx, consultas };
}

const tenant = (capacidadeSimultanea = 1, intervaloMinutos = 60) =>
  ({ id: "tenant-1", capacidadeSimultanea, intervaloMinutos }) as Tenant;

const servico = (duracaoMin: number) => ({ id: "servico-1", duracaoMin }) as Servico;

// Quinta-feira, 29/10/2026, ao meio-dia de Brasilia.
const DIA = new Date("2026-10-29T15:00:00Z");
// Relogio fixo na vespera: nenhum horario de DIA ja passou. Os horarios do
// proprio dia que ja passaram tem teste proprio (horarios-passados.test.ts).
const VESPERA = new Date("2026-10-28T12:00:00Z");
// "HH:MM" de Brasilia nesse dia, escrito como instante UTC (+3h).
const as = (hora: string) => new Date(`2026-10-29T${hora}:00-03:00`);

describe("calcularSlotsDisponiveis", () => {
  test("dia sem grade de funcionamento nao tem horario", async () => {
    const { tx } = bancoFalso(null);
    expect(await calcularSlotsDisponiveis(tx, tenant(), servico(60), DIA, VESPERA)).toEqual([]);
  });

  test("sem agendamentos, oferece de hora em hora ate caber o servico", async () => {
    const { tx } = bancoFalso({ horaInicioMin: 8 * 60, horaFimMin: 12 * 60 });
    expect(await calcularSlotsDisponiveis(tx, tenant(), servico(60), DIA, VESPERA)).toEqual([
      "08:00",
      "09:00",
      "10:00",
      "11:00",
    ]);
  });

  test("servico que nao cabe antes do fechamento fica de fora", async () => {
    const { tx } = bancoFalso({ horaInicioMin: 8 * 60, horaFimMin: 12 * 60 });
    expect(await calcularSlotsDisponiveis(tx, tenant(), servico(150), DIA, VESPERA)).toEqual([
      "08:00",
      "09:00",
    ]);
  });

  test("respeita o intervalo configurado pela estetica", async () => {
    const { tx } = bancoFalso({ horaInicioMin: 8 * 60, horaFimMin: 10 * 60 });
    expect(await calcularSlotsDisponiveis(tx, tenant(1, 30), servico(30), DIA, VESPERA)).toEqual([
      "08:00",
      "08:30",
      "09:00",
      "09:30",
    ]);
  });

  test("horario ocupado some quando a capacidade e 1", async () => {
    const { tx } = bancoFalso({ horaInicioMin: 8 * 60, horaFimMin: 12 * 60 }, [
      { dataHora: as("09:00"), servico: { duracaoMin: 60 } },
    ]);
    expect(await calcularSlotsDisponiveis(tx, tenant(), servico(60), DIA, VESPERA)).toEqual([
      "08:00",
      "10:00",
      "11:00",
    ]);
  });

  test("agendamento longo bloqueia todos os horarios que ele cobre", async () => {
    const { tx } = bancoFalso({ horaInicioMin: 8 * 60, horaFimMin: 12 * 60 }, [
      { dataHora: as("08:30"), servico: { duracaoMin: 120 } },
    ]);
    // 08:30 a 10:30 encosta em 08:00-09:00, 09:00-10:00 e 10:00-11:00.
    expect(await calcularSlotsDisponiveis(tx, tenant(), servico(60), DIA, VESPERA)).toEqual(["11:00"]);
  });

  test("servico que termina quando o outro comeca nao conta como conflito", async () => {
    const { tx } = bancoFalso({ horaInicioMin: 8 * 60, horaFimMin: 10 * 60 }, [
      { dataHora: as("09:00"), servico: { duracaoMin: 60 } },
    ]);
    expect(await calcularSlotsDisponiveis(tx, tenant(), servico(60), DIA, VESPERA)).toEqual(["08:00"]);
  });

  test("com capacidade 2, o horario so fecha no segundo agendamento", async () => {
    const grade = { horaInicioMin: 8 * 60, horaFimMin: 10 * 60 };
    const umCarro = bancoFalso(grade, [{ dataHora: as("08:00"), servico: { duracaoMin: 60 } }]);
    expect(await calcularSlotsDisponiveis(umCarro.tx, tenant(2), servico(60), DIA, VESPERA)).toEqual([
      "08:00",
      "09:00",
    ]);

    const doisCarros = bancoFalso(grade, [
      { dataHora: as("08:00"), servico: { duracaoMin: 60 } },
      { dataHora: as("08:00"), servico: { duracaoMin: 60 } },
    ]);
    expect(await calcularSlotsDisponiveis(doisCarros.tx, tenant(2), servico(60), DIA, VESPERA)).toEqual([
      "09:00",
    ]);
  });

  test("consulta a grade do dia da semana de Brasilia e ignora cancelados", async () => {
    // 01:00 UTC de sexta ainda e quinta (22:00) em Brasilia.
    const { tx, consultas } = bancoFalso({ horaInicioMin: 8 * 60, horaFimMin: 9 * 60 });
    await calcularSlotsDisponiveis(tx, tenant(), servico(60), new Date("2026-10-30T01:00:00Z"), VESPERA);

    expect(consultas[0]).toEqual({
      where: { tenantId_diaSemana: { tenantId: "tenant-1", diaSemana: 4 } },
    });
    expect(consultas[1]).toMatchObject({
      where: {
        tenantId: "tenant-1",
        dataHora: {
          gte: new Date("2026-10-29T03:00:00.000Z"),
          lte: new Date("2026-10-30T02:59:59.999Z"),
        },
        status: { not: "CANCELADO" },
      },
    });
  });
});
