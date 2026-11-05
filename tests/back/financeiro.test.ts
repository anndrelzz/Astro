import { describe, expect, test } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import {
  dataDoRecebimento,
  filtroDoPeriodo,
  foiRecebido,
  janela,
  lerPeriodo,
  PERIODOS,
  receitaPorOrigem,
  resumoDoPeriodo,
  totalCobrado,
} from "@/compartilhado/financeiro";

// RF12, UC11 — regras do financeiro do Admin, as mesmas da tela e do CSV.

describe("lerPeriodo", () => {
  test("aceita os periodos conhecidos", () => {
    for (const periodo of PERIODOS) expect(lerPeriodo(periodo)).toBe(periodo);
  });

  test("valor ausente ou desconhecido cai em 30 dias", () => {
    expect(lerPeriodo(null)).toBe("30dias");
    expect(lerPeriodo(undefined)).toBe("30dias");
    expect(lerPeriodo("")).toBe("30dias");
    expect(lerPeriodo("365dias")).toBe("30dias");
  });
});

describe("foiRecebido", () => {
  test("so confirmado e concluido contam como receita", () => {
    expect(foiRecebido("CONFIRMADO")).toBe(true);
    expect(foiRecebido("CONCLUIDO")).toBe(true);
  });

  test("pagamento pendente e cancelado ficam fora da receita", () => {
    expect(foiRecebido("PENDENTE_PAGAMENTO")).toBe(false);
    expect(foiRecebido("PIX_PENDENTE")).toBe(false);
    expect(foiRecebido("CANCELADO")).toBe(false);
  });
});

describe("janela", () => {
  // Quinta, 29/10/2026, 10:30 em Brasilia.
  const agora = new Date("2026-10-29T13:30:00Z");
  const fimDeHoje = "2026-10-30T02:59:59.999Z";

  test("hoje vai da meia-noite ao fim do dia de Brasilia", () => {
    const { inicio, fim } = janela("hoje", agora);
    expect(inicio.toISOString()).toBe("2026-10-29T03:00:00.000Z");
    expect(fim.toISOString()).toBe(fimDeHoje);
  });

  test("7 dias inclui hoje e os 6 dias anteriores", () => {
    expect(janela("7dias", agora).inicio.toISOString()).toBe("2026-10-23T03:00:00.000Z");
  });

  test("30 e 90 dias contam para tras a partir de hoje", () => {
    expect(janela("30dias", agora).inicio.toISOString()).toBe("2026-09-30T03:00:00.000Z");
    expect(janela("90dias", agora).inicio.toISOString()).toBe("2026-08-01T03:00:00.000Z");
  });

  test("ano comeca em 1o de janeiro de Brasilia", () => {
    const { inicio, fim } = janela("ano", agora);
    expect(inicio.toISOString()).toBe("2026-01-01T03:00:00.000Z");
    expect(fim.toISOString()).toBe(fimDeHoje);
  });

  test("na virada do ano no UTC, ainda vale o ano de Brasilia", () => {
    // 01:00 UTC de 01/01/2027 e 22:00 de 31/12/2026 em Brasilia.
    expect(janela("ano", new Date("2027-01-01T01:00:00Z")).inicio.toISOString()).toBe(
      "2026-01-01T03:00:00.000Z"
    );
  });
});

describe("totalCobrado", () => {
  test("sem acrescimo, e o valor combinado", () => {
    expect(totalCobrado({ valor: new Prisma.Decimal("120.00"), acrescimoAplicado: null })).toBe(120);
  });

  test("com acrescimo, soma o que foi lancado na avaliacao", () => {
    expect(
      totalCobrado({
        valor: new Prisma.Decimal("120.00"),
        acrescimoAplicado: new Prisma.Decimal("36.00"),
      })
    ).toBe(156);
  });
});

// Regime de caixa: o que entrou conta no dia em que foi pago (pagoEm), e nao
// no dia do servico. Um PIX pago hoje para um servico da semana que vem e
// dinheiro de hoje, como no extrato do banco da estetica.
describe("dataDoRecebimento", () => {
  test("e o dia em que o pagamento foi confirmado", () => {
    const pagoEm = new Date("2026-11-03T15:00:00Z");
    expect(dataDoRecebimento({ dataHora: new Date("2026-11-13T12:00:00Z"), pagoEm })).toBe(pagoEm);
  });

  test("sem pagoEm (pago antes desta regra), vale o dia do servico", () => {
    const dataHora = new Date("2026-10-20T12:00:00Z");
    expect(dataDoRecebimento({ dataHora, pagoEm: null })).toBe(dataHora);
  });
});

