// Limite de tentativas no login (issue #107). Fica em compartilhado porque o
// back usa os numeros para bloquear e a tela usa o codigo e os minutos para
// explicar ao cliente o que aconteceu.

/** Tentativas seguidas sem acertar a senha antes de bloquear. */
export const MAX_TENTATIVAS_LOGIN = 5;

/** Quanto tempo o login fica bloqueado depois da ultima tentativa permitida. */
export const MINUTOS_BLOQUEIO_LOGIN = 15;

/**
 * Codigo que o login devolve quando a conta esta bloqueada. O NextAuth repassa
 * a mensagem do erro lancado no `authorize` para o `signIn` da tela.
 */
export const LOGIN_BLOQUEADO = "LOGIN_BLOQUEADO";

/**
 * Codigo que o login devolve quando algo falha no servidor (banco fora do ar,
 * por exemplo). No lugar da mensagem original, que traria a consulta e os
 * nomes das tabelas para a tela e para o endereco do erro.
 */
export const LOGIN_INDISPONIVEL = "LOGIN_INDISPONIVEL";
