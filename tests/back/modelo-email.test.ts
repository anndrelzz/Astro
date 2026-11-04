import { describe, expect, test } from "vitest";
import { montarEmailHtml, type DadosDoEmail } from "@/back/notificacoes/modelo-email";

// RF08, RF09 — o e-mail em HTML que o cliente recebe: a estetica no topo, os
// dados do agendamento, os botoes e o Astro no rodape. Funcao pura: recebe os
// dados e devolve o HTML, sem banco nem envio.

// 13/11/2026 (sexta) as 10:00 de Brasilia.
const DATA_HORA = new Date("2026-11-13T13:00:00Z");
// Tres dias antes: longe de qualquer prazo de cancelamento.
const AGORA = new Date("2026-11-10T13:00:00Z");

function dados(extra: Partial<DadosDoEmail> = {}): DadosDoEmail {
  return {
    tipo: "CONFIRMACAO_AGENDAMENTO",
    clienteNome: "Maria Souza",
    estetica: {
      nome: "Estetica Demo",
      slug: "demo",
      logoUrl: null,
      whatsapp: "47999990000",
      cancelamentoHorasLimite: 2,
    },
    servicoNome: "Polimento tecnico",
    veiculo: { marca: "Chevrolet", modelo: "Astra", placa: "FDN8637" },
    dataHora: DATA_HORA,
    valor: 350,
    formaPagamento: "PIX",
    agora: AGORA,
    ...extra,
  };
}

const estetica = (extra: Partial<DadosDoEmail["estetica"]>) => ({ ...dados().estetica, ...extra });

// O link do WhatsApp sai do HTML com o & escapado (&amp;), como todo atributo.
function linkDoWhatsApp(html: string) {
  const href = html.match(/href="(https:\/\/wa\.me\/[^"]+)"/)?.[1];
  return href ? new URL(href.replaceAll("&amp;", "&")) : null;
}

describe("montarEmailHtml — conteudo", () => {
  test("traz a estetica, o primeiro nome do cliente e os dados do agendamento", () => {
    const html = montarEmailHtml(dados());

    expect(html).toContain("Estetica Demo");
    expect(html).toContain("Olá, Maria.");
    expect(html).toContain("Polimento tecnico");
    expect(html).toContain("Chevrolet Astra · FDN8637");
    expect(html).toContain("R$ 350,00 · PIX");
  });

  test("a data sai no horario de Brasilia, com o dia da semana", () => {
    expect(montarEmailHtml(dados())).toContain("sexta, 13/11 às 10:00");
  });

  test("o botao principal leva aos agendamentos do cliente, no dominio do Astro", () => {
    expect(montarEmailHtml(dados())).toContain('href="https://useastro.app.br/demo/historico"');
  });

  test("o rodape usa o logo do Astro ja cortado, pelo endereco completo", () => {
    expect(montarEmailHtml(dados())).toContain('src="https://useastro.app.br/email/astro-rodape.png"');
  });

  test.each([
    ["CONFIRMACAO_AGENDAMENTO", "Agendamento confirmado"],
    ["LEMBRETE_24H", "Seu agendamento é amanhã"],
    ["LEMBRETE_2H", "Seu agendamento é daqui a 2 horas"],
    ["CONFIRMACAO_CANCELAMENTO", "Agendamento cancelado"],
  ] as const)("%s tem titulo proprio", (tipo, titulo) => {
    expect(montarEmailHtml(dados({ tipo }))).toContain(titulo);
  });
});

describe("montarEmailHtml — logo da estetica", () => {
  test("com logo, mostra a imagem pelo endereco completo", () => {
    const html = montarEmailHtml(dados({ estetica: estetica({ logoUrl: "/api/tenant/logo/t1?v=abc" }) }));
    expect(html).toContain('src="https://useastro.app.br/api/tenant/logo/t1?v=abc"');
  });

  test("sem logo, mostra a inicial do nome", () => {
    const html = montarEmailHtml(dados());
    expect(html).not.toContain("/api/tenant/logo/");
    expect(html).toMatch(/>E<\/td>/);
  });
});

describe("montarEmailHtml — WhatsApp da estetica", () => {
  test("abre a conversa com a mensagem do agendamento ja escrita", () => {
    const url = linkDoWhatsApp(montarEmailHtml(dados()));

    expect(url?.origin + url!.pathname).toBe("https://wa.me/5547999990000");
    expect(url?.searchParams.get("text")).toBe(
      "Olá! Tenho um agendamento de Polimento tecnico para sexta, 13/11 às 10:00."
    );
    expect(montarEmailHtml(dados())).toContain("Falar no WhatsApp");
  });

  test("sem WhatsApp cadastrado, o botao nao aparece", () => {
    const html = montarEmailHtml(dados({ estetica: estetica({ whatsapp: null }) }));
    expect(html).not.toContain("wa.me");
  });

  test("no cancelamento, o botao convida a remarcar", () => {
    const html = montarEmailHtml(dados({ tipo: "CONFIRMACAO_CANCELAMENTO" }));
    expect(html).toContain("Remarcar pelo WhatsApp");
    expect(linkDoWhatsApp(html)?.searchParams.get("text")).toContain("remarcar");
  });
});

describe("montarEmailHtml — prazo de cancelamento (RF18)", () => {
  test("segue o prazo configurado pela estetica", () => {
    const html = montarEmailHtml(dados({ estetica: estetica({ cancelamentoHorasLimite: 4 }) }));
    expect(html).toContain("Precisa cancelar? Faça pelo site até 4 horas antes do horário.");
  });

  test("com prazo de 1 hora, fala no singular", () => {
    const html = montarEmailHtml(dados({ estetica: estetica({ cancelamentoHorasLimite: 1 }) }));
    expect(html).toContain("até 1 hora antes");
  });

  test("dentro do prazo (lembrete de 2 h com prazo de 3 h), nao oferece cancelar pelo site", () => {
    const html = montarEmailHtml(
      dados({
        tipo: "LEMBRETE_2H",
        agora: new Date("2026-11-13T11:00:00Z"),
        estetica: estetica({ cancelamentoHorasLimite: 3 }),
      })
    );

    expect(html).not.toContain("Faça pelo site");
    expect(html).toContain("Precisa remarcar? Fale com a estética pelo WhatsApp.");
  });

  test("dentro do prazo e sem WhatsApp, so orienta a falar com a estetica", () => {
    const html = montarEmailHtml(
      dados({
        tipo: "LEMBRETE_2H",
        agora: new Date("2026-11-13T11:00:00Z"),
        estetica: estetica({ cancelamentoHorasLimite: 3, whatsapp: null }),
      })
    );

    expect(html).toContain("Precisa remarcar? Fale com a estética.");
  });

  test("no e-mail de cancelamento, a linha do prazo some", () => {
    const html = montarEmailHtml(dados({ tipo: "CONFIRMACAO_CANCELAMENTO" }));
    expect(html).not.toContain("Precisa cancelar");
    expect(html).not.toContain("Precisa remarcar");
  });
});

describe("montarEmailHtml — seguranca", () => {
  test("texto digitado pela estetica ou pelo cliente nao vira HTML", () => {
    const html = montarEmailHtml(
      dados({
        clienteNome: '<img src=x onerror="alert(1)">',
        estetica: estetica({ nome: "<b>Loja</b> & Cia" }),
      })
    );

    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<b>Loja</b>");
    expect(html).toContain("&lt;b&gt;Loja&lt;/b&gt; &amp; Cia");
  });
});
