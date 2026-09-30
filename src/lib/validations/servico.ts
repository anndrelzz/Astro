import { z } from "zod";

// UC08, RF01 — servico com preco diferenciado por segmento de veiculo.
export const servicoSchema = z.object({
  nome: z.string().min(1, "Informe o nome do servico"),
  // Exibida ao cliente no card do servico. Opcional: servico sem descricao
  // continua valido, so aparece com menos contexto na vitrine.
  descricao: z
    .string()
    .trim()
    .max(280, "Descricao muito longa - use ate 280 caracteres")
    .optional()
    .transform((v) => (v?.length ? v : null)),
  // RN14 — pausado sai da vitrine do cliente, mas preserva o historico.
  ativo: z.coerce.boolean().default(true),
  duracaoMin: z.coerce.number().int().min(5, "Duracao minima de 5 minutos"),
  // Um preco por segmento, no lugar das cinco colunas fixas. A rota exige a
  // lista COMPLETA dos segmentos ativos do tenant (decisao de 29/09: segmento
  // cadastrado e segmento que a estetica atende, entao nao existe combinacao
  // legitimamente sem preco) — isso e conferido la, onde se sabe quais sao.
  precos: z
    .array(
      z.object({
        segmentoId: z.string().uuid(),
        valor: z.coerce.number().min(0, "Preco invalido"),
      })
    )
    .min(1, "Informe o preco para cada tipo de veiculo"),
});

export type ServicoInput = z.infer<typeof servicoSchema>;
