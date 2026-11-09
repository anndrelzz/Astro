// Observabilidade (Playbook, nucleo comum; orientador: Grafana) — o Astro
// manda para o Grafana Cloud, por OpenTelemetry, um rastro de cada pagina e
// rota da API (o Next.js ja mede isso sozinho; aqui so ligamos o envio), as
// metricas que o codigo registrar e os logs de erro (back/log-de-erro.ts). O Grafana monta os graficos de pedidos,
// erros e tempo de resposta a partir dos rastros.
//
// O endereco e a chave vem das variaveis padrao do OpenTelemetry
// (OTEL_EXPORTER_OTLP_ENDPOINT e OTEL_EXPORTER_OTLP_HEADERS), configuradas no
// App Service. Sem elas — no computador do dev, nos testes, no CI — nada e
// ligado e nada e enviado.
//
// LGPD: o rastro leva metodo, rota, status e tempo. O endereco do pedido vai
// sem a parte depois do "?" e do "#", porque e ali que ficam os tokens dos
// links de e-mail (redefinir senha, confirmar e-mail). Nenhum dado pessoal
// (nome, e-mail, placa) e anotado nos rastros.

import { metrics } from "@opentelemetry/api";
import { logs } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-proto";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";
import { MeterProvider, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import {
  BatchSpanProcessor,
  NodeTracerProvider,
  type ReadableSpan,
  type SpanExporter,
} from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";

type Ambiente = Record<string, string | undefined>;

export const NOME_DO_SERVICO = "astro";

/** Liga so com o endereco e a chave do Grafana, e se ninguem desligou de proposito. */
export function telemetriaLigada(env: Ambiente): boolean {
  if (env.OTEL_SDK_DISABLED?.trim().toLowerCase() === "true") return false;
  return Boolean(env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim() && env.OTEL_EXPORTER_OTLP_HEADERS?.trim());
}

// Atributos que guardam um endereco (as convencoes antigas e as novas do
// OpenTelemetry) e o nome que o Next.js da ao rastro, que pode trazer o
// endereco cru.
const ATRIBUTOS_COM_ENDERECO = ["http.target", "http.url", "url.full", "url.path", "next.span_name"];
// So existem para guardar o que vem depois do "?": saem inteiros.
const ATRIBUTOS_SO_DE_CONSULTA = ["url.query"];

function semConsulta(valor: string): string {
  return valor.split(/[?#]/, 1)[0];
}

/** Tira a parte depois do "?" e do "#" de todo atributo que guarda um endereco. */
export function limparAtributos(atributos: Record<string, unknown>): void {
  for (const chave of ATRIBUTOS_SO_DE_CONSULTA) delete atributos[chave];
  for (const chave of ATRIBUTOS_COM_ENDERECO) {
    const valor = atributos[chave];
    if (typeof valor === "string") atributos[chave] = semConsulta(valor);
  }
}

// Fica entre o Next.js e o envio: limpa cada rastro antes de ele sair do
// servidor. O rastro ja terminou quando chega aqui, entao mexer nos atributos
// nao muda nada no pedido.
export class ExportadorSemSegredos implements SpanExporter {
  constructor(private readonly destino: SpanExporter) {}

  export(rastros: ReadableSpan[], aoTerminar: Parameters<SpanExporter["export"]>[1]): void {
    for (const rastro of rastros) {
      limparAtributos(rastro.attributes as Record<string, unknown>);
      const editavel = rastro as unknown as { name: string };
      editavel.name = semConsulta(rastro.name);
    }
    this.destino.export(rastros, aoTerminar);
  }

  shutdown(): Promise<void> {
    return this.destino.shutdown();
  }

  forceFlush(): Promise<void> {
    return this.destino.forceFlush?.() ?? Promise.resolve();
  }
}

/** Chamada uma vez, quando o servidor sobe (src/instrumentation.ts). */
export function ligarTelemetria(env: Ambiente): boolean {
  if (!telemetriaLigada(env)) return false;

  const recurso = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: NOME_DO_SERVICO,
    [ATTR_SERVICE_VERSION]: env.npm_package_version ?? "0.1.0",
    // Separa producao de um teste local. TELEMETRIA_AMBIENTE vence o NODE_ENV,
    // para um `next start` no computador do dev nao aparecer como producao.
    "deployment.environment.name":
      env.TELEMETRIA_AMBIENTE?.trim() || (env.NODE_ENV === "production" ? "producao" : "desenvolvimento"),
  });

  // Os exportadores leem o endereco e a chave das variaveis OTEL_EXPORTER_OTLP_*.
  const rastros = new NodeTracerProvider({
    resource: recurso,
    spanProcessors: [new BatchSpanProcessor(new ExportadorSemSegredos(new OTLPTraceExporter()))],
  });
  rastros.register();

  // Logs de erro (back/log-de-erro.ts): vao para o Loki. O log escrito dentro
  // de um pedido leva o id do rastro, e o Grafana liga um ao outro.
  logs.setGlobalLoggerProvider(
    new LoggerProvider({
      resource: recurso,
      processors: [new BatchLogRecordProcessor({ exporter: new OTLPLogExporter() })],
    })
  );

  metrics.setGlobalMeterProvider(
    new MeterProvider({
      resource: recurso,
      readers: [
        new PeriodicExportingMetricReader({ exporter: new OTLPMetricExporter(), exportIntervalMillis: 60_000 }),
      ],
    })
  );

  return true;
}
