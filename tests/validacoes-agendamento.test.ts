import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { conferirDataAgendamento } from "@/lib/agenda";
import { instanteNoFuso } from "@/lib/fuso";
import { veiculoSchema } from "@/lib/validations/veiculo";

// Datas que o cliente manda ao agendar (lib/agenda.ts) e o ano do veiculo
// (validations/veiculo.ts). A tela ja limita os dois; aqui e o servidor, que
// recebe tambem pedidos montados fora dela.
//
// Nao usa banco. Rodar com:
//   npm run test:validacoes

// Quarta, 21/10/2026, 13:00 no relogio da estetica.
const AGORA = instanteNoFuso(2026, 10, 21, 13, 0);

describe("data do agendamento", () => {
  test("hoje e o ultimo dia da janela (hoje + 13): aceitas", () => {
    assert.equal(conferirDataAgendamento("2026-10-21", AGORA), null);
    assert.equal(conferirDataAgendamento("2026-11-03", AGORA), null);
  });

  test("um dia depois da janela: recusada", () => {
    assert.match(conferirDataAgendamento("2026-11-04", AGORA) ?? "", /proximos 14 dias/);
  });

  test("muito longe (2099): recusada", () => {
    assert.match(conferirDataAgendamento("2099-03-10", AGORA) ?? "", /proximos 14 dias/);
  });

  test("ontem: recusada", () => {
    assert.match(conferirDataAgendamento("2026-10-20", AGORA) ?? "", /proximos 14 dias/);
  });

  test("data inexistente (31/02, 30/02, mes 13): invalida, nao vira outro dia", () => {
    assert.equal(conferirDataAgendamento("2027-02-31", AGORA), "Data invalida");
    assert.equal(conferirDataAgendamento("2027-02-30", AGORA), "Data invalida");
    assert.equal(conferirDataAgendamento("2026-13-01", AGORA), "Data invalida");
  });

  test("virada de mes e de ano dentro da janela", () => {
    const fimDeAno = instanteNoFuso(2026, 12, 28, 9, 0);
    assert.equal(conferirDataAgendamento("2027-01-05", fimDeAno), null);
    assert.match(conferirDataAgendamento("2027-01-11", fimDeAno) ?? "", /proximos 14 dias/);
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
    assert.equal(veiculoSchema.safeParse({ ...veiculo, ano: anoAtual + 1 }).success, true);
  });

  test("dois anos a frente: recusado", () => {
    assert.equal(veiculoSchema.safeParse({ ...veiculo, ano: anoAtual + 2 }).success, false);
  });
});
