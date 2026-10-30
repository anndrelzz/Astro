import { z } from "zod";
import { partesNoFuso } from "@/compartilhado/fuso";
import { LIMITES } from "@/compartilhado/validacoes/limites";

// Padrao antigo (cinza): LLL-NNNN, ex. ABC-1234 (hifen opcional)
// Padrao Mercosul: LLLNLNN, ex. ABC1D23
const PLACA_ANTIGA = /^[A-Z]{3}-?\d{4}$/;
const PLACA_MERCOSUL = /^[A-Z]{3}\d[A-Z]\d{2}$/;

const placaSchema = z
  .string()
  .transform((valor) => valor.toUpperCase().replace(/[\s-]/g, ""))
  .refine((valor) => PLACA_ANTIGA.test(valor) || PLACA_MERCOSUL.test(valor), {
    message: "Placa invalida - use o formato ABC-1234 ou ABC1D23 (Mercosul)",
  });

export const veiculoSchema = z.object({
  marca: z
    .string()
    .min(1, "Informe a marca")
    .max(LIMITES.marcaVeiculo, `Marca muito longa - use ate ${LIMITES.marcaVeiculo} caracteres`),
  modelo: z
    .string()
    .min(1, "Informe o modelo")
    .max(LIMITES.modeloVeiculo, `Modelo muito longo - use ate ${LIMITES.modeloVeiculo} caracteres`),
  placa: placaSchema,
  // Ate o ano que vem: em outubro ja se vende o "modelo do ano seguinte". O ano
  // atual e lido a cada validacao — calculado uma vez ao carregar o arquivo, ele
  // ficava parado no ano em que o servidor subiu.
  ano: z.coerce
    .number()
    .int()
    .min(1950, "Ano invalido")
    .refine((ano) => ano <= partesNoFuso(new Date()).ano + 1, "Ano invalido"),
  cor: z
    .string()
    .min(1, "Informe a cor")
    .max(LIMITES.corVeiculo, `Cor muito longa - use ate ${LIMITES.corVeiculo} caracteres`),
  // Antes era o enum fixo do sistema. Agora e um segmento do proprio tenant —
  // a rota confere que o id pertence a ele e esta ativo (o RLS ja garante o
  // tenant; o ativo nao).
  segmentoId: z.string().uuid("Escolha o tipo de veiculo"),
});

export type VeiculoInput = z.infer<typeof veiculoSchema>;
