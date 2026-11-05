// RN09 — dominio publico do Astro. Cada estetica fica em DOMINIO/<slug>, que e
// o endereco que ela divulga para os clientes (Instagram, WhatsApp, cartao).
//
// Num lugar so: o RFC citava astro.app, que ja tinha dono, e o texto fixo
// ficou espalhado pelas telas. Usado pela tela e pelo servidor.
export const DOMINIO = "useastro.app.br";

export function enderecoDaEstetica(slug: string) {
  return `${DOMINIO}/${slug}`;
}
