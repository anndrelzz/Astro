import type { PrecoServico } from "@/generated/prisma/client";

// RF04, RN01 — preco definido pelo segmento do veiculo, nunca digitado pelo
// cliente. Antes era um switch nos cinco valores do enum SegmentoVeiculo; com
// os segmentos definidos por cada estetica (migration 20260929), virou uma
// busca na lista de precos do servico.
//
// Devolve null quando nao existe preco daquele servico para aquele segmento.
// Pela decisao de 29/09 isso nao deveria acontecer — todo servico tem preco
// para todo segmento ativo — mas pode acontecer numa janela real: o Admin
// acabou de criar um segmento e ainda nao precificou os servicos. Quem chama
// decide o que fazer; o que nao pode e inventar um valor.
export function calcularPreco(
  precos: Pick<PrecoServico, "segmentoId" | "valor">[],
  segmentoId: string
) {
  return precos.find((p) => p.segmentoId === segmentoId)?.valor ?? null;
}
