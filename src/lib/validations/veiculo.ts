import { z } from "zod";

const anoAtual = new Date().getFullYear();

// Padrao antigo (cinza): LLL-NNNN, ex. ABC-1234 (hifen opcional)
// Padrao Mercosul: LLLNLNN, ex. ABC1D23
const PLACA_ANTIGA = /^[A-Z]{3}-?\d{4}$/;
const PLACA_MERCOSUL = /^[A-Z]{3}\d[A-Z]\d{2}$/;

const placaSchema = z
  .string()
  .transform((valor) => valor.toUpperCase().replace(/\s/g, ""))
  .refine((valor) => PLACA_ANTIGA.test(valor) || PLACA_MERCOSUL.test(valor), {
    message: "Placa invalida - use o formato ABC-1234 ou ABC1D23 (Mercosul)",
  });

export const veiculoSchema = z.object({
  marca: z.string().min(1, "Informe a marca"),
  modelo: z.string().min(1, "Informe o modelo"),
  placa: placaSchema,
  ano: z.coerce
    .number()
    .int()
    .min(1950, "Ano invalido")
    .max(anoAtual + 1, "Ano invalido"),
  cor: z.string().min(1, "Informe a cor"),
  segmento: z.enum(["HATCH", "SEDAN", "SUV", "PICKUP", "VAN"]),
});

export type VeiculoInput = z.infer<typeof veiculoSchema>;
