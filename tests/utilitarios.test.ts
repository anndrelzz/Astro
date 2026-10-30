import { describe, expect, test } from "vitest";
import { lerJson } from "@/lib/api-helpers";
import { callbackUrlSeguro } from "@/lib/callback-url";
import { iniciais } from "@/lib/iniciais";

describe("callbackUrlSeguro", () => {
  // Para onde o login manda o cliente depois de entrar. O valor vem da URL,
  // entao qualquer pessoa pode montar um link com o destino que quiser.

  test("aceita a pagina inicial da propria estetica", () => {
    expect(callbackUrlSeguro("/estimacar", "estimacar")).toBe("/estimacar");
  });

  test("aceita caminhos e parametros dentro da estetica", () => {
    expect(callbackUrlSeguro("/estimacar/historico", "estimacar")).toBe("/estimacar/historico");
    expect(callbackUrlSeguro("/estimacar?aba=servicos", "estimacar")).toBe(
      "/estimacar?aba=servicos"
    );
  });

  test("valor vazio devolve null", () => {
    expect(callbackUrlSeguro(null, "estimacar")).toBeNull();
    expect(callbackUrlSeguro("", "estimacar")).toBeNull();
  });

  test("recusa outra estetica, mesmo com o nome parecido", () => {
    expect(callbackUrlSeguro("/outra-estetica", "estimacar")).toBeNull();
    expect(callbackUrlSeguro("/estimacar-falsa", "estimacar")).toBeNull();
  });

  test("recusa enderecos que levam para fora do Astro", () => {
    expect(callbackUrlSeguro("https://site-falso.com", "estimacar")).toBeNull();
    expect(callbackUrlSeguro("//site-falso.com", "estimacar")).toBeNull();
    expect(callbackUrlSeguro("/\\site-falso.com", "estimacar")).toBeNull();
  });
});

describe("iniciais", () => {
  test("usa a primeira letra dos dois primeiros nomes", () => {
    expect(iniciais("André Luiz da Silva")).toBe("AL");
  });

  test("nome de uma palavra vira uma letra maiuscula", () => {
    expect(iniciais("lucas")).toBe("L");
  });

  test("ignora espacos sobrando", () => {
    expect(iniciais("  maria   clara ")).toBe("MC");
  });

  test("nome vazio vira U", () => {
    expect(iniciais("")).toBe("U");
    expect(iniciais("   ")).toBe("U");
  });
});

describe("lerJson", () => {
  const pedido = (corpo: string) => new Request("http://localhost/api", { method: "POST", body: corpo });

  test("devolve o objeto de um corpo JSON valido", async () => {
    expect(await lerJson(pedido('{"placa":"ABC1D23"}'))).toEqual({ placa: "ABC1D23" });
  });

  test("corpo invalido ou vazio devolve null em vez de derrubar a rota", async () => {
    expect(await lerJson(pedido("nao e json"))).toBeNull();
    expect(await lerJson(pedido(""))).toBeNull();
  });
});