describe("resumoDoPeriodo", () => {
  // Terca, 03/11/2026, 12:30 em Brasilia.
  const agora = new Date("2026-11-03T15:30:00Z");
  const hoje = janela("hoje", agora);
  const fimDoMes = new Date("2026-12-01T02:59:59.999Z");
  const ag = (
    status: string,
    dataHora: string,
    valor: number,
    extra: { pagoEm?: string; acrescimo?: number } = {}
  ) => ({
    status,
    dataHora: new Date(dataHora),
    pagoEm: extra.pagoEm ? new Date(extra.pagoEm) : null,
    valor: new Prisma.Decimal(valor),
    acrescimoAplicado: extra.acrescimo ? new Prisma.Decimal(extra.acrescimo) : null,
  });

  const agendamentos = [
    // Lavacao de hoje, paga no local hoje, com acrescimo.
    ag("CONFIRMADO", "2026-11-03T19:00:00Z", 70, { pagoEm: "2026-11-03T15:00:00Z", acrescimo: 21 }),
    // Polimento do dia 13, PIX pago hoje.
    ag("CONFIRMADO", "2026-11-13T12:00:00Z", 350, { pagoEm: "2026-11-03T15:20:00Z" }),
    // Servico de hoje, ainda sem pagamento.
    ag("PENDENTE_PAGAMENTO", "2026-11-03T17:00:00Z", 60),
    // PIX do dia 20, ainda nao confirmado.
    ag("PIX_PENDENTE", "2026-11-20T12:00:00Z", 120),
    // Servico de ontem, pago ontem.
    ag("CONCLUIDO", "2026-11-02T13:00:00Z", 80, { pagoEm: "2026-11-02T14:00:00Z" }),
    // Cancelado: nao conta em nada.
    ag("CANCELADO", "2026-11-03T18:00:00Z", 500),
  ];

  test("hoje: recebido pelo dia do pagamento, inclusive o PIX de um servico futuro", () => {
    const r = resumoDoPeriodo(agendamentos, { inicio: hoje.inicio, fimRecebido: hoje.fim, fimAReceber: hoje.fim });
    expect(r.recebido).toBe(70 + 21 + 350);
    expect(r.pagos).toBe(2);
  });

  test("a receber e atendimentos seguem o dia do servico", () => {
    const r = resumoDoPeriodo(agendamentos, { inicio: hoje.inicio, fimRecebido: hoje.fim, fimAReceber: hoje.fim });
    expect(r.aReceber).toBe(60);
    // A lavacao paga e o servico pendente de hoje; o cancelado nao conta.
    expect(r.atendimentos).toBe(2);
  });

  test("mes: recebido ate hoje, a receber e atendimentos do mes inteiro", () => {
    const inicioMes = new Date("2026-11-01T03:00:00Z");
    const r = resumoDoPeriodo(agendamentos, { inicio: inicioMes, fimRecebido: hoje.fim, fimAReceber: fimDoMes });
    expect(r.recebido).toBe(70 + 21 + 350 + 80);
    expect(r.aReceber).toBe(60 + 120);
    expect(r.atendimentos).toBe(5);
  });
});

describe("filtroDoPeriodo", () => {
  test("pega o que foi atendido OU pago no periodo, sem os cancelados", () => {
    const inicio = new Date("2026-11-01T03:00:00Z");
    const fim = new Date("2026-11-04T02:59:59.999Z");
    expect(filtroDoPeriodo("t1", inicio, fim)).toEqual({
      tenantId: "t1",
      status: { not: "CANCELADO" },
      OR: [{ dataHora: { gte: inicio, lte: fim } }, { pagoEm: { gte: inicio, lte: fim } }],
    });
  });
});

describe("receitaPorOrigem", () => {
  const recebido = (valor: number, acrescimo: number | null, coringa: boolean) => ({
    valor: new Prisma.Decimal(valor),
    acrescimoAplicado: acrescimo === null ? null : new Prisma.Decimal(acrescimo),
    usuario: { coringa },
  });

  test("separa o que veio do site do que o Admin agendou pelo coringa, com o acrescimo", () => {
    expect(
      receitaPorOrigem([recebido(80, null, false), recebido(120, 20, false), recebido(60, null, true)])
    ).toEqual({ site: { valor: 220, qtd: 2 }, admin: { valor: 60, qtd: 1 } });
  });

  test("sem nada recebido, zera os dois lados", () => {
    expect(receitaPorOrigem([])).toEqual({ site: { valor: 0, qtd: 0 }, admin: { valor: 0, qtd: 0 } });
  });
});
