// Log de erro (observabilidade, Playbook): o rastro diz QUE um pedido deu
// erro e onde; o log diz QUAL foi o erro (mensagem e linha do codigo). Ele vai
// para o Loki do Grafana Cloud pelo mesmo OpenTelemetry dos rastros (ver
// back/telemetria.ts). Sem o Grafana ligado (dev, testes, CI), o registro cai
// num logger que nao faz nada, e so o terminal recebe o erro.
//
// LGPD: antes de sair do servidor, a mensagem e a pilha passam por
// limparTexto, que tira e-mail, endereco do banco (com usuario e senha), token
// e a parte depois do "?" dos enderecos.
//
// Sem "server-only": o instrumentation.ts carrega este arquivo.

import { logs, SeverityNumber, type LogAttributes } from "@opentelemetry/api-logs";

/** O pedido em que o erro aconteceu, quando ha um (ver instrumentation.ts). */
export type PedidoDaFalha = {
  metodo: string;
  caminho: string;
  rota: string;
  tipo: string;
};

const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
const ENDERECO_DO_BANCO = /postgres(ql)?:\/\/\S+/gi;
const TOKEN = /\b[A-Za-z0-9_-]{32,}\b/g;
const CONSULTA_DO_ENDERECO = /(\/[^\s?#]*)[?#]\S*/g;

/** Tira do texto o que nao pode sair do servidor (LGPD e segredos). */
export function limparTexto(texto: string): string {
  return texto
    .replace(ENDERECO_DO_BANCO, "[banco]")
    .replace(EMAIL, "[e-mail]")
    .replace(TOKEN, "[token]")
    .replace(CONSULTA_DO_ENDERECO, "$1");
}

/** Monta o registro que vai para o Loki: texto principal e atributos para filtrar. */
export function montarRegistroDeFalha(
  onde: string,
  erro: unknown,
  pedido?: PedidoDaFalha
): { body: string; attributes: LogAttributes } {
  const eErro = erro instanceof Error;
  const mensagem = limparTexto(eErro ? erro.message : String(erro));
  const attributes: LogAttributes = {
    "astro.onde": onde,
    "exception.type": eErro ? erro.name : "desconhecido",
    "exception.message": mensagem,
  };
  if (eErro && erro.stack) attributes["exception.stacktrace"] = limparTexto(erro.stack);
  // Erro de Server Component: o React troca a mensagem e deixa um codigo
  // (digest), o mesmo que aparece no terminal com o erro original.
  if (typeof erro === "object" && erro !== null && "digest" in erro) {
    attributes["next.digest"] = String((erro as { digest: unknown }).digest);
  }
  if (pedido) {
    attributes["http.request.method"] = pedido.metodo;
    attributes["url.path"] = pedido.caminho.split(/[?#]/, 1)[0];
    attributes["next.route"] = pedido.rota;
    attributes["next.route_type"] = pedido.tipo;
  }
  return { body: `${onde}: ${mensagem}`, attributes };
}

/** Escreve o erro no terminal e manda para o Grafana, ja limpo. */
export function registrarFalha(onde: string, erro: unknown, pedido?: PedidoDaFalha): void {
  console.error(onde, erro);
  const { body, attributes } = montarRegistroDeFalha(onde, erro, pedido);
  logs.getLogger("astro").emit({ severityNumber: SeverityNumber.ERROR, severityText: "ERROR", body, attributes });
}
