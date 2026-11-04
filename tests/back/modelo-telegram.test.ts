import { describe, expect, test } from "vitest";
import type { DadosDoEmail } from "@/back/notificacoes/modelo-email";
import { montarTelegram } from "@/back/notificacoes/modelo-telegram";

// RF08, RF09 — a mensagem do bot: titulo, a estetica, os dados do
// agendamento em linhas curtas e botoes para ver os agendamentos e falar com a
// estetica. O Telegram le HTML simples (<b>, <i>) com parse_mode "HTML".

// 13/11/2026 (sexta) as 10:00 de Brasilia, visto tres dias antes.
const DATA_HORA = new Date("2026-11-13T13:00:00Z");
const AGORA = new Date("2026-11-10T13:00:00Z");

function dados(extra: Partial<DadosDoEmail> = {}): DadosDoEmail {
  return {
    tipo: "CONFIRMACAO_AGENDAMENTO",
    clienteNome: "Maria Souza",
    estetica: { nome: "Estetica Demo", slug: "demo", logoUrl: null, whatsapp: "47999990000", cancelamentoHorasLimite: 2 },
    servicoNome: "Polimento tecnico",
    veiculo: { marca: "Chevrolet", modelo: "Astra", placa: "FDN8637" },
    dataHora: DATA_HORA,
    valor: 350,
    formaPagamento: "PIX",
    agora: AGORA,
    ...extra,
  };
}

describe("montarTelegram", () => {
  test("titulo em negrito, a estetica e os dados do agendamento em linhas", () => {
    const { texto } = montarTelegram(dados());

    expect(texto).toContain("<b>Agendamento confirmado</b>");
    expect(texto).toContain("Estetica Demo");
    expect(texto).toContain("<b>Polimento tecnico</b>");
    expect(texto).toContain("sexta, 13/11 às 10:00");
    expect(texto).toContain("Chevrolet Astra · FDN8637");
    expect(texto).toContain("R$ 350,00 · PIX");
  });

  test.each([
    ["CONFIRMACAO_AGENDAMENTO", "Agendamento confirmado"],
    ["LEMBRETE_24H", "Seu agendamento é amanhã"],
    ["LEMBRETE_2H", "Seu agendamento é daqui a 2 horas"],
    ["CONFIRMACAO_CANCELAMENTO", "Agendamento cancelado"],
  ] as const)("%s tem o titulo do e-mail", (tipo, titulo) => {
    expect(montarTelegram(dados({ tipo })).texto).toContain(`<b>${titulo}</b>`);
  });

  test("traz a linha do prazo de cancelamento, a mesma do e-mail", () => {
    const { texto } = montarTelegram(dados({ estetica: { ...dados().estetica, cancelamentoHorasLimite: 4 } }));
    expect(texto).toContain("Faça pelo site até 4 horas antes do horário.");
  });

  test("botoes: os agendamentos do cliente e o WhatsApp da estetica com a mensagem pronta", () => {
    const { botoes } = montarTelegram(dados());

    expect(botoes[0]).toEqual({ texto: "Ver meus agendamentos", url: "https://useastro.app.br/demo/historico" });
    expect(botoes[1].texto).toBe("Falar no WhatsApp");
    expect(new URL(botoes[1].url).searchParams.get("text")).toContain("Polimento tecnico");
  });

  test("no cancelamento, os botoes convidam a marcar de novo", () => {
    const { botoes } = montarTelegram(dados({ tipo: "CONFIRMACAO_CANCELAMENTO" }));
    expect(botoes.map((b) => b.texto)).toEqual(["Agendar outro horário", "Remarcar pelo WhatsApp"]);
  });

  test("sem WhatsApp da estetica, so o botao dos agendamentos", () => {
    const { botoes } = montarTelegram(dados({ estetica: { ...dados().estetica, whatsapp: null } }));
    expect(botoes).toHaveLength(1);
  });

  test("texto digitado pela estetica nao vira HTML do Telegram", () => {
    const { texto } = montarTelegram(dados({ estetica: { ...dados().estetica, nome: "<b>Loja</b> & Cia" } }));
    expect(texto).toContain("&lt;b&gt;Loja&lt;/b&gt; &amp; Cia");
  });
});
