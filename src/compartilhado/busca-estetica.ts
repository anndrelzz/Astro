// Busca da estetica pelo nome (pop-up "Entrar" da landing). Regra pura, usada
// pela rota (o que vai para o banco) e pelo pop-up (quando ja vale buscar).

export const MIN_LETRAS_BUSCA = 3;
const MAX_LETRAS_BUSCA = 60;
export const MAX_RESULTADOS_BUSCA = 6;

/** Sem acento e em minusculas: "Estética" vira "estetica". */
export function semAcento(texto: string) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * O termo pronto para o LIKE do banco, ou null quando ainda nao vale buscar
 * (menos de 3 letras) ou e longo demais. % e _ (curingas do LIKE) e a barra
 * de escape viram caracteres comuns, para "%%%" nao trazer todas as esteticas.
 */
export function termoDaBusca(q: string | null) {
  const limpo = semAcento((q ?? "").trim().replace(/\s+/g, " "));
  if (limpo.length < MIN_LETRAS_BUSCA || limpo.length > MAX_LETRAS_BUSCA) return null;
  return limpo.replace(/[\\%_]/g, (c) => `\\${c}`);
}
