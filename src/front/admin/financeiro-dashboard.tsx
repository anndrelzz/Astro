"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Car, Clock, Crown, Download, Wallet } from "lucide-react";
import { BarrasHorizontais, LinhaAcumulada, LinhaPorDia, Rosca, formatarReal } from "@/front/admin/graficos";
import { Modal } from "@/front/admin/modal";
import { FUSO } from "@/compartilhado/fuso";
import type { Periodo } from "@/compartilhado/financeiro";

// RF12, UC11 — dashboard financeiro: receita total do periodo, o que ainda
// falta receber, receita por dia, como os clientes pagam (com os acrescimos),
// receita por servico e os 5 clientes que mais gastaram. O botao "Exportar"
// baixa o periodo em CSV (relatorio exportavel do objetivo 5 do RFC).

export type ItemPagamento = {
  id: string;
  dia: string;
  cliente: string;
  servico: string;
  forma: "PIX" | "LOCAL";
  valor: number;
};

// Acrescimo por condicao do veiculo, lancado pelo Admin ao confirmar o
// pagamento (regra pedida pela estetica cliente). `valor` e o combinado no
// agendamento; o acrescimo fica separado dele. O detalhe mostra o carro, nao o
// servico: o acrescimo vem do estado do veiculo, e e o carro que o dono lembra.
export type ItemAcrescimo = {
  id: string;
  dia: string;
  cliente: string;
  veiculo: string;
  placa: string;
  valor: number;
  acrescimo: number;
};

// Ouro, prata e bronze para os tres primeiros do ranking: metal em degrade
// no selo e um brilho leve da mesma cor na linha.
const MEDALHAS = [
  { nome: "1º lugar", metal: "linear-gradient(135deg, #fde68a, #f59e0b 55%, #b45309)", texto: "#451a03", brilho: "rgba(245,158,11,0.16)" },
  { nome: "2º lugar", metal: "linear-gradient(135deg, #f1f5f9, #94a3b8 55%, #475569)", texto: "#0f172a", brilho: "rgba(148,163,184,0.14)" },
  { nome: "3º lugar", metal: "linear-gradient(135deg, #fed7aa, #c2410c 55%, #7c2d12)", texto: "#fff7ed", brilho: "rgba(194,65,12,0.16)" },
];

