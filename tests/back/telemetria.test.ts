import { describe, expect, test } from "vitest";
import { ligarTelemetria, limparAtributos, telemetriaLigada } from "@/back/telemetria";

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
  test("sem a chave do Grafana, nao liga nada (computador do dev, testes, CI)", () => {
    expect(ligarTelemetria({})).toBe(false);
    expect(ligarTelemetria({ OTEL_EXPORTER_OTLP_ENDPOINT: "https://exemplo" })).toBe(false);
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
