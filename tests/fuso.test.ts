import { describe, expect, test } from "vitest";
import {
  chaveDia,
  fimDoDia,
  horaMinuto,
  inicioDoDia,
  instanteNoFuso,
  minutosNoFuso,
  partesNoFuso,
} from "@/lib/fuso";

// Toda data do Astro vira "dia" e "hora" pelo relogio de Brasilia, nao pelo
// da maquina. Os instantes abaixo sao escritos em UTC (o "Z" no fim) para o
// resultado nao depender do fuso de quem roda o teste: no computador de
// desenvolvimento e Brasilia, no CI e UTC, e os dois tem de dar o mesmo.

describe("partesNoFuso", () => {
  test("13:30 UTC e 10:30 em Brasilia", () => {
    expect(partesNoFuso(new Date("2026-10-29T13:30:00Z"))).toEqual({
      ano: 2026,
      mes: 10,
      dia: 29,
      hora: 10,
      minuto: 30,
      diaSemana: 4, // quinta-feira
    });
  });

  test("02:00 UTC ainda e o dia anterior em Brasilia", () => {
    const p = partesNoFuso(new Date("2026-10-30T02:00:00Z"));
    expect(p.dia).toBe(29);
    expect(p.hora).toBe(23);
  });

  test("dia da semana segue a convencao do banco (0 = domingo)", () => {
    expect(partesNoFuso(new Date("2026-11-01T15:00:00Z")).diaSemana).toBe(0);
    expect(partesNoFuso(new Date("2026-11-07T15:00:00Z")).diaSemana).toBe(6);
  });
});

describe("instanteNoFuso", () => {
  test("10:00 em Brasilia e 13:00 UTC", () => {
    expect(instanteNoFuso(2026, 10, 29, 10, 0).toISOString()).toBe("2026-10-29T13:00:00.000Z");
  });

  test("hora e minuto sao opcionais e valem meia-noite", () => {
    expect(instanteNoFuso(2026, 10, 29).toISOString()).toBe("2026-10-29T03:00:00.000Z");
  });

  test("dia 0 vira o ultimo dia do mes anterior", () => {
    expect(instanteNoFuso(2026, 3, 0).toISOString()).toBe("2026-02-28T03:00:00.000Z");
  });

  test("mes 13 vira janeiro do ano seguinte", () => {
    expect(instanteNoFuso(2026, 13, 1).toISOString()).toBe("2027-01-01T03:00:00.000Z");
  });

  test("respeita o antigo horario de verao (UTC-2 em dezembro de 2018)", () => {
    expect(instanteNoFuso(2018, 12, 1, 10, 0).toISOString()).toBe("2018-12-01T12:00:00.000Z");
  });

  test("ida e volta: o instante calculado mostra a mesma hora no relogio", () => {
    const p = partesNoFuso(instanteNoFuso(2026, 7, 15, 18, 45));
    expect([p.ano, p.mes, p.dia, p.hora, p.minuto]).toEqual([2026, 7, 15, 18, 45]);
  });
});

describe("inicioDoDia e fimDoDia", () => {
  // 23:00 do dia 29 em Brasilia: no UTC ja e dia 30.
  const noite = new Date("2026-10-30T02:00:00Z");

  test("inicio e a meia-noite de Brasilia do mesmo dia", () => {
    expect(inicioDoDia(noite).toISOString()).toBe("2026-10-29T03:00:00.000Z");
  });

  test("inicio com deslocamento vai para o dia seguinte", () => {
    expect(inicioDoDia(noite, 1).toISOString()).toBe("2026-10-30T03:00:00.000Z");
  });

  test("inicio com deslocamento negativo volta dias", () => {
    expect(inicioDoDia(noite, -29).toISOString()).toBe("2026-09-30T03:00:00.000Z");
  });

  test("fim e o ultimo milissegundo do mesmo dia", () => {
    expect(fimDoDia(noite).toISOString()).toBe("2026-10-30T02:59:59.999Z");
  });

  test("fim com deslocamento acompanha o inicio", () => {
    expect(fimDoDia(noite, 1).toISOString()).toBe("2026-10-31T02:59:59.999Z");
  });
});

describe("formatos curtos", () => {
  test("chaveDia usa o dia de Brasilia, com zeros a esquerda", () => {
    expect(chaveDia(new Date("2026-01-05T02:59:00Z"))).toBe("2026-01-04");
  });

  test("horaMinuto usa a hora de Brasilia, com zeros a esquerda", () => {
    expect(horaMinuto(new Date("2026-01-05T11:05:00Z"))).toBe("08:05");
  });

  test("minutosNoFuso conta desde a meia-noite de Brasilia", () => {
    expect(minutosNoFuso(new Date("2026-01-05T11:00:00Z"))).toBe(480);
    expect(minutosNoFuso(new Date("2026-01-05T03:00:00Z"))).toBe(0);
  });
});
