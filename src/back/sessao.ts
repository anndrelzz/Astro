// Prazo da sessao do login (issue #113, RNF07 — expiracao configuravel).
//
// O prazo conta a partir do ULTIMO USO, nao do login: a cada pagina aberta o
// NextAuth renova o token com um prazo novo. Entao "7 dias" quer dizer 7 dias
// sem abrir o Astro — o dono e os funcionarios, que usam o painel todo dia,
// continuam logados; uma conta esquecida aberta num aparelho fecha sozinha.
//
// SESSAO_DIAS muda o prazo sem mexer no codigo (nas configuracoes do App
// Service, em producao). Valor invalido nao derruba o login: volta ao padrao.

export const DIAS_DE_SESSAO_PADRAO = 7;

const DIA_EM_SEGUNDOS = 24 * 60 * 60;

export function segundosDeSessao(valor: string | undefined): number {
  const dias = valor && /^\d+$/.test(valor.trim()) ? Number(valor.trim()) : NaN;
  return (dias > 0 ? dias : DIAS_DE_SESSAO_PADRAO) * DIA_EM_SEGUNDOS;
}
