import { describe, expect, test } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { foiRecebido, janela, lerPeriodo, PERIODOS, totalCobrado } from "@/lib/financeiro";

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
