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
//
// R$ 0 tambem conta como "sem preco": e o valor provisorio que um segmento
// novo recebe em todos os servicos quando nao copia os precos de outro (rota
// de segmentos), e nao um preco que a estetica combinou. Sem isso o cliente
// agendava de graca ate o Admin preencher a tabela.
export function calcularPreco(
  precos: Pick<PrecoServico, "segmentoId" | "valor">[],
  segmentoId: string
) {
  const valor = precos.find((p) => p.segmentoId === segmentoId)?.valor;
  return valor && valor.gt(0) ? valor : null;
}
