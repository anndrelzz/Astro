import { afterEach, describe, expect, test, vi } from "vitest";

// onRequestError (instrumentation.ts): o Next.js chama quando um erro escapa
// de uma pagina, rota da API ou server action. E o ponto unico que manda
// esses erros para o log, sem precisar de try/catch em cada arquivo.

vi.mock("@/back/log-de-erro", () => ({ registrarFalha: vi.fn() }));

import { registrarFalha } from "@/back/log-de-erro";
import { onRequestError } from "@/instrumentation";

const PEDIDO = { path: "/demo/historico?aba=cancelados", method: "GET", headers: { cookie: "sessao=segredo" } };
const CONTEXTO = {
  routerKind: "App Router",
  routePath: "/[slug]/historico",
  routeType: "render",
  renderSource: "server-rendering",
  revalidateReason: undefined,
  renderType: "dynamic",
} as const;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.mocked(registrarFalha).mockReset();
});

describe("onRequestError", () => {
  test("no servidor Node, registra a falha com o metodo, o endereco e a rota (sem os cabecalhos)", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    const erro = new Error("falhou");

    await onRequestError(erro, PEDIDO, CONTEXTO);

    expect(registrarFalha).toHaveBeenCalledWith("[pedido] erro nao tratado", erro, {
      metodo: "GET",
      caminho: "/demo/historico?aba=cancelados",
      rota: "/[slug]/historico",
      tipo: "render",
    });
    // O cookie da sessao nao vai para o log.
    expect(JSON.stringify(vi.mocked(registrarFalha).mock.calls)).not.toContain("segredo");
  });

  test("fora do Node (Edge), nao tenta carregar o OpenTelemetry", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");
    await onRequestError(new Error("x"), PEDIDO, CONTEXTO);
    expect(registrarFalha).not.toHaveBeenCalled();
  });
});
