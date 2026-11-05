"use client";

import { useId, useState } from "react";

// Graficos em SVG desenhados a mao — sem biblioteca.
//
// A geometria de cada um e regra de tres: valor / maior valor x espaco
// disponivel. Em troca destas linhas, o pacote nao cresce e o grafico vem
// pronto no HTML — canvas precisaria baixar e executar JavaScript antes de
// pintar qualquer pixel.
//
// A cor dos dados e a da estetica (--color-astro-blue-bright), como no resto do
// painel. O tooltip complementa, nunca e o unico caminho para o valor (existe a
// visao em tabela).

const COR_DADO = "var(--color-astro-blue-bright)";
const COR_PENDENTE = "rgb(255 255 255 / 0.22)";

export function formatarReal(v: number, compacto = false) {
  if (compacto && v >= 1000) {
    return `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`;
  }
  return `R$ ${v.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ---------------------------------------------------------------------------
// Linha por dia: a receita recebida em linha reta de ponto a ponto (os picos
// ficam visiveis, sem suavizar), com uma lavagem da cor por baixo. O que ainda
// falta receber aparece como linha tracejada clara. O dia em foco (ou, sem
// foco, o de maior receita) ganha o ponto e o balao com o valor.
// ---------------------------------------------------------------------------

type Dia = { dia: string; recebido: number; pendente: number };

export function LinhaPorDia({ dados }: { dados: Dia[] }) {
  const id = useId();
  const [foco, setFoco] = useState<number | null>(null);
  const [tabela, setTabela] = useState(false);

  const max = Math.max(...dados.map((d) => Math.max(d.recebido, d.pendente)), 1);
  const temPendente = dados.some((d) => d.pendente > 0);

  // Topo da escala num numero redondo, com folga para o balao.
  const passo = Math.pow(10, Math.floor(Math.log10(max)));
  const topo = Math.ceil((max * 1.15) / passo) * passo;

  const L = 640;
  const A = 200;
  const x = (i: number) => (dados.length === 1 ? L / 2 : (i / (dados.length - 1)) * L);
  const y = (v: number) => A - (v / topo) * A;
  const caminho = (campo: "recebido" | "pendente") =>
    dados.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d[campo]).toFixed(1)}`).join(" ");
  const linha = caminho("recebido");

  const maior = dados.reduce((m, d, i) => (d.recebido > dados[m].recebido ? i : m), 0);
  const aceso = foco ?? (dados[maior]?.recebido > 0 ? maior : null);
  const pct = (i: number) => (x(i) / L) * 100;
  const faixa = L / Math.max(dados.length - 1, 1);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <LegendaItem cor={COR_DADO} rotulo="Recebido" />
          {temPendente && <LegendaItem cor={COR_PENDENTE} rotulo="A receber" tracejado />}
        </div>
        <button
          type="button"
          onClick={() => setTabela((v) => !v)}
          className="rounded-full border border-admin-border px-3 py-1.5 text-xs text-astro-muted transition hover:text-white"
        >
          {tabela ? "Ver gráfico" : "Ver tabela"}
        </button>
      </div>

      {tabela ? (
        <TabelaDias dados={dados} />
      ) : (
        <div>
          <div className="relative" style={{ height: A }} onMouseLeave={() => setFoco(null)}>
            <svg
              viewBox={`0 0 ${L} ${A}`}
              className="absolute inset-0 h-full w-full overflow-visible"
              preserveAspectRatio="none"
              role="img"
              aria-label="Receita por período, dia a dia"
            >
              <defs>
                <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" style={{ stopColor: "var(--color-astro-blue-bright)", stopOpacity: 0.35 }} />
                  <stop offset="100%" style={{ stopColor: "var(--color-astro-blue-bright)", stopOpacity: 0 }} />
                </linearGradient>
              </defs>

              {/* grade em fio, recessiva */}
              {[0.25, 0.5, 0.75].map((f) => (
                <line
                  key={f}
                  x1="0"
                  x2={L}
                  y1={A * f}
                  y2={A * f}
                  stroke="white"
                  strokeOpacity="0.05"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              <line x1="0" x2={L} y1={A} y2={A} stroke="white" strokeOpacity="0.1" vectorEffect="non-scaling-stroke" />

              {temPendente && (
                <path
                  d={caminho("pendente")}
                  fill="none"
                  stroke={COR_PENDENTE}
                  strokeWidth="1.5"
                  strokeDasharray="5 5"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {dados.length > 1 && <path d={`${linha} L${L},${A} L0,${A} Z`} fill={`url(#area-${id})`} />}
              <path
                d={linha}
                fill="none"
                stroke={COR_DADO}
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                style={{ filter: "drop-shadow(0 0 6px color-mix(in srgb, var(--color-astro-blue-bright) 60%, transparent))" }}
              />

              {/* alvos de hover: uma faixa vertical por dia */}
              {dados.map((d, i) => (
                <rect
                  key={d.dia}
                  x={x(i) - faixa / 2}
                  y={0}
                  width={faixa}
                  height={A}
                  fill="transparent"
                  onMouseEnter={() => setFoco(i)}
                />
              ))}
            </svg>

            {/* Marcacao do dia em foco: linha vertical, ponto e balao. Em HTML,
                para o ponto ficar redondo mesmo com o SVG esticado. */}
            {aceso !== null && dados[aceso] && (
              <>
                <span
                  className="pointer-events-none absolute top-0 bottom-0 w-px -translate-x-1/2 bg-white/15"
                  style={{ left: `${pct(aceso)}%` }}
                />
                <span
                  className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
                  style={{ left: `${pct(aceso)}%`, top: y(dados[aceso].recebido), backgroundColor: COR_DADO }}
                />
                <span
                  className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg bg-white px-2 py-1 text-xs font-bold whitespace-nowrap text-black shadow-lg"
                  style={{
                    left: `clamp(2rem, ${pct(aceso)}%, calc(100% - 2rem))`,
                    top: Math.max(26, y(dados[aceso].recebido) - 12),
                  }}
                >
                  {formatarReal(dados[aceso].recebido, true)}
                </span>
              </>
            )}
          </div>

          {/* faixa do eixo de datas */}
          <div className="mt-2 flex justify-between font-mono text-[0.65rem] tabular-nums text-astro-muted">
            <span>{rotuloDia(dados[0]?.dia)}</span>
            {dados.length > 2 && <span>{rotuloDia(dados[Math.floor(dados.length / 2)]?.dia)}</span>}
            <span>{rotuloDia(dados[dados.length - 1]?.dia)}</span>
          </div>

          {aceso !== null && dados[aceso] && (
            <p className="mt-3 text-xs text-astro-muted">
              {rotuloDia(dados[aceso].dia, true)} · recebido{" "}
              <b className="text-white">{formatarReal(dados[aceso].recebido)}</b>
              {dados[aceso].pendente > 0 && <> · a receber {formatarReal(dados[aceso].pendente)}</>}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function rotuloDia(dia?: string, completo = false) {
  if (!dia) return "";
  const [a, m, d] = dia.split("-");
  return completo ? `${d}/${m}/${a}` : `${d}/${m}`;
}

function TabelaDias({ dados }: { dados: Dia[] }) {
  const comMovimento = dados.filter((d) => d.recebido > 0 || d.pendente > 0);
  return (
    <div className="max-h-64 overflow-y-auto rounded-xl border border-admin-border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-admin-surface">
          <tr className="border-b border-admin-border text-xs text-astro-muted">
            <th className="px-3 py-2 text-left font-medium">Dia</th>
            <th className="px-3 py-2 text-right font-medium">Recebido</th>
            <th className="px-3 py-2 text-right font-medium">A receber</th>
          </tr>
        </thead>
        <tbody>
          {comMovimento.map((d) => (
            <tr key={d.dia} className="border-b border-admin-border/60 last:border-0">
              <td className="px-3 py-2 font-mono tabular-nums text-slate-200">{rotuloDia(d.dia, true)}</td>
              <td className="px-3 py-2 text-right font-mono tabular-nums text-white">{formatarReal(d.recebido)}</td>
              <td className="px-3 py-2 text-right font-mono tabular-nums text-astro-muted">
                {d.pendente ? formatarReal(d.pendente) : "—"}
              </td>
            </tr>
          ))}
          {comMovimento.length === 0 && (
            <tr>
              <td colSpan={3} className="px-3 py-6 text-center text-astro-muted">
                Nenhum movimento no período.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function LegendaItem({ cor, rotulo, tracejado = false }: { cor: string; rotulo: string; tracejado?: boolean }) {
  return (
    <span className="flex items-center gap-2 text-xs text-astro-muted">
      {tracejado ? (
        <span className="w-4 border-t-2 border-dashed" style={{ borderColor: cor }} />
      ) : (
        <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: cor }} />
      )}
      {rotulo}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Barras horizontais — magnitude comparada
// ---------------------------------------------------------------------------

export function BarrasHorizontais({ itens }: { itens: { rotulo: string; valor: number; nota?: string }[] }) {
  const max = Math.max(...itens.map((i) => i.valor), 1);

  return (
    <ul className="space-y-3.5">
      {itens.map((i) => (
        <li key={i.rotulo}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 truncate text-sm text-slate-200">
              {i.rotulo}
              {i.nota && <span className="ml-2 font-mono text-[0.65rem] text-astro-muted">{i.nota}</span>}
            </p>
            <p className="shrink-0 text-sm font-semibold text-white">{formatarReal(i.valor)}</p>
          </div>
          {/* Categorias nominais: todas na MESMA cor. O comprimento ja diz a
              diferenca; colorir cada barra repetiria a informacao. */}
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(2, (i.valor / max) * 100)}%`, backgroundColor: COR_DADO }}
            />
          </div>
        </li>
      ))}
      {itens.length === 0 && <li className="py-6 text-center text-sm text-astro-muted">Nenhuma receita no período.</li>}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Rosca: partes de um todo, so para poucas partes (aqui, PIX e no local). O
// numero do meio e a fatia principal em porcentagem.
// ---------------------------------------------------------------------------

export function Rosca({ partes }: { partes: { rotulo: string; valor: number; cor: string }[] }) {
  const total = partes.reduce((s, p) => s + p.valor, 0);
  const R = 42;
  const C = 2 * Math.PI * R;
  const principal = partes[0];
  const fatias = partes.reduce<{ rotulo: string; cor: string; tam: number; inicio: number }[]>((acc, p) => {
    const inicio = acc.length ? acc[acc.length - 1].inicio + acc[acc.length - 1].tam : 0;
    return [...acc, { rotulo: p.rotulo, cor: p.cor, tam: total ? (p.valor / total) * C : 0, inicio }];
  }, []);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[9.5rem]">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label="Divisão da receita por forma de pagamento">
        <circle cx="50" cy="50" r={R} fill="none" stroke="white" strokeOpacity="0.05" strokeWidth="11" />
        {fatias.map((f) =>
          f.tam > 0 ? (
            <circle
              key={f.rotulo}
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke={f.cor}
              strokeWidth="11"
              // 1,5 de respiro entre as fatias
              strokeDasharray={`${Math.max(f.tam - 1.5, 0)} ${C}`}
              strokeDashoffset={-f.inicio}
            />
          ) : null
        )}
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <p className="text-2xl font-bold text-white">{total ? Math.round((principal.valor / total) * 100) : 0}%</p>
        <p className="text-xs text-astro-muted">{principal.rotulo}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Linha branca da receita acumulada, para o cartao de destaque (fundo na cor
// da estetica). Estica para ocupar a altura que o cartao tiver; o ponto final
// e o rotulo sao HTML, para nao deformarem junto com o SVG.
// ---------------------------------------------------------------------------

export function LinhaAcumulada({ valores, rotulo }: { valores: number[]; rotulo: string }) {
  const id = useId();
  const L = 300;
  const A = 100;
  const max = Math.max(...valores, 1);
  // O ponto mais alto para a 36% do topo: a faixa livre acima dele e onde o
  // rotulo fica, sem invadir o valor grande do cartao.
  const pontos = valores.map((v, i) => [(i / (valores.length - 1)) * L, A - 4 - (v / max) * (A * 0.6)] as const);
  const linha = pontos.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const fimY = (pontos[pontos.length - 1][1] / A) * 100;

  return (
    <div className="absolute inset-0">
      <svg viewBox={`0 0 ${L} ${A}`} className="h-full w-full" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id={`acumulada-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="0.28" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${linha} L${L},${A} L0,${A} Z`} fill={`url(#acumulada-${id})`} />
        <path
          d={linha}
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span
        className="absolute right-0 h-2.5 w-2.5 translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)]"
        style={{ top: `${fimY}%` }}
      />
      <span
        className="absolute right-0 -translate-y-full rounded-full bg-black/30 px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-white backdrop-blur-sm"
        style={{ top: `calc(${fimY}% - 10px)` }}
      >
        {rotulo}
      </span>
    </div>
  );
}
