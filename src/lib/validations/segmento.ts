import { z } from "zod";

// RN01 revisada — os tipos de veiculo que a estetica atende sao definidos por
// ela (pedido da EstimaCar: nao atende Van, e cobra diferente de picape
// pequena e picape grande).
//
// O nome e o que o cliente final le na hora de cadastrar o carro, entao vale
// apertar: sem espaco sobrando e com limite curto, porque ele vira coluna na
// grade do catalogo e cabecalho no seletor da vitrine.
export const segmentoSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(1, "Informe o nome do tipo de veiculo")
    .max(30, "Nome muito longo - use ate 30 caracteres"),
  ordem: z.coerce.number().int().min(0),
});

// Ao criar um segmento, todos os servicos ficam sem preco para ele. Copiar de
// um segmento existente evita o estado intermediario (segmento criado, catalogo
// incompleto) e poupa o Admin de digitar um preco por servico: ele cria
// "Picape grande" a partir de "Picape pequena" e ajusta o que difere.
export const segmentoNovoSchema = segmentoSchema.extend({
  copiarPrecosDe: z.string().uuid().nullable().optional(),
});

export type SegmentoInput = z.infer<typeof segmentoSchema>;
