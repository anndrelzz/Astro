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
// Bolhas: PIX | total | no local. As tres se fundem (filtro "goo": desfoca e
// depois corta a transparencia, o que cola as bordas vizinhas), e a do meio
// e pintada por cima na cor da estetica.
// ---------------------------------------------------------------------------

export function Bolhas({
  total,
  pix,
  local,
  pctPix,
}: {
  total: number;
  pix: number;
  local: number;
  pctPix: number;
}) {
  const id = useId();
  const lados = [
    { x: "25%", rotulo: "PIX", valor: pix, pct: pctPix },
    { x: "75%", rotulo: "No local", valor: local, pct: total > 0 ? 100 - pctPix : 0 },
  ];

  return (
    <div className="relative mx-auto aspect-[600/220] w-full max-w-3xl">
      <svg viewBox="0 0 600 220" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <filter id={`goo-${id}`}>
            <feGaussianBlur in="SourceGraphic" stdDeviation="14" result="borrado" />
            <feColorMatrix in="borrado" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -10" />
          </filter>
          <radialGradient id={`centro-${id}`} cx="35%" cy="30%" r="80%">
            <stop offset="0%" style={{ stopColor: "color-mix(in srgb, var(--color-astro-blue-bright) 70%, white)" }} />
            <stop offset="45%" style={{ stopColor: "var(--color-astro-blue)" }} />
            <stop offset="100%" style={{ stopColor: "color-mix(in srgb, var(--color-astro-blue) 55%, black)" }} />
          </radialGradient>
        </defs>
        <g filter={`url(#goo-${id})`} fill="#202027">
          <circle cx="150" cy="110" r="80" />
          <circle cx="300" cy="110" r="102" />
          <circle cx="450" cy="110" r="80" />
        </g>
        <circle
          cx="300"
          cy="110"
          r="92"
          fill={`url(#centro-${id})`}
          style={{ filter: "drop-shadow(0 0 24px color-mix(in srgb, var(--color-astro-blue) 70%, transparent))" }}
        />
      </svg>

      {lados.map((l) => (
        <div
          key={l.rotulo}
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-center"
          style={{ left: l.x }}
        >
          <p className="text-sm font-bold text-white sm:text-base lg:text-xl">
            <span className="sm:hidden">{formatarReal(l.valor, true)}</span>
            <span className="hidden sm:inline">{formatarReal(l.valor)}</span>
          </p>
          <p className="text-[0.7rem] text-astro-muted sm:text-xs">
            {l.rotulo} · {l.pct.toFixed(0)}%
          </p>
        </div>
      ))}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
        <p className="text-base font-bold text-white sm:text-xl lg:text-3xl">
          <span className="sm:hidden">{formatarReal(total, true)}</span>
          <span className="hidden sm:inline">{formatarReal(total)}</span>
        </p>
        <p className="text-[0.7rem] text-white/75 sm:text-xs">Total</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Linha branca sobre o cartao de destaque (comparacao com o periodo anterior)
// ---------------------------------------------------------------------------

export function LinhaSubindo({ valores }: { valores: number[] }) {
  const id = useId();
  if (valores.length < 2) return null;

  const L = 300;
  const A = 90;
  const max = Math.max(...valores, 1);
  const pontos = valores.map((v, i) => [(i / (valores.length - 1)) * L, A - 6 - (v / max) * (A - 12)] as const);
  const linha = pontos.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [ux, uy] = pontos[pontos.length - 1];

  return (
    <svg viewBox={`0 0 ${L} ${A}`} className="h-24 w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.25" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${linha} L${L},${A} L0,${A} Z`} fill={`url(#area-${id})`} />
      <path
        d={linha}
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={ux} cy={uy} r="4" fill="white" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Colunas por dia, em vidro: a coluna em foco acende na cor da estetica e
// ganha o balao com o valor em cima.
// ---------------------------------------------------------------------------

type Dia = { dia: string; recebido: number; pendente: number };

export function ColunasPorDia({ dados }: { dados: Dia[] }) {
  const [foco, setFoco] = useState<number | null>(null);
  const [tabela, setTabela] = useState(false);

  const max = Math.max(...dados.map((d) => d.recebido + d.pendente), 1);
  const temPendente = dados.some((d) => d.pendente > 0);

  // Marcas de escala em numeros redondos.
  const passo = Math.pow(10, Math.floor(Math.log10(max)));
  const topo = Math.ceil(max / passo) * passo;

  const ALTURA = 190;
  const larguraBarra = Math.min(34, Math.max(4, 640 / dados.length - 5));
  // Sem foco, a coluna mais alta fica acesa (como o mes em destaque da referencia).
  const maior = dados.reduce((m, d, i) => (d.recebido > dados[m].recebido ? i : m), 0);
  const aceso = foco ?? (dados[maior]?.recebido > 0 ? maior : null);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <LegendaItem cor={COR_DADO} rotulo="Recebido" />
          {temPendente && <LegendaItem cor={COR_PENDENTE} rotulo="A receber" />}
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
          <div className="relative" style={{ height: ALTURA }}>
            <svg
              viewBox={`0 0 640 ${ALTURA}`}
              className="absolute inset-0 h-full w-full"
              preserveAspectRatio="none"
              role="img"
              aria-label="Receita por dia no período"
            >
              <defs>
                <linearGradient id="coluna-vidro" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="white" stopOpacity="0.16" />
                  <stop offset="100%" stopColor="white" stopOpacity="0.05" />
                </linearGradient>
                <linearGradient id="coluna-acesa" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" style={{ stopColor: "color-mix(in srgb, var(--color-astro-blue-bright) 70%, white)" }} />
                  <stop offset="100%" style={{ stopColor: "var(--color-astro-blue)" }} />
                </linearGradient>
              </defs>

              {dados.map((d, i) => {
                const cx = ((i + 0.5) / dados.length) * 640;
                const x = cx - larguraBarra / 2;
                const hRec = (d.recebido / topo) * (ALTURA - 30);
                const hPen = (d.pendente / topo) * (ALTURA - 30);
                const ativo = aceso === i;
                return (
                  <g key={d.dia} onMouseEnter={() => setFoco(i)} onMouseLeave={() => setFoco(null)}>
                    {/* alvo de hover generoso: cobre a faixa inteira do dia */}
                    <rect x={cx - 320 / dados.length} y={0} width={640 / dados.length} height={ALTURA} fill="transparent" />
                    {/* trilho da coluna, em vidro, ate o topo da escala */}
                    <rect x={x} y={30} width={larguraBarra} height={ALTURA - 30} rx={larguraBarra / 2.5} fill="white" fillOpacity="0.03" />
                    {d.pendente > 0 && (
                      <rect
                        x={x}
                        y={ALTURA - hRec - hPen}
                        width={larguraBarra}
                        height={hPen + hRec}
                        rx={larguraBarra / 2.5}
                        fill={COR_PENDENTE}
                      />
                    )}
                    {d.recebido > 0 && (
                      <rect
                        x={x}
                        y={ALTURA - hRec}
                        width={larguraBarra}
                        height={hRec}
                        rx={larguraBarra / 2.5}
                        fill={ativo ? "url(#coluna-acesa)" : "url(#coluna-vidro)"}
                        stroke="white"
                        strokeOpacity={ativo ? 0 : 0.12}
                        vectorEffect="non-scaling-stroke"
                      />
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Balao com o valor da coluna acesa */}
            {aceso !== null && dados[aceso] && (
              <div
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg bg-white px-2 py-1 text-xs font-bold whitespace-nowrap text-black shadow-lg"
                style={{
                  left: `${((aceso + 0.5) / dados.length) * 100}%`,
                  top: Math.max(
                    0,
                    ALTURA - ((dados[aceso].recebido + dados[aceso].pendente) / topo) * (ALTURA - 30) - 8
                  ),
                }}
              >
                {formatarReal(dados[aceso].recebido, true)}
              </div>
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

function LegendaItem({ cor, rotulo }: { cor: string; rotulo: string }) {
  return (
    <span className="flex items-center gap-2 text-xs text-astro-muted">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cor }} />
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
