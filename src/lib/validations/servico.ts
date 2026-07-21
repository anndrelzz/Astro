import { z } from "zod";

// UC08, RF01 — servico com preco diferenciado por segmento de veiculo.
export const servicoSchema = z.object({
  nome: z.string().min(1, "Informe o nome do servico"),
  duracaoMin: z.coerce.number().int().min(5, "Duracao minima de 5 minutos"),
  precoHatch: z.coerce.number().min(0, "Preco invalido"),
  precoSedan: z.coerce.number().min(0, "Preco invalido"),
  precoSuv: z.coerce.number().min(0, "Preco invalido"),
  precoPickup: z.coerce.number().min(0, "Preco invalido"),
  precoVan: z.coerce.number().min(0, "Preco invalido"),
});

export type ServicoInput = z.infer<typeof servicoSchema>;
