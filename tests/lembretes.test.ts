import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { dispararNotificacao } from "@/lib/notificacoes";
import { verificarEEnviarLembretes } from "@/lib/notificacoes/lembretes";

// RF09, RN08 — lembretes de 24 h e de 2 h antes do horario. Cada um sai uma
// vez so, e apenas se o agendamento foi feito com antecedencia suficiente
// para aquele lembrete fazer sentido. O banco e o envio sao falsos.

type Agendamento = {
  id: string;
  dataHora: Date;
  criadoEm: Date;
  notificacoes: { tipo: string }[];
};

const { agendamentosPorTenant, consultas } = vi.hoisted(() => ({
  agendamentosPorTenant: new Map<string, Agendamento[]>(),
  consultas: [] as { tenantId: string; args: unknown }[],
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenant: {
      findMany: async () => [...agendamentosPorTenant.keys()].map((id) => ({ id })),
    },
  },
}));

vi.mock("@/lib/tenant-db", () => ({
  withTenant: async (tenantId: string, fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      agendamento: {
        findMany: async (args: unknown) => {
          consultas.push({ tenantId, args });
          return agendamentosPorTenant.get(tenantId) ?? [];
        },
      },
    }),
}));

vi.mock("@/lib/notificacoes", () => ({ dispararNotificacao: vi.fn() }));

const disparar = vi.mocked(dispararNotificacao);

const AGORA = new Date("2026-10-29T13:00:00Z");
const HORA = 60 * 60 * 1000;
const daqui = (horas: number) => new Date(AGORA.getTime() + horas * HORA);

// Agendamento para daqui a `horasAte`, criado `antecedencia` horas antes do horario.
function agendamento(id: string, horasAte: number, antecedencia: number, jaEnviados: string[] = []) {
  const dataHora = daqui(horasAte);
  return {
    id,
    dataHora,
    criadoEm: new Date(dataHora.getTime() - antecedencia * HORA),
    notificacoes: jaEnviados.map((tipo) => ({ tipo })),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(AGORA);
  agendamentosPorTenant.clear();
  consultas.length = 0;
  disparar.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("verificarEEnviarLembretes", () => {
  test("busca so agendamentos futuros e ainda ativos de cada estetica", async () => {
    agendamentosPorTenant.set("tenant-a", []);
    agendamentosPorTenant.set("tenant-b", []);
    await verificarEEnviarLembretes();

    expect(consultas.map((c) => c.tenantId)).toEqual(["tenant-a", "tenant-b"]);
    expect(consultas[0].args).toMatchObject({
      where: {
        status: { in: ["PENDENTE_PAGAMENTO", "PIX_PENDENTE", "CONFIRMADO"] },
        dataHora: { gt: AGORA },
      },
    });
  });

  test("faltando 20 h, envia o lembrete de 24 h", async () => {
    agendamentosPorTenant.set("tenant-a", [agendamento("ag-1", 20, 72)]);
    expect(await verificarEEnviarLembretes()).toEqual({ lembretes24h: 1, lembretes2h: 0, verificados: 1 });
    expect(disparar).toHaveBeenCalledWith(expect.anything(), "ag-1", "LEMBRETE_24H");
  });

  test("faltando 1 h, envia o lembrete de 2 h", async () => {
    agendamentosPorTenant.set("tenant-a", [agendamento("ag-1", 1, 72, ["LEMBRETE_24H"])]);
    expect(await verificarEEnviarLembretes()).toEqual({ lembretes24h: 0, lembretes2h: 1, verificados: 1 });
    expect(disparar).toHaveBeenCalledWith(expect.anything(), "ag-1", "LEMBRETE_2H");
  });

  test("faltando mais de 24 h, ainda nao envia nada", async () => {
    agendamentosPorTenant.set("tenant-a", [agendamento("ag-1", 30, 72)]);
    expect(await verificarEEnviarLembretes()).toMatchObject({ lembretes24h: 0, lembretes2h: 0 });
    expect(disparar).not.toHaveBeenCalled();
  });

  test("lembrete ja enviado nao sai de novo", async () => {
    agendamentosPorTenant.set("tenant-a", [
      agendamento("ag-1", 20, 72, ["LEMBRETE_24H"]),
      agendamento("ag-2", 1, 72, ["LEMBRETE_24H", "LEMBRETE_2H"]),
    ]);
    expect(await verificarEEnviarLembretes()).toEqual({ lembretes24h: 0, lembretes2h: 0, verificados: 2 });
    expect(disparar).not.toHaveBeenCalled();
  });

  test("agendado com menos de 24 h de antecedencia nao recebe o lembrete de 24 h", async () => {
    // Marcado hoje para daqui a 20 h: o cliente acabou de agendar.
    agendamentosPorTenant.set("tenant-a", [agendamento("ag-1", 20, 21)]);
    expect(await verificarEEnviarLembretes()).toMatchObject({ lembretes24h: 0 });
  });

  test("agendado com menos de 2 h de antecedencia nao recebe lembrete nenhum", async () => {
    agendamentosPorTenant.set("tenant-a", [agendamento("ag-1", 1, 1.5)]);
    expect(await verificarEEnviarLembretes()).toMatchObject({ lembretes24h: 0, lembretes2h: 0 });
  });

  test("conta os lembretes de todas as esteticas", async () => {
    agendamentosPorTenant.set("tenant-a", [agendamento("ag-1", 20, 72)]);
    agendamentosPorTenant.set("tenant-b", [agendamento("ag-2", 1, 72, ["LEMBRETE_24H"]), agendamento("ag-3", 22, 48)]);
    expect(await verificarEEnviarLembretes()).toEqual({ lembretes24h: 2, lembretes2h: 1, verificados: 3 });
  });
});
