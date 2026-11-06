import { metrics, trace } from "@opentelemetry/api";
import type { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-node";
import { afterEach, describe, expect, test, vi } from "vitest";

// ExportResultCode.SUCCESS do OpenTelemetry (o enum vem de um pacote que o
// Astro nao usa diretamente).
const SUCESSO = { code: 0 };
import { ExportadorSemSegredos, ligarTelemetria, limparAtributos, telemetriaLigada } from "@/back/telemetria";

// Observabilidade (Playbook, nucleo comum): o Astro manda os rastros de cada
// pagina e rota para o Grafana Cloud por OpenTelemetry. Duas regras:
// - sem o endereco e a chave do Grafana (no computador do dev, por exemplo),
//   a telemetria fica desligada e nada quebra;
// - nenhum dado pessoal ou segredo sai do servidor (LGPD): o endereco do
//   pedido vai sem a parte depois do "?", onde ficam os tokens dos links de
//   e-mail, e sem o "#".

describe("telemetriaLigada", () => {
  const ENDERECO = "https://otlp-gateway-prod-sa-east-1.grafana.net/otlp";
  const CHAVE = "Authorization=Basic abc123";

  test("liga so com o endereco e a chave do Grafana", () => {
    expect(
      telemetriaLigada({ OTEL_EXPORTER_OTLP_ENDPOINT: ENDERECO, OTEL_EXPORTER_OTLP_HEADERS: CHAVE })
    ).toBe(true);
  });

  test("sem um dos dois, fica desligada", () => {
    expect(telemetriaLigada({})).toBe(false);
    expect(telemetriaLigada({ OTEL_EXPORTER_OTLP_ENDPOINT: ENDERECO })).toBe(false);
    expect(telemetriaLigada({ OTEL_EXPORTER_OTLP_HEADERS: CHAVE })).toBe(false);
    expect(telemetriaLigada({ OTEL_EXPORTER_OTLP_ENDPOINT: "  ", OTEL_EXPORTER_OTLP_HEADERS: CHAVE })).toBe(false);
  });

  test("OTEL_SDK_DISABLED=true desliga mesmo com a chave", () => {
    expect(
      telemetriaLigada({
        OTEL_EXPORTER_OTLP_ENDPOINT: ENDERECO,
        OTEL_EXPORTER_OTLP_HEADERS: CHAVE,
        OTEL_SDK_DISABLED: "true",
      })
    ).toBe(false);
  });
});

describe("ligarTelemetria", () => {
  afterEach(() => {
    // Desfaz o registro global, para nenhum outro teste mandar rastros.
    trace.disable();
    metrics.disable();
  });

  test("sem a chave do Grafana, nao liga nada (computador do dev, testes, CI)", () => {
    expect(ligarTelemetria({})).toBe(false);
    expect(ligarTelemetria({ OTEL_EXPORTER_OTLP_ENDPOINT: "https://exemplo" })).toBe(false);
    expect(trace.getTracerProvider().getTracer("astro").startSpan("x").isRecording()).toBe(false);
  });

  test("com a chave, registra quem grava os rastros e as metricas", () => {
    const ligou = ligarTelemetria({
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://127.0.0.1:9",
      OTEL_EXPORTER_OTLP_HEADERS: "Authorization=Basic teste",
      TELEMETRIA_AMBIENTE: "teste",
    });

    expect(ligou).toBe(true);
    // Antes de ligar, o rastro e de mentira (nao grava nada); depois, grava.
    const rastro = trace.getTracer("astro").startSpan("teste");
    expect(rastro.isRecording()).toBe(true);
    rastro.end();
  });
});

describe("ExportadorSemSegredos", () => {
  function rastro(nome: string, atributos: Record<string, unknown>) {
    return { name: nome, attributes: atributos } as unknown as ReadableSpan;
  }

  function destinoFalso() {
    const recebidos: ReadableSpan[] = [];
    const destino: SpanExporter = {
      export: (rastros, aoTerminar) => {
        recebidos.push(...rastros);
        aoTerminar(SUCESSO);
      },
      shutdown: vi.fn(async () => {}),
      forceFlush: vi.fn(async () => {}),
    };
    return { destino, recebidos };
  }

  test("o destino recebe os rastros ja sem os tokens, no nome e nos atributos", () => {
    const { destino, recebidos } = destinoFalso();
    const aoTerminar = vi.fn();

    new ExportadorSemSegredos(destino).export(
      [rastro("GET /demo/redefinir-senha?token=segredo", { "http.target": "/demo/redefinir-senha?token=segredo" })],
      aoTerminar
    );

    expect(recebidos).toHaveLength(1);
    expect(recebidos[0].name).toBe("GET /demo/redefinir-senha");
    expect(recebidos[0].attributes).toEqual({ "http.target": "/demo/redefinir-senha" });
    expect(aoTerminar).toHaveBeenCalledWith(SUCESSO);
  });

  test("desligar e esvaziar a fila passam para o destino", async () => {
    const { destino } = destinoFalso();
    const exportador = new ExportadorSemSegredos(destino);

    await exportador.forceFlush();
    await exportador.shutdown();

    expect(destino.forceFlush).toHaveBeenCalledOnce();
    expect(destino.shutdown).toHaveBeenCalledOnce();
  });

  test("destino sem forceFlush nao quebra", async () => {
    const exportador = new ExportadorSemSegredos({ export: vi.fn(), shutdown: vi.fn(async () => {}) });
    await expect(exportador.forceFlush()).resolves.toBeUndefined();
  });
});

describe("limparAtributos", () => {
  test("tira o token do link de redefinir senha do endereco do pedido", () => {
    const atributos: Record<string, unknown> = {
      "http.target": "/demo/redefinir-senha?token=segredo-do-cliente",
      "http.url": "https://useastro.app.br/demo/redefinir-senha?token=segredo-do-cliente",
      "url.full": "https://useastro.app.br/demo/confirmar-email?token=outro-segredo#topo",
      "url.query": "token=segredo-do-cliente",
    };

    limparAtributos(atributos);

    expect(atributos).toEqual({
      "http.target": "/demo/redefinir-senha",
      "http.url": "https://useastro.app.br/demo/redefinir-senha",
      "url.full": "https://useastro.app.br/demo/confirmar-email",
    });
    expect(JSON.stringify(atributos)).not.toContain("segredo");
  });

  test("mantem o que serve para os graficos: metodo, rota, status e tempo", () => {
    const atributos: Record<string, unknown> = {
      "http.method": "POST",
      "http.route": "/api/agendamentos",
      "http.status_code": 201,
      "next.span_name": "POST /api/agendamentos",
      "http.target": "/api/agendamentos",
    };

    limparAtributos(atributos);

    expect(atributos).toEqual({
      "http.method": "POST",
      "http.route": "/api/agendamentos",
      "http.status_code": 201,
      "next.span_name": "POST /api/agendamentos",
      "http.target": "/api/agendamentos",
    });
  });

  test("tambem limpa o nome do rastro quando ele traz o endereco com ?", () => {
    const atributos: Record<string, unknown> = { "next.span_name": "GET /demo/redefinir-senha?token=x" };
    limparAtributos(atributos);
    expect(atributos["next.span_name"]).toBe("GET /demo/redefinir-senha");
  });
});
