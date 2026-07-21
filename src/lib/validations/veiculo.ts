import { z } from "zod";

const anoAtual = new Date().getFullYear();

export const veiculoSchema = z.object({
  marca: z.string().min(1, "Informe a marca"),
  modelo: z.string().min(1, "Informe o modelo"),
  placa: z.string().min(7, "Placa invalida").max(8, "Placa invalida"),
  ano: z.coerce
    .number()
    .int()
    .min(1950, "Ano invalido")
    .max(anoAtual + 1, "Ano invalido"),
  cor: z.string().min(1, "Informe a cor"),
  segmento: z.enum(["HATCH", "SEDAN", "SUV", "PICKUP", "VAN"]),
});

export type VeiculoInput = z.infer<typeof veiculoSchema>;
