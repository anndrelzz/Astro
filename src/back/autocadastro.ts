import "server-only";
import { createHmac } from "node:crypto";
import { prisma } from "@/back/prisma";

// Autocadastro da estetica (tela /start) — protecao contra cadastro em massa
// (decisao do Andre, 06/11): no maximo MAX_CADASTROS_POR_HORA esteticas por
// conexao por hora. Junto com o campo escondido da rota, segura o robo sem
// atrapalhar o dono de verdade com captcha.
//
// LGPD: o IP nao e guardado. Fica so um resumo (HMAC-SHA-256 com o segredo do
// NextAuth), que permite saber se dois cadastros vieram da mesma conexao, mas
// nao de onde.

export { criarEstetica, EnderecoEmUso, SEGMENTOS_INICIAIS } from "@/back/criar-estetica";

export const MAX_CADASTROS_POR_HORA = 5;

/**
 * Cadastro de CLIENTE (api/auth/cadastro): contas por hora da mesma conexao,
 * em cada estetica. Mais folgado que o da estetica porque varios clientes
 * podem se cadastrar pelo Wi-Fi da propria estetica no mesmo dia.
 */
export const MAX_CADASTROS_CLIENTE_POR_HORA = 10;

/**
 * Primeiro IP do X-Forwarded-For (o App Service da Azure o preenche, as vezes
 * com a porta: "203.0.113.5:51234"). Sem o cabecalho — no computador do dev —
 * todos os pedidos contam como a mesma conexao.
 */
export function ipDoPedido(request: Request): string {
  const primeiro = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  // IPv6 entre colchetes, com ou sem porta: "[2001:db8::1]:443".
  const ipv6 = primeiro.match(/^\[([^\]]+)\]/);
  if (ipv6) return ipv6[1];
  // IPv4 com porta. Um IPv6 sem colchetes tem varios ":" e fica como esta.
  if (/^[\d.]+:\d+$/.test(primeiro)) return primeiro.split(":")[0];
  return primeiro || "local";
}

export function resumoDaConexao(request: Request): string {
  return createHmac("sha256", process.env.NEXTAUTH_SECRET ?? "astro").update(ipDoPedido(request)).digest("hex");
}

/** Esteticas criadas por essa conexao na ultima hora. */
export function cadastrosRecentes(cadastroIpHash: string, agora = new Date()) {
  return prisma.tenant.count({
    where: { cadastroIpHash, criadoEm: { gt: new Date(agora.getTime() - 60 * 60 * 1000) } },
  });
}
