import { describe, expect, test } from "vitest";
import { ipDoPedido, resumoDaConexao } from "@/back/autocadastro";

// Limite de cadastros por conexao (tela /start): de qual conexao veio o
// pedido. O App Service da Azure manda o IP no X-Forwarded-For, as vezes com
// a porta.

const pedidoDe = (xff?: string) =>
  new Request("http://localhost/api/esteticas", { headers: xff ? { "x-forwarded-for": xff } : {} });

describe("ipDoPedido", () => {
  test("IPv4, com ou sem porta", () => {
    expect(ipDoPedido(pedidoDe("203.0.113.5"))).toBe("203.0.113.5");
    expect(ipDoPedido(pedidoDe("203.0.113.5:51234"))).toBe("203.0.113.5");
  });

  test("so o primeiro da lista conta (os outros sao proxies no caminho)", () => {
    expect(ipDoPedido(pedidoDe("203.0.113.5, 10.0.0.1"))).toBe("203.0.113.5");
  });

  test("IPv6, com colchetes e porta ou puro", () => {
    expect(ipDoPedido(pedidoDe("[2001:db8::1]:443"))).toBe("2001:db8::1");
    expect(ipDoPedido(pedidoDe("2001:db8::1"))).toBe("2001:db8::1");
  });

  test("sem o cabecalho (computador do dev), todos contam como a mesma conexao", () => {
    expect(ipDoPedido(pedidoDe())).toBe("local");
  });
});

describe("resumoDaConexao", () => {
  test("a mesma conexao da o mesmo resumo, e o resumo nao revela o IP", () => {
    const a = resumoDaConexao(pedidoDe("203.0.113.5:1000"));
    expect(resumoDaConexao(pedidoDe("203.0.113.5:2000"))).toBe(a);
    expect(resumoDaConexao(pedidoDe("203.0.113.6"))).not.toBe(a);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toContain("203");
  });
});