const ROTULO_PERIODO: Record<Periodo, string> = {
  hoje: "hoje",
  "7dias": "em 7 dias",
  "30dias": "em 30 dias",
  "90dias": "em 90 dias",
  ano: "no ano",
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
  acrescimos,
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
  acrescimos: ItemAcrescimo[];
}) {
  const router = useRouter();
  const [verAcrescimos, setVerAcrescimos] = useState(false);
  const totalAcrescimos = acrescimos.reduce((s, a) => s + a.acrescimo, 0);
  const ticketMedio = atendimentos ? receitaTotal / atendimentos : 0;
  const recebidoLocal = receitaTotal - recebidoPix;
  // Receita somada dia a dia: a linha do cartao principal sobe ate o total.
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
            className="borda-viva relative flex flex-col overflow-hidden rounded-3xl p-6 text-white"
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
            </div>
            {/* Como o total foi crescendo no periodo. Trecho plano = dias sem
                receita. Ocupa o espaco que o cartao ganha ao acompanhar a
                altura do "A receber". */}
            {acumulada.length > 1 && receitaTotal > 0 && (
              <div className="relative mt-4 min-h-28 flex-1">
                <LinhaAcumulada valores={acumulada} rotulo={`${formatarReal(receitaTotal, true)} ${ROTULO_PERIODO[periodo]}`} />
              </div>
            )}
            {/* Numeros de apoio no rodape do cartao */}
            <div className="relative mt-auto grid grid-cols-2 gap-3 pt-4">
              {[
                { rotulo: atendimentos === 1 ? "Atendimento pago" : "Atendimentos pagos", valor: String(atendimentos) },
                { rotulo: "Ticket médio", valor: formatarReal(ticketMedio) },
              ].map((n) => (
                <div key={n.rotulo} className="rounded-2xl bg-black/25 px-4 py-3">
                  <p className="text-lg font-bold">{n.valor}</p>
                  <p className="text-xs text-white/75">{n.rotulo}</p>
                </div>
              ))}
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

        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          {/* 2. Receita por periodo, dia a dia */}
          <section className="min-w-0 rounded-3xl border border-admin-border bg-admin-surface p-5 sm:p-6">
            <h2 className="mb-4 text-base font-semibold text-white">Receita por período</h2>
            <LinhaPorDia dados={serieDiaria} />
          </section>

          {/* Como os clientes pagam: duas partes de um todo, por isso rosca */}
          <section className="flex flex-col rounded-3xl border border-admin-border bg-admin-surface p-5 sm:p-6">
            <h2 className="mb-4 text-base font-semibold text-white">Formas de pagamento</h2>
            {receitaTotal > 0 ? (
              <>
                <Rosca
                  partes={[
                    { rotulo: "PIX", valor: recebidoPix, cor: "var(--color-astro-blue-bright)" },
                    { rotulo: "No local", valor: recebidoLocal, cor: "rgb(255 255 255 / 0.28)" },
                  ]}
                />
                <ul className="mt-5 grid gap-2">
                  {[
                    { rotulo: "PIX", valor: recebidoPix, cor: "var(--color-astro-blue-bright)" },
                    { rotulo: "No local", valor: recebidoLocal, cor: "rgb(255 255 255 / 0.28)" },
                  ].map((p) => (
                    <li key={p.rotulo} className="flex items-center gap-2 text-sm">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.cor }} />
                      <span className="text-slate-200">{p.rotulo}</span>
                      <span className="ml-auto font-semibold text-white">{formatarReal(p.valor)}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="my-auto py-6 text-center text-sm text-astro-muted">Nenhum pagamento confirmado no período.</p>
            )}

            {/* Acrescimos: um resumo aqui e o detalhe no modal */}
            <div className="mt-auto pt-5">
              <div className="rounded-2xl bg-white/[0.04] p-3.5">
                <p className="text-xs text-astro-muted">Acréscimos cobrados</p>
                <p className="mt-0.5 text-sm text-slate-200">
                  <b className="text-white">{formatarReal(totalAcrescimos)}</b>
                  {acrescimos.length > 0 &&
                    ` em ${acrescimos.length} ${acrescimos.length === 1 ? "atendimento" : "atendimentos"}`}
                </p>
                {acrescimos.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setVerAcrescimos(true)}
                    className="mt-2.5 w-full rounded-full border border-admin-border py-2 text-xs font-semibold text-astro-muted transition hover:border-astro-blue hover:text-white"
                  >
                    Ver detalhes
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-2">
          {/* 3. Receita por servico */}
          <section className="rounded-3xl border border-admin-border bg-admin-surface p-5 sm:p-6">
            <h2 className="mb-5 text-base font-semibold text-white">Receita por serviço</h2>
            <BarrasHorizontais itens={porServico.map((s) => ({ rotulo: s.nome, valor: s.receita }))} />
          </section>

          {/* 4. Top 5 clientes */}
          <section className="rounded-3xl border border-admin-border bg-admin-surface p-5 sm:p-6">
            <h2 className="mb-4 text-base font-semibold text-white">Top 5 clientes</h2>
            <ol className="space-y-1">
              {porCliente.map((c, i) => (
                <li
                  key={`${c.nome}-${i}`}
                  className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-white/[0.03]"
                  style={MEDALHAS[i] ? { backgroundImage: `linear-gradient(90deg, ${MEDALHAS[i].brilho}, transparent 70%)` } : undefined}
                >
                  {MEDALHAS[i] ? (
                    <span
                      title={MEDALHAS[i].nome}
                      className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full font-mono text-xs font-bold"
                      style={{
                        backgroundImage: MEDALHAS[i].metal,
                        color: MEDALHAS[i].texto,
                        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -2px 3px rgba(0,0,0,0.25), 0 0 14px -2px ${MEDALHAS[i].brilho}`,
                      }}
                    >
                      {i + 1}
                      {i === 0 && <Crown className="absolute -top-2.5 h-3.5 w-3.5 text-amber-300 drop-shadow" />}
                    </span>
                  ) : (
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.06] font-mono text-xs font-bold text-astro-muted">
                      {i + 1}
                    </span>
                  )}
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

      <Modal aberto={verAcrescimos} onFechar={() => setVerAcrescimos(false)} titulo="Acréscimos cobrados">
        <div className="grid gap-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { rotulo: "Total", valor: formatarReal(totalAcrescimos) },
              { rotulo: "Atendimentos", valor: String(acrescimos.length) },
              {
                rotulo: "Da receita",
                valor: `${receitaTotal > 0 ? Math.round((totalAcrescimos / receitaTotal) * 100) : 0}%`,
              },
            ].map((r) => (
              <div key={r.rotulo} className="rounded-2xl bg-white/[0.05] px-2 py-3">
                <p className="text-sm font-bold whitespace-nowrap text-white sm:text-base">{r.valor}</p>
                <p className="text-xs text-astro-muted">{r.rotulo}</p>
              </div>
            ))}
          </div>
          <ul className="divide-y divide-white/10">
            {acrescimos.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-white">{a.cliente}</span>
                  <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-slate-300">
                    <Car className="h-3.5 w-3.5 shrink-0 text-astro-muted" />
                    <span className="truncate">{a.veiculo}</span>
                    <span className="shrink-0 rounded border border-zinc-300 border-t-[3px] border-t-blue-700 bg-white px-1.5 font-mono text-[0.6rem] font-bold tracking-wider text-zinc-900">
                      {a.placa}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-xs text-astro-muted">{a.dia}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-semibold text-amber-300">
                    + {formatarReal(a.acrescimo)}
                    <span className="ml-1 text-xs font-medium text-astro-muted">
                      ({Math.round((a.acrescimo / a.valor) * 100)}%)
                    </span>
                  </span>
                  <span className="block text-xs text-astro-muted">
                    {formatarReal(a.valor)} → {formatarReal(a.valor + a.acrescimo)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Modal>
    </div>
  );
}
