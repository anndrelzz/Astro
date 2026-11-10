import { describe, expect, test } from "vitest";
import { textoPagamentoInformado } from "@/compartilhado/pagamento-informado";

// O que o painel do Admin mostra quando o cliente aperta "Ja fiz o pagamento":
// a hora, no fuso da estetica, e o dia quando nao foi hoje.

// Quinta, 12/11/2026, 16:00 de Brasilia.
const AGORA = new Date("2026-11-12T19:00:00Z");

describe("textoPagamentoInformado", () => {
  test("hoje: so a hora, no horario de Brasilia", () => {
    expect(textoPagamentoInformado(new Date("2026-11-12T17:32:00Z"), AGORA)).toBe("Cliente diz que pagou às 14:32");
  });

  test("ontem", () => {
    expect(textoPagamentoInformado(new Date("2026-11-11T12:05:00Z"), AGORA)).toBe(
      "Cliente diz que pagou ontem às 09:05"
    );
  });

  test("antes de ontem: com o dia", () => {
    expect(textoPagamentoInformado(new Date("2026-11-09T22:10:00Z"), AGORA)).toBe(
      "Cliente diz que pagou em 09/11 às 19:10"
    );
  });
});
