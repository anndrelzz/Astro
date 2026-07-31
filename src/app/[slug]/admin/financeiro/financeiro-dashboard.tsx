"use client";

import { useRouter } from "next/navigation";
import { CalendarDays, Clock, Receipt, TrendingUp, Wallet } from "lucide-react";
import { AdminHeader } from "../admin-header";
import {
  BarraDivisao,
  BarrasHorizontais,
  ColunasPorDia,
  Minilinha,
  formatarReal,
} from "./graficos";

// RF12, UC11 — dashboard financeiro.

export type Periodo = "hoje" | "7dias" | "30dias" | "90dias" | "ano";

const PERIODOS: { valor: Periodo; rotulo: string }[] = [
  { valor: "hoje", rotulo: "Hoje" },
  { valor: "7dias", rotulo: "7 dias" },
  { valor: "30dias", rotulo: "30 dias" },
  { valor: "90dias", rotulo: "90 dias" },
  { valor: "ano", rotulo: "Este ano" },
];

function dataCurta(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function FinanceiroDashboard({
  slug,
  periodo,
  inicioISO,
  fimISO,
  receitaTotal,
  receitaAnterior,
  ticketMedio,
  recebidoPix,
  aReceber,
  atendimentos,
  pendentesQtd,
  serieDiaria,
  porServico,
  porCliente,
  pagamentoPix,
  pagamentoLocal,
}: {
  slug: string;
  periodo: Periodo;
  inicioISO: string;
  fimISO: string;
  receitaTotal: number;
  receitaAnterior: number;
  ticketMedio: number;
  recebidoPix: number;
  aReceber: number;
  atendimentos: number;
  pendentesQtd: number;
  serieDiaria: { dia: string; recebido: number; pendente: number }[];
  porServico: { nome: string; receita: number; qtd: number }[];
  porCliente: { nome: string; receita: number; visitas: number }[];
  pagamentoPix: number;
  pagamentoLocal: number;
}) {
  const router = useRouter();

  const variacao =
    receitaAnterior > 0
      ? Math.round(((receitaTotal - receitaAnterior) / receitaAnterior) * 100)
      : null;

  const pctPix = receitaTotal > 0 ? (recebidoPix / receitaTotal) * 100 : 0;

  // A minilinha usa os ultimos 12 pontos — ela mostra tendencia, nao leitura
  // exata; os valores precisos ficam no grafico grande e na visao em tabela.
  const ultimos = serieDiaria.slice(-12).map((d) => d.recebido);

  return (
    <div>
      <AdminHeader
        trilha={`Financeiro · ${dataCurta(inicioISO)} → ${dataCurta(fimISO)}`}
        titulo="Receita e pagamentos"
      />

      {/* Um filtro so, acima de tudo que ele afeta */}
      <div className="mb-5 inline-flex flex-wrap items-center gap-1 rounded-lg border border-admin-border bg-admin-surface p-1">
        <CalendarDays className="ml-2 h-4 w-4 shrink-0 text-astro-muted" />
        {PERIODOS.map((p) => (
          <button
            key={p.valor}
            onClick={() => router.push(`/${slug}/admin/financeiro?periodo=${p.valor}`)}
            className={
              periodo === p.valor
                ? "rounded-md bg-astro-blue/35 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-inset ring-astro-blue-bright/50"
                : "rounded-md px-3 py-1.5 text-xs text-astro-muted transition hover:text-white"
            }
          >
            {p.rotulo}
          </button>
        ))}
      </div>

      {/* Indicadores */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador
          rotulo="Receita total"
          valor={formatarReal(receitaTotal)}
          icone={<Wallet className="h-4 w-4" />}
          variacao={
            variacao === null
              ? null
              : `${variacao >= 0 ? "+" : ""}${variacao}% vs periodo anterior`
          }
          positiva={variacao !== null && variacao >= 0}
          grafico={<Minilinha valores={ultimos} />}
        />
        <Indicador
          rotulo="Ticket medio"
          valor={formatarReal(ticketMedio)}
          icone={<Receipt className="h-4 w-4" />}
          secundario={`${atendimentos} atendimento${atendimentos === 1 ? "" : "s"} confirmado${atendimentos === 1 ? "" : "s"}`}
        />
        <Indicador
          rotulo="Recebido via PIX"
          valor={formatarReal(recebidoPix)}
          icone={<TrendingUp className="h-4 w-4" />}
          secundario={`${pctPix.toFixed(0)}% da receita`}
        />
        <Indicador
          rotulo="A receber"
          valor={formatarReal(aReceber)}
          icone={<Clock className="h-4 w-4" />}
          secundario={`${pendentesQtd} agendamento${pendentesQtd === 1 ? "" : "s"} aguardando`}
        />
      </div>

      {/* Receita por dia */}
      <section className="mt-5 rounded-2xl border border-admin-border bg-admin-surface p-5 lg:p-6">
        <p className="astro-label">Receita no periodo</p>
        <h2 className="mt-1 text-2xl font-bold text-white">
          {formatarReal(receitaTotal)}
        </h2>
        <div className="mt-5">
          <ColunasPorDia dados={serieDiaria} />
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {/* Receita por servico */}
        <section className="rounded-2xl border border-admin-border bg-admin-surface p-5 lg:p-6">
          <p className="astro-label">Por servico</p>
          <h2 className="mt-1 text-lg font-semibold text-white">
            Receita por categoria
          </h2>
          <div className="mt-5">
            <BarrasHorizontais
              itens={porServico.map((s) => ({
                rotulo: s.nome,
                valor: s.receita,
                nota: `${s.qtd}×`,
              }))}
            />
          </div>
        </section>

        {/* Formas de pagamento */}
        <section className="rounded-2xl border border-admin-border bg-admin-surface p-5 lg:p-6">
          <p className="astro-label">Por metodo</p>
          <h2 className="mt-1 text-lg font-semibold text-white">
            Como os clientes pagam
          </h2>
          <div className="mt-5">
            <BarraDivisao
              a={{ rotulo: "PIX", valor: pagamentoPix }}
              b={{ rotulo: "No local", valor: pagamentoLocal }}
            />
          </div>
        </section>
      </div>

      {/* Ranking de clientes */}
      <section className="mt-5 rounded-2xl border border-admin-border bg-admin-surface p-5 lg:p-6">
        <p className="astro-label">Clientes</p>
        <h2 className="mt-1 text-lg font-semibold text-white">
          Quem mais gastou no periodo
        </h2>

        <ol className="mt-5 space-y-1">
          {porCliente.map((c, i) => (
            <li
              key={`${c.nome}-${i}`}
              className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-white/[0.03]"
            >
              <span
                className={
                  i < 3
                    ? "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-astro-blue/25 font-mono text-[0.65rem] font-bold text-astro-blue-bright"
                    : "flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[0.65rem] text-astro-muted"
                }
              >
                {i + 1}
              </span>
              <p className="min-w-0 flex-1 truncate text-sm text-slate-200">{c.nome}</p>
              <span className="shrink-0 font-mono text-[0.65rem] text-astro-muted">
                {c.visitas} visita{c.visitas === 1 ? "" : "s"}
              </span>
              <p className="w-28 shrink-0 text-right text-sm font-semibold text-white">
                {formatarReal(c.receita)}
              </p>
            </li>
          ))}
          {porCliente.length === 0 && (
            <li className="py-6 text-center text-sm text-astro-muted">
              Nenhum cliente com pagamento confirmado no periodo.
            </li>
          )}
        </ol>
      </section>
    </div>
  );
}

function Indicador({
  rotulo,
  valor,
  icone,
  variacao,
  positiva,
  secundario,
  grafico,
}: {
  rotulo: string;
  valor: string;
  icone: React.ReactNode;
  variacao?: string | null;
  positiva?: boolean;
  secundario?: string;
  grafico?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-admin-border bg-admin-surface p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="astro-label">{rotulo}</p>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-astro-blue/15 text-astro-blue-bright">
          {icone}
        </span>
      </div>

      {/* Figuras proporcionais no valor grande — tabular-nums so em coluna */}
      <p className="mt-3 text-2xl font-bold tracking-tight text-white">{valor}</p>

      {variacao && (
        <span
          className={
            positiva
              ? "mt-2 inline-flex w-fit items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 font-mono text-[0.65rem] text-emerald-300"
              : "mt-2 inline-flex w-fit items-center gap-1 rounded-md bg-red-500/15 px-2 py-0.5 font-mono text-[0.65rem] text-red-300"
          }
        >
          <TrendingUp className={`h-3 w-3 ${positiva ? "" : "rotate-180"}`} />
          {variacao}
        </span>
      )}

      {secundario && (
        <p className="mt-2 font-mono text-[0.65rem] text-astro-muted">{secundario}</p>
      )}

      {grafico && <div className="mt-auto pt-3">{grafico}</div>}
    </div>
  );
}
