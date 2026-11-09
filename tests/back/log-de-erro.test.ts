import { logs, SeverityNumber } from "@opentelemetry/api-logs";
import { InMemoryLogRecordExporter, LoggerProvider, SimpleLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { limparTexto, montarRegistroDeFalha, registrarFalha } from "@/back/log-de-erro";

// Log de erro (observabilidade, Playbook): o rastro diz QUE deu erro 500 e
// onde; o log diz QUAL foi o erro. Ele vai para o Loki do Grafana Cloud pelo
// mesmo OpenTelemetry dos rastros. LGPD: nenhum e-mail, endereco do banco,
// token ou parte do endereco depois do "?" sai do servidor.

describe("limparTexto", () => {
  test("troca e-mail por [e-mail]", () => {
    expect(limparTexto("Unique constraint failed: maria.souza@gmail.com ja existe")).toBe(
      "Unique constraint failed: [e-mail] ja existe"
    );
  });

  test("troca o endereco do banco (com usuario e senha) por [banco]", () => {
    expect(limparTexto("Can't reach postgresql://astro_app:S3nh4@astro-db.postgres.database.azure.com:5432/astro")).toBe(
      "Can't reach [banco]"
    );
  });

  test("troca token longo (link de e-mail, chave) por [token]", () => {
    expect(limparTexto("token invalido: 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08")).toBe(
      "token invalido: [token]"
    );
  });

  test("tira a parte depois do ? dos enderecos do proprio site", () => {
    expect(limparTexto("falhou em /demo/redefinir-senha?token=abc&x=1 agora")).toBe(
      "falhou em /demo/redefinir-senha agora"
    );
  });

  test("texto sem nada sensivel passa igual", () => {
    expect(limparTexto("Cannot read properties of null (reading 'id')")).toBe(
      "Cannot read properties of null (reading 'id')"
    );
  });
});

describe("montarRegistroDeFalha", () => {
  test("leva a mensagem, o tipo e a pilha do erro, ja limpos", () => {
    const erro = new TypeError("Cannot read properties of null (reading 'id') de joao@teste.com");
    erro.stack = "TypeError: ...\n    at calcularSlots (src/back/slots.ts:84:12)";

    const registro = montarRegistroDeFalha("api", erro);

    expect(registro.body).toBe("api: Cannot read properties of null (reading 'id') de [e-mail]");
    expect(registro.attributes).toMatchObject({
      "astro.onde": "api",
      "exception.type": "TypeError",
      "exception.message": "Cannot read properties of null (reading 'id') de [e-mail]",
      "exception.stacktrace": "TypeError: ...\n    at calcularSlots (src/back/slots.ts:84:12)",
    });
  });

  test("com o pedido, leva o metodo, o endereco sem o ? e a rota do Next.js", () => {
    const registro = montarRegistroDeFalha("pedido", new Error("falhou"), {
      metodo: "POST",
      caminho: "/demo/confirmar-email?token=segredo",
      rota: "/[slug]/confirmar-email",
      tipo: "render",
    });

    expect(registro.attributes).toMatchObject({
      "http.request.method": "POST",
      "url.path": "/demo/confirmar-email",
      "next.route": "/[slug]/confirmar-email",
      "next.route_type": "render",
    });
    expect(JSON.stringify(registro)).not.toContain("segredo");
  });

  test("o digest do React (erro de Server Component) vai junto, para achar o erro no log", () => {
    const erro = Object.assign(new Error("An error occurred in the Server Components render."), { digest: "123456" });
    expect(montarRegistroDeFalha("pedido", erro).attributes["next.digest"]).toBe("123456");
  });

  test("algo que nao e Error (um texto lancado) tambem vira registro", () => {
    const registro = montarRegistroDeFalha("api", "deu ruim com ana@x.com");
    expect(registro.body).toBe("api: deu ruim com [e-mail]");
    expect(registro.attributes["exception.type"]).toBe("desconhecido");
  });
});

describe("registrarFalha", () => {
  let exportador: InMemoryLogRecordExporter;

  beforeEach(() => {
    exportador = new InMemoryLogRecordExporter();
    logs.setGlobalLoggerProvider(new LoggerProvider({ processors: [new SimpleLogRecordProcessor(exportador)] }));
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    logs.disable();
    vi.restoreAllMocks();
  });

  test("manda um registro de ERRO para o Grafana, ja limpo", () => {
    registrarFalha("[login] falha inesperada", new Error("Can't reach postgresql://u:p@db:5432/astro"));

    const [registro] = exportador.getFinishedLogRecords();
    expect(registro.severityNumber).toBe(SeverityNumber.ERROR);
    expect(registro.severityText).toBe("ERROR");
    expect(registro.body).toBe("[login] falha inesperada: Can't reach [banco]");
  });

  test("continua escrevendo no terminal do servidor (Log stream da Azure)", () => {
    const erro = new Error("falhou");
    registrarFalha("[login] falha inesperada", erro);
    expect(console.error).toHaveBeenCalledWith("[login] falha inesperada", erro);
  });

  test("sem o Grafana ligado (dev, testes, CI), nao quebra", () => {
    logs.disable();
    expect(() => registrarFalha("api", new Error("x"))).not.toThrow();
  });
});
