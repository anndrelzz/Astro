import { describe, expect, test } from "vitest";
import { conferirDataAgendamento } from "@/lib/agenda";
import { instanteNoFuso } from "@/lib/fuso";
import { veiculoSchema } from "@/lib/validations/veiculo";

// Datas que o cliente manda ao agendar (lib/agenda.ts) e o ano do veiculo
// (validations/veiculo.ts). A tela ja limita os dois; aqui e o servidor, que
// recebe tambem pedidos montados fora dela.
//
// Nao usa banco.

// Quarta, 21/10/2026, 13:00 no relogio da estetica.
const AGORA = instanteNoFuso(2026, 10, 21, 13, 0);

describe("data do agendamento", () => {
  test("hoje e o ultimo dia da janela (hoje + 13): aceitas", () => {
    expect(conferirDataAgendamento("2026-10-21", AGORA)).toBeNull();
    expect(conferirDataAgendamento("2026-11-03", AGORA)).toBeNull();
  });

  test("um dia depois da janela: recusada", () => {
    expect(conferirDataAgendamento("2026-11-04", AGORA)).toMatch(/proximos 14 dias/);
  });

  test("muito longe (2099): recusada", () => {
    expect(conferirDataAgendamento("2099-03-10", AGORA)).toMatch(/proximos 14 dias/);
  });

  test("ontem: recusada", () => {
    expect(conferirDataAgendamento("2026-10-20", AGORA)).toMatch(/proximos 14 dias/);
  });

  test("data inexistente (31/02, 30/02, mes 13): invalida, nao vira outro dia", () => {
    expect(conferirDataAgendamento("2027-02-31", AGORA)).toBe("Data invalida");
    expect(conferirDataAgendamento("2027-02-30", AGORA)).toBe("Data invalida");
    expect(conferirDataAgendamento("2026-13-01", AGORA)).toBe("Data invalida");
  });

  test("virada de mes e de ano dentro da janela", () => {
    const fimDeAno = instanteNoFuso(2026, 12, 28, 9, 0);
    expect(conferirDataAgendamento("2027-01-05", fimDeAno)).toBeNull();
    expect(conferirDataAgendamento("2027-01-11", fimDeAno)).toMatch(/proximos 14 dias/);
  });
});

describe("ano do veiculo", () => {
  const veiculo = {
    marca: "Fiat",
    modelo: "Uno",
    placa: "ABC1D23",
    cor: "Preto",
    segmentoId: "00000000-0000-4000-8000-000000000000",
  };
  const anoAtual = new Date().getFullYear();

  test("ate o ano que vem: aceito", () => {
    expect(veiculoSchema.safeParse({ ...veiculo, ano: anoAtual + 1 }).success).toBe(true);
  });

  test("dois anos a frente: recusado", () => {
    expect(veiculoSchema.safeParse({ ...veiculo, ano: anoAtual + 2 }).success).toBe(false);
  });
});
