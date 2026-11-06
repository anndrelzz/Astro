// Roda uma vez, quando o servidor do Next.js sobe. Liga o envio dos rastros e
// das metricas para o Grafana Cloud (ver back/telemetria.ts). O import fica
// dentro do if porque o SDK do OpenTelemetry so funciona no runtime Node, nao
// no Edge (guia de OpenTelemetry do Next.js).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ligarTelemetria } = await import("./back/telemetria");
    ligarTelemetria(process.env);
  }
}
