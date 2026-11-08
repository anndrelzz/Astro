// Autocadastro (decisao do orientador, 30/10; detalhes do Andre, 06/11) — o
// endereco do site da estetica: useastro.app.br/<endereco>. E o `slug` do
// banco.
//
// O dono escolhe como quiser, com ou sem hifen, porque e ele quem divulga o
// link. O sistema so garante duas coisas: que o link funciona em qualquer
// celular (minusculas, sem acento nem espaco) e que ele nao engole uma pagina
// do proprio Astro. Depois do cadastro o endereco nao muda: os links ja
// divulgados e os dos e-mails enviados quebrariam.
//
// Regra pura: usada pela rota (o que vai para o banco) e pela tela /start
// (o aviso enquanto o dono digita).

import { semAcento } from "./busca-estetica";

export const MIN_LETRAS_ENDERECO = 3;
export const MAX_LETRAS_ENDERECO = 40;

// Enderecos que ja sao do Astro: as rotas da raiz do site e as pastas de
// public/ (o teste endereco-estetica.test.ts confere as duas listas). Os
// demais sao reservados para paginas que o Astro possa ganhar.
export const ENDERECOS_PROIBIDOS = [
  // Rotas e pastas que existem hoje.
  "api",
  "admin",
  "start",
  "login",
  "email",
  "landing",
  "uploads",
  // Reservados.
  "app",
  "www",
  "astro",
  "entrar",
  "sair",
  "cadastro",
  "conta",
  "ajuda",
  "suporte",
  "contato",
  "planos",
  "precos",
  "termos",
  "privacidade",
  "blog",
  "status",
  "static",
  "public",
  "assets",
  "robots",
  "sitemap",
] as const;

export type ProblemaNoEndereco = "curto" | "longo" | "invalido" | "proibido";

const FORMATO = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** O que o dono digitou, pronto para virar link: "Estética-do--João-" vira "estetica-do-joao". */
export function normalizarEndereco(texto: string): string {
  return semAcento(texto)
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * O mesmo, enquanto o dono digita no campo: o hifen do fim fica, porque pode
 * vir mais uma palavra depois ("joao-" a caminho de "joao-car"). O servidor
 * normaliza de novo com normalizarEndereco, que tira esse hifen.
 */
export function enderecoEnquantoDigita(texto: string): string {
  return semAcento(texto)
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+/, "")
    .slice(0, MAX_LETRAS_ENDERECO);
}

/** Sugestao a partir do nome, sem hifen: "Estética do João" vira "esteticadojoao". */
export function sugerirEndereco(nomeDaEstetica: string): string {
  return normalizarEndereco(nomeDaEstetica.replace(/-/g, "")).slice(0, MAX_LETRAS_ENDERECO);
}

/** null quando o endereco (ja normalizado) pode ser usado. Nao consulta o banco. */
export function problemaNoEndereco(endereco: string): ProblemaNoEndereco | null {
  if (endereco.length < MIN_LETRAS_ENDERECO) return "curto";
  if (endereco.length > MAX_LETRAS_ENDERECO) return "longo";
  if (!FORMATO.test(endereco)) return "invalido";
  if ((ENDERECOS_PROIBIDOS as readonly string[]).includes(endereco)) return "proibido";
  return null;
}

// Aparecem na tela /start, embaixo do campo: por isso com acento.
export const MENSAGEM_DO_PROBLEMA: Record<ProblemaNoEndereco | "em-uso", string> = {
  curto: `Use pelo menos ${MIN_LETRAS_ENDERECO} letras ou números`,
  longo: `Use no máximo ${MAX_LETRAS_ENDERECO} letras ou números`,
  invalido: "Use só letras minúsculas, números e hífen",
  proibido: "Esse endereço é reservado pelo Astro. Escolha outro",
  "em-uso": "Esse endereço já é de outra estética. Escolha outro",
};
