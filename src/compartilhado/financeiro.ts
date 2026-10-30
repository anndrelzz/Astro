import { fimDoDia, inicioDoDia, instanteNoFuso, partesNoFuso } from "@/compartilhado/fuso";
import type { Prisma } from "@/generated/prisma/client";

// RF12, UC11 — regras do financeiro usadas pela tela e pela exportacao em CSV,
// num lugar so para as duas nunca divergirem.

export type Periodo = "hoje" | "7dias" | "30dias" | "90dias" | "ano";

export const PERIODOS: Periodo[] = ["hoje", "7dias", "30dias", "90dias", "ano"];

export function lerPeriodo(bruto: string | null | undefined): Periodo {
  return PERIODOS.includes(bruto as Periodo) ? (bruto as Periodo) : "30dias";
}

// RF12 — receita conta apenas o que ja foi confirmado. O que aguarda
// pagamento aparece em separado, nunca somado a receita.
export const RECEBIDO = ["CONFIRMADO", "CONCLUIDO"] as const;

export function foiRecebido(status: string) {
  return (RECEBIDO as readonly string[]).includes(status);
}

// Dias contados no relogio da estetica (compartilhado/fuso.ts), nao no do servidor.
const DIAS_ATRAS: Record<Exclude<Periodo, "ano">, number> = {
  hoje: 0,
  "7dias": 6,
  "30dias": 29,
  "90dias": 89,
};

export function janela(periodo: Periodo, agora = new Date()) {
  const fim = fimDoDia(agora);
  const inicio =
    periodo === "ano"
      ? instanteNoFuso(partesNoFuso(agora).ano, 1, 1)
      : inicioDoDia(agora, -DIAS_ATRAS[periodo]);
  return { inicio, fim };
}

// O que entrou de fato: o valor combinado no agendamento mais o acrescimo que o
// Admin lancou na avaliacao presencial. Somar so `valor` fazia o relatorio
// divergir do caixa — uma lavacao combinada por R$ 120,00 e cobrada por
// R$ 156,00 aparecia como R$ 120,00.
export function totalCobrado(a: { valor: Prisma.Decimal; acrescimoAplicado: Prisma.Decimal | null }) {
  return Number(a.valor) + Number(a.acrescimoAplicado ?? 0);
}
