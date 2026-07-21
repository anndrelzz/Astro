import { z } from "zod";

const corHexRegex = /^#([0-9a-fA-F]{6})$/;

// RF17, RF18, RN06, RF13 — configuracoes gerais da estetica.
export const tenantConfigSchema = z.object({
  pixChaveCopiaCola: z.string().trim().nullable(),
  cancelamentoHorasLimite: z.coerce.number().int().min(0, "Valor invalido"),
  capacidadeSimultanea: z.coerce.number().int().min(1, "Minimo de 1"),
  intervaloMinutos: z.coerce.number().int().min(5, "Minimo de 5 minutos"),
  corPrimaria: z.string().regex(corHexRegex, "Cor invalida - use o formato #RRGGBB"),
});

const horaRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

// RF02 — grade semanal recorrente; dia sem "ativo" = estetica fechada nesse dia.
export const horarioDiaSchema = z
  .object({
    diaSemana: z.number().int().min(0).max(6),
    ativo: z.boolean(),
    horaInicio: z.string().regex(horaRegex, "Horario invalido"),
    horaFim: z.string().regex(horaRegex, "Horario invalido"),
  })
  .refine((v) => !v.ativo || v.horaInicio < v.horaFim, {
    message: "Horario de fechamento deve ser depois do de abertura",
    path: ["horaFim"],
  });

export const horariosSchema = z.array(horarioDiaSchema).length(7);

export type TenantConfigInput = z.infer<typeof tenantConfigSchema>;
export type HorarioDiaInput = z.infer<typeof horarioDiaSchema>;
