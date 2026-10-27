"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, Download, Wallet } from "lucide-react";
import { BarrasHorizontais, LinhaPorDia, formatarReal } from "./graficos";
import { FUSO } from "@/lib/fuso";
import type { Periodo } from "@/lib/financeiro";

// RF12, UC11 — dashboard financeiro, em cinco blocos: receita total do
// periodo, o que ainda falta receber, receita por dia, receita por servico e
// os 5 clientes que mais gastaram. O botao "Exportar" baixa o periodo em CSV
// (relatorio exportavel do objetivo 5 do RFC).

export type ItemPagamento = {
  id: string;
  dia: string;
  cliente: string;
  servico: string;
  forma: "PIX" | "LOCAL";
  valor: number;
};

const PERIODOS: { valor: Periodo; rotulo: string }[] = [
  { valor: "hoje", rotulo: "Hoje" },
  { valor: "7dias", rotulo: "7 dias" },
  { valor: "30dias", rotulo: "30 dias" },
  { valor: "90dias", rotulo: "90 dias" },
  { valor: "ano", rotulo: "Este ano" },
];

function dataCurta(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "short", timeZone: FUSO });
}

export function FinanceiroDashboard({
  slug,
  periodo,
  inicioISO,
  fimISO,
  receitaTotal,
  recebidoPix,
  atendimentos,
  aReceber,
  pendentesQtd,
  serieDiaria,
  porServico,
  porCliente,
  aReceberLista,
}: {
  slug: string;
  periodo: Periodo;
  inicioISO: string;
  fimISO: string;
  receitaTotal: number;
  recebidoPix: number;
  atendimentos: number;
  aReceber: number;
  pendentesQtd: number;
  serieDiaria: { dia: string; recebido: number; pendente: number }[];
  porServico: { nome: string; receita: number; qtd: number }[];
  porCliente: { nome: string; receita: number; visitas: number }[];
  aReceberLista: ItemPagamento[];
}) {
  const router = useRouter();
  const ticketMedio = atendimentos ? receitaTotal / atendimentos : 0;
  const recebidoLocal = receitaTotal - recebidoPix;

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white lg:text-4xl">Financeiro</h1>
          <p className="mt-1.5 text-astro-muted">
            {periodo === "hoje" ? "Hoje" : `${dataCurta(inicioISO)} a ${dataCurta(fimISO)}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Um filtro so, acima de tudo que ele afeta */}
          <div role="group" aria-label="Período" className="flex flex-wrap rounded-full border border-admin-border bg-admin-surface p-1">
            {PERIODOS.map((p) => (
              <button
                key={p.valor}
                type="button"
                aria-pressed={periodo === p.valor}
                onClick={() => router.push(`/${slug}/admin/financeiro?periodo=${p.valor}`)}
                className={
                  periodo === p.valor
                    ? "rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-black"
                    : "rounded-full px-3.5 py-1.5 text-xs font-semibold text-astro-muted transition hover:text-white"
                }
              >
                {p.rotulo}
              </button>
            ))}
          </div>
          <a
            href={`/api/financeiro/exportar?periodo=${periodo}`}
            download
            className="flex items-center gap-2 rounded-full border border-admin-border bg-admin-surface px-4 py-2.5 text-xs font-semibold text-white transition hover:border-astro-blue"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </a>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          {/* 1. Receita total — cartao de destaque, como o faturamento do Dashboard */}
          <section
            aria-label="Receita total"
            className="borda-viva relative overflow-hidden rounded-3xl p-6 text-white"
            style={{
              backgroundImage:
                "radial-gradient(120% 140% at 100% 0%, var(--color-astro-blue-bright) 0%, var(--color-astro-blue) 40%, color-mix(in srgb, var(--color-astro-blue) 55%, black) 100%)",
              boxShadow:
                "0 24px 60px -24px color-mix(in srgb, var(--color-astro-blue) 80%, transparent), 0 0 50px -10px color-mix(in srgb, var(--color-astro-blue-bright) 45%, transparent)",
            }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full border border-white/20 shadow-[0_0_0_40px_rgba(255,255,255,0.04),0_0_0_90px_rgba(255,255,255,0.03)]"
            />
            <div className="relative">
              <p className="flex items-center gap-2 text-sm font-semibold text-white/85">
                <Wallet className="h-4 w-4" />
                Receita total
              </p>
              <p className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">{formatarReal(receitaTotal)}</p>
              <p className="mt-2 text-sm text-white/80">
                {atendimentos} {atendimentos === 1 ? "atendimento pago" : "atendimentos pagos"} · ticket médio{" "}
                <b className="text-white">{formatarReal(ticketMedio)}</b>
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full bg-black/25 px-3.5 py-1.5 text-xs">
                  PIX <b className="ml-1">{formatarReal(recebidoPix)}</b>
                </span>
                <span className="rounded-full bg-black/25 px-3.5 py-1.5 text-xs">
                  No local <b className="ml-1">{formatarReal(recebidoLocal)}</b>
                </span>
              </div>
            </div>
          </section>

          {/* 5. A receber: sem isso, a receita parece menor do que vai ser e o
              dono nao sabe se faturou pouco ou se esqueceu de confirmar PIX. */}
          <section className="flex flex-col rounded-3xl border border-admin-border bg-admin-surface p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-white">A receber</h2>
                <p className="text-xs text-astro-muted">
                  {pendentesQtd} {pendentesQtd === 1 ? "agendamento aguardando" : "agendamentos aguardando"}
                </p>
              </div>
              <p className="text-lg font-bold text-white">{formatarReal(aReceber)}</p>
            </div>
            {aReceberLista.length === 0 ? (
              <p className="my-auto py-6 text-center text-sm text-astro-muted">Nada para receber no período.</p>
            ) : (
              <ul className="mt-3 mb-3 divide-y divide-admin-border/60">
                {aReceberLista.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 py-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-400/10 text-amber-300">
                      <Clock className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white">{i.cliente}</span>
                      <span className="block truncate text-xs text-astro-muted">
                        {i.dia} · {i.servico}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-semibold text-white">{formatarReal(i.valor)}</span>
                      <span
                        className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${
                          i.forma === "PIX" ? "bg-amber-400/15 text-amber-300" : "bg-sky-400/15 text-sky-300"
                        }`}
                      >
                        {i.forma === "PIX" ? "PIX pendente" : "No local"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {pendentesQtd > 0 && (
              <Link
                href={`/${slug}/admin/agendamentos`}
                className="mt-auto block rounded-full border border-admin-border py-2 text-center text-xs font-semibold text-astro-muted transition hover:text-white"
              >
                Ver em Agendamentos
              </Link>
            )}
          </section>
        </div>

        {/* 2. Receita por periodo, dia a dia */}
        <section className="min-w-0 rounded-3xl border border-admin-border bg-admin-surface p-5 sm:p-6">
          <h2 className="mb-4 text-base font-semibold text-white">Receita por dia</h2>
          <LinhaPorDia dados={serieDiaria} />
        </section>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-2">
          {/* 3. Receita por servico */}
          <section className="rounded-3xl border border-admin-border bg-admin-surface p-5 sm:p-6">
            <h2 className="mb-5 text-base font-semibold text-white">Receita por serviço</h2>
            <BarrasHorizontais itens={porServico.map((s) => ({ rotulo: s.nome, valor: s.receita, nota: `${s.qtd}×` }))} />
          </section>

          {/* 4. Top 5 clientes */}
          <section className="rounded-3xl border border-admin-border bg-admin-surface p-5 sm:p-6">
            <h2 className="mb-4 text-base font-semibold text-white">Top 5 clientes</h2>
            <ol className="space-y-1">
              {porCliente.map((c, i) => (
                <li key={`${c.nome}-${i}`} className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-white/[0.03]">
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full font-mono text-[0.7rem] font-bold ${
                      i < 3 ? "bg-astro-blue text-white" : "bg-white/[0.06] text-astro-muted"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-slate-200">{c.nome}</span>
                    <span className="block text-xs text-astro-muted">
                      {c.visitas} {c.visitas === 1 ? "visita" : "visitas"}
                    </span>
                  </span>
                  <p className="shrink-0 text-right text-sm font-semibold text-white">{formatarReal(c.receita)}</p>
                </li>
              ))}
              {porCliente.length === 0 && (
                <li className="py-6 text-center text-sm text-astro-muted">Nenhum cliente com pagamento confirmado no período.</li>
              )}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
