import { z } from "zod";

const corHexRegex = /^#([0-9a-fA-F]{6})$/;

// Campo de texto opcional: string vazia vira null, para nao gravar "" no banco
// e o site publico poder testar so a existencia do valor.
const textoOpcional = (max = 120) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v?.length ? v : null));

const telefoneOpcional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v.replace(/\D/g, "") : ""))
  .refine((v) => v === "" || v.length === 10 || v.length === 11, {
    message: "Telefone invalido - informe DDD + numero (10 ou 11 digitos)",
  })
  .transform((v) => (v.length ? v : null));

// UC13, UC14, RF13, RF17, RF18, RN06 — configuracoes gerais da estetica.
//
// Todos os campos sao opcionais (atualizacao parcial): a tela salva por secao,
// e o que nao vier no corpo permanece intocado no banco.
//
// O slug NAO entra aqui de proposito: RN09 o define como imutavel apos o
// cadastro. Alterar quebraria todos os links que a estetica ja divulgou.
export const tenantConfigSchema = z
  .object({
    nome: z.string().trim().min(1, "Informe o nome da estetica").max(120),
    descricao: textoOpcional(280),

    telefone: telefoneOpcional,
    whatsapp: telefoneOpcional,
    emailContato: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v?.length ? v : null))
      .refine((v) => v === null || z.string().email().safeParse(v).success, {
        message: "E-mail invalido",
      }),

    cep: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v.replace(/\D/g, "") : ""))
      .refine((v) => v === "" || v.length === 8, {
        message: "CEP invalido - informe 8 digitos",
      })
      .transform((v) => (v.length ? v : null)),
    rua: textoOpcional(160),
    numero: textoOpcional(20),
    bairro: textoOpcional(80),
    cidade: textoOpcional(80),
    estado: z
      .string()
      .trim()
      .toUpperCase()
      .optional()
      .transform((v) => (v?.length ? v : null))
      .refine((v) => v === null || /^[A-Z]{2}$/.test(v), {
        message: "Estado invalido - use a sigla de 2 letras",
      }),

    pixChaveCopiaCola: z.string().trim().nullable(),
    cancelamentoHorasLimite: z.coerce.number().int().min(0, "Valor invalido"),
    capacidadeSimultanea: z.coerce.number().int().min(1, "Minimo de 1"),
    intervaloMinutos: z.coerce.number().int().min(5, "Minimo de 5 minutos"),
    corPrimaria: z.string().regex(corHexRegex, "Cor invalida - use o formato #RRGGBB"),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: "Informe ao menos um campo para atualizar",
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
