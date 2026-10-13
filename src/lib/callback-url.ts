// O callbackUrl chega pela query string, entao qualquer pessoa pode montar um
// link com o valor que quiser. Usado sem conferencia, ele leva o cliente para
// fora do Astro depois de um login legitimo: "//site.com" e "/\site.com"
// comecam com "/" mas o navegador os trata como outro dominio.
//
// So e aceito um caminho dentro da propria estetica: "/<slug>" ou algo abaixo
// dele. O prefixo com o slug ja descarta "//", "/\" e URLs absolutas, porque o
// segundo caractere tem de ser o inicio do slug. Qualquer outro valor devolve
// null e quem chama usa o destino padrao.
export function callbackUrlSeguro(valor: string | null, slug: string): string | null {
  if (!valor) return null;

  const base = `/${slug}`;
  if (valor === base || valor.startsWith(`${base}/`) || valor.startsWith(`${base}?`)) {
    return valor;
  }

  return null;
}
