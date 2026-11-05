import { describe, expect, test } from "vitest";
import { agruparContatosDoAdmin, nomeDoCliente } from "@/compartilhado/contato";

// Agendamento feito pelo Admin pelo coringa: o cliente de verdade e quem
// chamou no WhatsApp, anotado no proprio agendamento.

describe("nomeDoCliente", () => {
  test("pelo coringa, e o nome de quem chamou", () => {
    expect(nomeDoCliente({ contatoNome: "Joao", usuario: { nome: "Agendado pelo Admin" } })).toBe("Joao");
  });

  test("pelo site, e o nome da conta", () => {
    expect(nomeDoCliente({ contatoNome: null, usuario: { nome: "Maria Souza" } })).toBe("Maria Souza");
  });
});

describe("agruparContatosDoAdmin", () => {
  // 04/11/2026, 12:00 de Brasilia.
  const AGORA = new Date("2026-11-04T15:00:00.000Z");
  const dias = (n: number) => new Date(AGORA.getTime() + n * 24 * 60 * 60 * 1000);

  const ag = (
    telefone: string,
    nome: string,
    emDias: number,
    extra: { status?: "CONFIRMADO" | "CANCELADO" | "PENDENTE_PAGAMENTO"; modelo?: string; placa?: string } = {}
  ) => ({
    contatoNome: nome,
    contatoTelefone: telefone,
    dataHora: dias(emDias),
    status: extra.status ?? "PENDENTE_PAGAMENTO",
    veiculo: { modelo: extra.modelo ?? "Civic", placa: extra.placa ?? "" },
  });

  test("junta os agendamentos pelo telefone, com o nome mais recente", () => {
    const contatos = agruparContatosDoAdmin(
      [ag("47988887777", "Jo", -20), ag("47988887777", "Joao Lima", -2), ag("47911112222", "Ana", 3)],
      AGORA
    );

    expect(contatos).toHaveLength(2);
    expect(contatos.find((c) => c.telefone === "47988887777")).toMatchObject({
      nome: "Joao Lima",
      agendamentos: 2,
      ultimoISO: dias(-2).toISOString(),
      proximoISO: null,
    });
    expect(contatos.find((c) => c.telefone === "47911112222")).toMatchObject({
      nome: "Ana",
      proximoISO: dias(3).toISOString(),
    });
  });

  test("lista os carros sem repetir, com a placa quando tem", () => {
    const [contato] = agruparContatosDoAdmin(
      [
        ag("47988887777", "Joao", -9, { modelo: "Civic", placa: "QWE1R23" }),
        ag("47988887777", "Joao", -3, { modelo: "Civic", placa: "QWE1R23" }),
        ag("47988887777", "Joao", -1, { modelo: "Onix" }),
      ],
      AGORA
    );

    expect(contato.carros).toEqual(["Onix", "Civic · QWE1R23"]);
  });

  test("cancelado nao conta, e quem esta mais perto de hoje vem primeiro", () => {
    const contatos = agruparContatosDoAdmin(
      [
        ag("47911112222", "Ana", -40),
        ag("47988887777", "Joao", -1),
        ag("47988887777", "Joao", 5, { status: "CANCELADO" }),
      ],
      AGORA
    );

    expect(contatos.map((c) => c.nome)).toEqual(["Joao", "Ana"]);
    expect(contatos[0]).toMatchObject({ agendamentos: 1, proximoISO: null });
  });
});
