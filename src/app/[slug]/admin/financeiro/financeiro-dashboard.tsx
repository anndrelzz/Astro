"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, Clock, TrendingDown, TrendingUp } from "lucide-react";
import { BarrasHorizontais, Bolhas, ColunasPorDia, LinhaSubindo, formatarReal } from "./graficos";
import { FUSO } from "@/lib/fuso";

// RF12, UC11 — dashboard financeiro.
//
// Esquerda: como o dinheiro entrou (PIX x no local), a receita por dia, a
// comparacao com o periodo anterior e os rankings. Direita: o que ainda falta
// receber e os ultimos pagamentos confirmados.

export type Periodo = "hoje" | "7dias" | "30dias" | "90dias" | "ano";

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
  receitaAnterior,
  ticketMedio,
  recebidoPix,
  aReceber,
  atendimentos,
  pendentesQtd,
  serieDiaria,
  porServico,
  porCliente,
  aReceberLista,
  ultimosRecebidos,
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
  aReceberLista: ItemPagamento[];
  ultimosRecebidos: ItemPagamento[];
}) {
  const router = useRouter();

  const pctPix = receitaTotal > 0 ? (recebidoPix / receitaTotal) * 100 : 0;

  // Comparacao com o periodo anterior. A porcentagem so aparece quando o
  // periodo anterior tem base para comparar (ao menos 20% da receita atual):
  // com base quase zerada — o primeiro mes de uma estetica nova, por exemplo —
  // ela vira "+6990%", que assusta mais do que informa. Nesses casos, mostra a
  // diferenca em reais.
  const diferenca = receitaTotal - receitaAnterior;
  const comBase = receitaAnterior > 0 && receitaAnterior >= receitaTotal * 0.2;
  const subiu = diferenca >= 0;
  const comparacao = comBase
    ? {
        titulo: `${subiu ? "+" : "−"}${Math.abs(Math.round((diferenca / receitaAnterior) * 100))}%`,
        detalhe: `${formatarReal(Math.abs(diferenca))} ${subiu ? "a mais" : "a menos"} que o período anterior`,
      }
    : receitaAnterior > 0
      ? {
          titulo: `${subiu ? "+" : "−"}${formatarReal(Math.abs(diferenca))}`,
          detalhe: `${subiu ? "a mais" : "a menos"} que o período anterior (${formatarReal(receitaAnterior)})`,
        }
      : { titulo: "Sem comparação", detalhe: "O período anterior não teve receita confirmada." };

  // Receita acumulada no periodo: a linha do cartao de comparacao sobe ate o
  // total, como a curva de "saude" da referencia.
  const acumulada = serieDiaria.reduce<number[]>((acc, d) => [...acc, (acc.at(-1) ?? 0) + d.recebido], []);

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white lg:text-4xl">Financeiro</h1>
          <p className="mt-1.5 text-astro-muted">
            {periodo === "hoje" ? "Hoje" : `${dataCurta(inicioISO)} a ${dataCurta(fimISO)}`}
          </p>
        </div>

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
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid min-w-0 gap-5">
          {/* Como o dinheiro entrou */}
          <section className="rounded-3xl border border-admin-border bg-admin-surface p-5 sm:p-6">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold text-white">Receita recebida</h2>
              <p className="text-sm text-astro-muted">
                Ticket médio <b className="text-white">{formatarReal(ticketMedio)}</b> · {atendimentos}{" "}
                {atendimentos === 1 ? "atendimento" : "atendimentos"}
              </p>
            </div>
            {receitaTotal > 0 ? (
              <Bolhas total={receitaTotal} pix={recebidoPix} local={receitaTotal - recebidoPix} pctPix={pctPix} />
            ) : (
              <p className="py-10 text-center text-sm text-astro-muted">Nenhum pagamento confirmado no período.</p>
            )}
          </section>

          <div className="grid gap-5 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <section className="min-w-0 rounded-3xl border border-admin-border bg-admin-surface p-5 sm:p-6">
              <h2 className="mb-4 text-base font-semibold text-white">Receita por dia</h2>
              <ColunasPorDia dados={serieDiaria} />
            </section>

            {/* Cartao de destaque, no estilo do faturamento do Dashboard */}
            <section
              aria-label="Comparação com o período anterior"
              className="borda-viva relative flex flex-col overflow-hidden rounded-3xl p-5 text-white sm:p-6"
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
                  {subiu ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  Comparado ao período anterior
                </p>
                <p className="mt-3 text-4xl font-bold tracking-tight">{comparacao.titulo}</p>
                <p className="mt-1 text-sm text-white/80">{comparacao.detalhe}</p>
              </div>
              <div className="relative mt-auto pt-4">
                <LinhaSubindo valores={acumulada} />
              </div>
            </section>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <section className="rounded-3xl border border-admin-border bg-admin-surface p-5 sm:p-6">
              <h2 className="mb-5 text-base font-semibold text-white">Receita por serviço</h2>
              <BarrasHorizontais
                itens={porServico.map((s) => ({ rotulo: s.nome, valor: s.receita, nota: `${s.qtd}×` }))}
              />
            </section>

            <section className="rounded-3xl border border-admin-border bg-admin-surface p-5 sm:p-6">
              <h2 className="mb-4 text-base font-semibold text-white">Quem mais gastou</h2>
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

        {/* Coluna da direita: o que falta entrar e o que entrou por ultimo */}
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
          <section className="rounded-3xl border border-admin-border bg-admin-surface p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-white">A receber</h2>
                <p className="text-xs text-astro-muted">
                  {pendentesQtd} {pendentesQtd === 1 ? "agendamento aguardando" : "agendamentos aguardando"}
                </p>
              </div>
              <p className="text-lg font-bold text-white">{formatarReal(aReceber)}</p>
            </div>
            <Lista itens={aReceberLista} pendente vazio="Nada para receber no período." />
            {pendentesQtd > 0 && (
              <Link
                href={`/${slug}/admin/agendamentos`}
                className="mt-3 block rounded-full border border-admin-border py-2 text-center text-xs font-semibold text-astro-muted transition hover:text-white"
              >
                Ver em Agendamentos
              </Link>
            )}
          </section>

          <section className="rounded-3xl border border-admin-border bg-admin-surface p-5">
            <h2 className="text-base font-semibold text-white">Últimos recebimentos</h2>
            <Lista itens={ultimosRecebidos} vazio="Nenhum pagamento confirmado no período." />
          </section>
        </div>
      </div>
    </div>
  );
}

function Lista({ itens, pendente = false, vazio }: { itens: ItemPagamento[]; pendente?: boolean; vazio: string }) {
  if (itens.length === 0) return <p className="py-6 text-center text-sm text-astro-muted">{vazio}</p>;
  return (
    <ul className="mt-3 divide-y divide-admin-border/60">
      {itens.map((i) => (
        <li key={i.id} className="flex items-center gap-3 py-2.5">
          <span
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
              pendente ? "bg-amber-400/10 text-amber-300" : "bg-emerald-400/10 text-emerald-300"
            }`}
          >
            {pendente ? <Clock className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
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
                i.forma === "PIX"
                  ? pendente
                    ? "bg-amber-400/15 text-amber-300"
                    : "bg-white/[0.08] text-slate-300"
                  : "bg-sky-400/15 text-sky-300"
              }`}
            >
              {i.forma === "PIX" ? (pendente ? "PIX pendente" : "PIX") : "No local"}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
