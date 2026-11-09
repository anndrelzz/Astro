// RF13, UC12 — cor primaria da estetica, escolhida pelo Admin na Identidade
// visual. O layout de [slug] aplica a cor de dois jeitos:
// - na caixa que envolve as paginas (style do <div>), como sempre foi;
// - na pagina inteira (:root), com o CSS gerado aqui.
// O segundo existe por causa dos pop-ups desenhados direto no <body> com
// createPortal (aviso "Cadastre seu veiculo primeiro", pop-ups de Agendamentos
// e Perfil): eles ficam fora da caixa, nao herdavam a cor e saiam no azul
// padrao.

export const COR_PADRAO = "#2563eb";

// O mesmo formato que a tela de Identidade aceita (validacoes/tenant.ts).
const COR_HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * CSS que poe a cor da estetica nas variaveis do tema para a pagina inteira.
 * O valor vai para dentro de uma tag <style>, entao so passa uma cor #RRGGBB;
 * qualquer outra coisa vira o azul padrao.
 */
export function cssDaCorDaEstetica(cor: string | null | undefined): string {
  const segura = cor && COR_HEX.test(cor) ? cor : COR_PADRAO;
  return (
    ":root{" +
    `--color-astro-blue:${segura};` +
    `--color-astro-blue-bright:color-mix(in srgb, ${segura} 80%, white 20%)` +
    "}"
  );
}
