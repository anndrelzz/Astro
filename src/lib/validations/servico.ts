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
  precoHatch: z.coerce.number().min(0, "Preco invalido"),
  precoSedan: z.coerce.number().min(0, "Preco invalido"),
  precoSuv: z.coerce.number().min(0, "Preco invalido"),
  precoPickup: z.coerce.number().min(0, "Preco invalido"),
  precoVan: z.coerce.number().min(0, "Preco invalido"),
});

export type ServicoInput = z.infer<typeof servicoSchema>;
