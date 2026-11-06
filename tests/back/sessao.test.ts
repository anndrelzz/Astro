import { describe, expect, test } from "vitest";
import { authOptions } from "@/back/auth";
import { DIAS_DE_SESSAO_PADRAO, segundosDeSessao } from "@/back/sessao";

// Issue #113, RNF07 — a sessao tinha o prazo padrao do NextAuth (30 dias),
// sem nada no codigo. Agora sao 7 dias sem usar o site (o NextAuth renova o
// prazo a cada uso), configuravel pela variavel SESSAO_DIAS.

const DIA = 24 * 60 * 60;

describe("segundosDeSessao", () => {
  test("sem a variavel, a sessao dura 7 dias", () => {
    expect(DIAS_DE_SESSAO_PADRAO).toBe(7);
    expect(segundosDeSessao(undefined)).toBe(7 * DIA);
  });

  test("SESSAO_DIAS muda o prazo", () => {
    expect(segundosDeSessao("3")).toBe(3 * DIA);
    expect(segundosDeSessao("30")).toBe(30 * DIA);
  });

  test("valor invalido nao derruba o login: volta aos 7 dias", () => {
    for (const invalido of ["", "abc", "0", "-5", "2.5", "7 dias"]) {
      expect(segundosDeSessao(invalido)).toBe(7 * DIA);
    }
  });
});

describe("authOptions", () => {
  test("o prazo da sessao fica explicito na configuracao do login", () => {
    expect(authOptions.session?.strategy).toBe("jwt");
    expect(authOptions.session?.maxAge).toBe(segundosDeSessao(process.env.SESSAO_DIAS));
  });

  test("o token assinado vence junto com a sessao", () => {
    expect(authOptions.jwt?.maxAge).toBe(authOptions.session?.maxAge);
  });
});
