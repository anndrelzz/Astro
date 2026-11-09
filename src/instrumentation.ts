import type { Instrumentation } from "next";

// Roda uma vez, quando o servidor do Next.js sobe. Liga o envio dos rastros,
// das metricas e dos logs de erro para o Grafana Cloud (ver back/telemetria.ts).
// O import fica dentro do if porque o SDK do OpenTelemetry so funciona no
// runtime Node, nao no Edge (guia de OpenTelemetry do Next.js).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ligarTelemetria } = await import("./back/telemetria");
    ligarTelemetria(process.env);
  }
}

// O Next.js chama quando um erro escapa de uma pagina, rota da API ou server
// action: o ponto unico que manda esses erros para o log (back/log-de-erro.ts),
// sem try/catch em cada arquivo. Os cabecalhos (cookie da sessao) nao vao.
export const onRequestError: Instrumentation.onRequestError = async (erro, pedido, contexto) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { registrarFalha } = await import("./back/log-de-erro");
  registrarFalha("[pedido] erro nao tratado", erro, {
    metodo: pedido.method,
    caminho: pedido.path,
    rota: contexto.routePath,
    tipo: contexto.routeType,
  });
};
