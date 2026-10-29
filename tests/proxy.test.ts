import { getToken } from "next-auth/jwt";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import proxy, { config } from "@/proxy";

// RN02 — telas da estetica so com login; quem nao entrou vai para o login
// DAQUELA estetica, e volta para onde estava depois de entrar.

vi.mock("next-auth/jwt", () => ({ getToken: vi.fn() }));

const token = vi.mocked(getToken);
const abrir = (caminho: string) => proxy(new NextRequest(`http://localhost${caminho}`));

beforeEach(() => {
  token.mockReset();
});

describe("proxy", () => {
  test("rotas de API passam direto (cada uma confere a propria sessao)", async () => {
    const resposta = await abrir("/api/veiculos");
    expect(resposta.headers.get("x-middleware-next")).toBe("1");
    expect(token).not.toHaveBeenCalled();
  });

  test("com login, a tela abre", async () => {
    token.mockResolvedValue({ userId: "u1", tenantId: "t1", role: "CLIENTE" });
    const resposta = await abrir("/estimacar/historico");
    expect(resposta.headers.get("x-middleware-next")).toBe("1");
  });

  test("sem login, vai para o login da mesma estetica e guarda o destino", async () => {
    token.mockResolvedValue(null);
    const resposta = await abrir("/estimacar/agendar/123");
    expect(resposta.status).toBe(307);
    const destino = new URL(resposta.headers.get("location")!);
    expect(destino.pathname).toBe("/estimacar/login");
    expect(destino.searchParams.get("callbackUrl")).toBe("/estimacar/agendar/123");
  });

  test("protege as telas de agendamento, garagem, historico, perfil e Admin", () => {
    expect(config.matcher).toEqual(
      expect.arrayContaining(["/:slug/agendar/:path*", "/:slug/historico/:path*", "/:slug/admin/:path*"])
    );
  });
});
