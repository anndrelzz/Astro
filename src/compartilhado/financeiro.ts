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

// Ainda nao pago: o que o cliente deve na hora do servico (local) ou o PIX
// que o Admin ainda nao confirmou.
export const A_RECEBER = ["PIX_PENDENTE", "PENDENTE_PAGAMENTO"] as const;

// Regime de caixa: o que entrou conta no dia em que o pagamento foi
// confirmado, e nao no dia do servico. Um PIX pago hoje para a semana que vem
// e dinheiro que ja esta na conta da estetica, e o painel precisa bater com o
// extrato do banco. Sem pagoEm (pago antes desta regra), vale o dia do servico.
export function dataDoRecebimento(a: { dataHora: Date; pagoEm: Date | null }) {
  return a.pagoEm ?? a.dataHora;
}

type Intervalo = { inicio: Date; fim: Date };
const dentro = (d: Date, { inicio, fim }: Intervalo) => d >= inicio && d <= fim;

type AgendamentoFinanceiro = {
  status: string;
  dataHora: Date;
  pagoEm: Date | null;
  valor: Prisma.Decimal;
  acrescimoAplicado: Prisma.Decimal | null;
};

// Pago, e pago dentro do periodo.
export function recebidoNoPeriodo(a: AgendamentoFinanceiro, periodo: Intervalo) {
  return foiRecebido(a.status) && dentro(dataDoRecebimento(a), periodo);
}

// Ainda a receber, de um servico dentro do periodo.
export function pendenteNoPeriodo(a: AgendamentoFinanceiro, periodo: Intervalo) {
  return (A_RECEBER as readonly string[]).includes(a.status) && dentro(a.dataHora, periodo);
}

// Resumo de um periodo do painel. O recebido vai ate `fimRecebido` (hoje: nao
// existe pagamento no futuro). O a receber e os atendimentos seguem o dia do
// servico e vao ate `fimAReceber`, que no mes e o ultimo dia dele: o dono ve o
// que ja esta marcado para o mes inteiro.
export function resumoDoPeriodo(
  agendamentos: AgendamentoFinanceiro[],
  { inicio, fimRecebido, fimAReceber }: { inicio: Date; fimRecebido: Date; fimAReceber: Date }
) {
  const recebidos = agendamentos.filter((a) => recebidoNoPeriodo(a, { inicio, fim: fimRecebido }));
  const pendentes = agendamentos.filter((a) => pendenteNoPeriodo(a, { inicio, fim: fimAReceber }));
  const atendimentos = agendamentos.filter(
    (a) => a.status !== "CANCELADO" && dentro(a.dataHora, { inicio, fim: fimAReceber })
  );
  return {
    recebido: recebidos.reduce((s, a) => s + totalCobrado(a), 0),
    pagos: recebidos.length,
    aReceber: pendentes.reduce((s, a) => s + Number(a.valor), 0),
    atendimentos: atendimentos.length,
  };
}

// Busca do financeiro: o que foi atendido OU pago no periodo. So pela data do
// servico, o PIX pago hoje para um servico futuro ficava de fora.
export function filtroDoPeriodo(tenantId: string, inicio: Date, fim: Date) {
  return {
    tenantId,
    status: { not: "CANCELADO" as const },
    OR: [{ dataHora: { gte: inicio, lte: fim } }, { pagoEm: { gte: inicio, lte: fim } }],
  };
}
