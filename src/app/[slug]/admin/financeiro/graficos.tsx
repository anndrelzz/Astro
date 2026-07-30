"use client";

import { useId, useState } from "react";

// Graficos em SVG desenhados a mao — sem biblioteca.
//
// Sao tres formas simples (coluna empilhada, minilinha, barra horizontal) e a
// geometria de cada uma e regra de tres: valor / maior valor x espaco
// disponivel. Em troca das ~150 linhas daqui, o pacote nao cresce e o grafico
// vem pronto no HTML — canvas precisaria baixar e executar JavaScript antes de
// pintar qualquer pixel.
//
// Especificacoes seguidas (guia de visualizacao de dados do projeto):
//   - barra com no maximo 24px de espessura, topo arredondado em 4px e base
//     reta apoiada na linha zero
//   - 2px de respiro na cor da superficie entre segmentos que se tocam
//   - grade e eixos em fio de 1px, solidos, um passo acima da superficie
//   - rotulo nunca veste a cor do dado; identidade vem da marca colorida ao lado
//   - tooltip complementa, nunca e o unico caminho para o valor (existe a
//     visao em tabela)

// Azul claro em vez do azul padrao da marca: 5,09:1 de contraste contra a
// superficie do painel, contra 3,62:1 do outro. Em barra fina isso aparece.
export const COR_DADO = "#3b82f6";
export const COR_CONTEXTO = "#8a97b1";
export const COR_ALTERNATIVA = "#d95926";
const COR_SUPERFICIE = "#0b1220";
const COR_GRADE = "#1b2438";

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
// Minilinha do cartao de indicador (sparkline)
// ---------------------------------------------------------------------------

export function Minilinha({ valores }: { valores: number[] }) {
  const id = useId();
  if (valores.length < 2) return null;

  const L = 120;
  const A = 32;
  const max = Math.max(...valores, 1);

  const pontos = valores.map((v, i) => {
    const x = (i / (valores.length - 1)) * L;
    const y = A - (v / max) * A;
    return [x, y] as const;
  });

  const linha = pontos.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ");
  const area = `${linha} L${L},${A} L0,${A} Z`;
  const [ux, uy] = pontos[pontos.length - 1];

  return (
    <svg
      viewBox={`0 0 ${L} ${A}`}
      className="h-8 w-full"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`g-${id}`} x1="0" y1="0" x2="0" y2="1">
          {/* area = a mesma cor da serie a ~10% — uma lavagem, nunca bloco */}
          <stop offset="0%" stopColor={COR_DADO} stopOpacity="0.18" />
          <stop offset="100%" stopColor={COR_DADO} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#g-${id})`} />
      <path
        d={linha}
        fill="none"
        stroke={COR_DADO}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* ponto final com anel na cor da superficie, para nao sumir na linha */}
      <circle cx={ux} cy={uy} r="2.5" fill={COR_DADO} stroke={COR_SUPERFICIE} strokeWidth="1.5" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Colunas empilhadas por dia
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
  const marcas = [0, topo / 2, topo];

  const ALTURA = 180;
  // Espessura limitada a 24px, com 2px de respiro entre barras vizinhas.
  const larguraBarra = Math.min(24, Math.max(3, 640 / dados.length - 2));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        {/* Legenda: obrigatoria a partir de duas series */}
        <div className="flex items-center gap-4">
          <LegendaItem cor={COR_DADO} rotulo="Recebido" />
          {temPendente && <LegendaItem cor={COR_CONTEXTO} rotulo="A receber" />}
        </div>
        <button
          onClick={() => setTabela((v) => !v)}
          className="rounded-md border border-admin-border px-2.5 py-1 font-mono text-[0.65rem] uppercase tracking-wider text-astro-muted transition hover:text-white"
        >
          {tabela ? "Ver grafico" : "Ver tabela"}
        </button>
      </div>

      {tabela ? (
        <TabelaDias dados={dados} />
      ) : (
        <div className="relative">
          <div className="flex gap-3">
            {/* Eixo de valores */}
            <div
              className="flex shrink-0 flex-col justify-between text-right font-mono text-[0.6rem] tabular-nums text-astro-muted"
              style={{ height: ALTURA }}
            >
              {[...marcas].reverse().map((m) => (
                <span key={m}>{formatarReal(m, true)}</span>
              ))}
            </div>

            <div className="min-w-0 flex-1">
              <svg
                viewBox={`0 0 640 ${ALTURA}`}
                className="w-full"
                style={{ height: ALTURA }}
                preserveAspectRatio="none"
                role="img"
                aria-label="Receita por dia no periodo"
              >
                {/* grade em fio solido, recessiva */}
                {marcas.map((m) => {
                  const y = ALTURA - (m / topo) * ALTURA;
                  return (
                    <line
                      key={m}
                      x1="0"
                      y1={y}
                      x2="640"
                      y2={y}
                      stroke={COR_GRADE}
                      strokeWidth="1"
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })}

                {dados.map((d, i) => {
                  const cx = ((i + 0.5) / dados.length) * 640;
                  const x = cx - larguraBarra / 2;
                  const hRec = (d.recebido / topo) * ALTURA;
                  const hPen = (d.pendente / topo) * ALTURA;
                  const ativo = foco === i;

                  return (
                    <g
                      key={d.dia}
                      onMouseEnter={() => setFoco(i)}
                      onMouseLeave={() => setFoco(null)}
                      opacity={foco === null || ativo ? 1 : 0.45}
                    >
                      {/* alvo de hover generoso: cobre a faixa inteira do dia */}
                      <rect
                        x={cx - 640 / dados.length / 2}
                        y={0}
                        width={640 / dados.length}
                        height={ALTURA}
                        fill="transparent"
                      />
                      {d.pendente > 0 && (
                        <rect
                          x={x}
                          y={ALTURA - hRec - hPen}
                          width={larguraBarra}
                          height={Math.max(0, hPen - (hRec > 0 ? 2 : 0))}
                          rx="4"
                          fill={COR_CONTEXTO}
                        />
                      )}
                      {d.recebido > 0 && (
                        <rect
                          x={x}
                          y={ALTURA - hRec}
                          width={larguraBarra}
                          height={hRec}
                          // topo arredondado, base reta na linha zero
                          rx={d.pendente > 0 ? 0 : 4}
                          fill={COR_DADO}
                        />
                      )}
                    </g>
                  );
                })}

                {/* linha de base */}
                <line
                  x1="0"
                  y1={ALTURA}
                  x2="640"
                  y2={ALTURA}
                  stroke={COR_GRADE}
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>

              {/* faixa do eixo de datas — dentro do container, nunca cortada */}
              <div className="mt-2 flex justify-between font-mono text-[0.6rem] tabular-nums text-astro-muted">
                <span>{rotuloDia(dados[0]?.dia)}</span>
                {dados.length > 2 && (
                  <span>{rotuloDia(dados[Math.floor(dados.length / 2)]?.dia)}</span>
                )}
                <span>{rotuloDia(dados[dados.length - 1]?.dia)}</span>
              </div>
            </div>
          </div>

          {/* Tooltip: complementa a leitura, nao a substitui */}
          {foco !== null && dados[foco] && (
            <div className="pointer-events-none mt-3 inline-flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-admin-border bg-admin-bg px-3 py-2">
              <span className="font-mono text-[0.65rem] uppercase tracking-wider text-astro-muted">
                {rotuloDia(dados[foco].dia, true)}
              </span>
              <span className="flex items-center gap-1.5 text-sm text-white">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: COR_DADO }}
                />
                {formatarReal(dados[foco].recebido)}
              </span>
              {dados[foco].pendente > 0 && (
                <span className="flex items-center gap-1.5 text-sm text-astro-muted">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: COR_CONTEXTO }}
                  />
                  {formatarReal(dados[foco].pendente)}
                </span>
              )}
            </div>
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
    <div className="max-h-64 overflow-y-auto rounded-lg border border-admin-border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-admin-surface">
          <tr className="border-b border-admin-border">
            <th className="astro-label px-3 py-2 text-left">Dia</th>
            <th className="astro-label px-3 py-2 text-right">Recebido</th>
            <th className="astro-label px-3 py-2 text-right">A receber</th>
          </tr>
        </thead>
        <tbody>
          {comMovimento.map((d) => (
            <tr key={d.dia} className="border-b border-admin-border/60 last:border-0">
              <td className="px-3 py-2 font-mono tabular-nums text-slate-200">
                {rotuloDia(d.dia, true)}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums text-white">
                {formatarReal(d.recebido)}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums text-astro-muted">
                {d.pendente ? formatarReal(d.pendente) : "—"}
              </td>
            </tr>
          ))}
          {comMovimento.length === 0 && (
            <tr>
              <td colSpan={3} className="px-3 py-6 text-center text-astro-muted">
                Nenhum movimento no periodo.
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
      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: cor }} />
      {rotulo}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Barras horizontais — magnitude comparada
// ---------------------------------------------------------------------------

export function BarrasHorizontais({
  itens,
}: {
  itens: { rotulo: string; valor: number; nota?: string }[];
}) {
  const max = Math.max(...itens.map((i) => i.valor), 1);

  return (
    <ul className="space-y-3">
      {itens.map((i) => (
        <li key={i.rotulo}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 truncate text-sm text-slate-200">
              {i.rotulo}
              {i.nota && (
                <span className="ml-2 font-mono text-[0.65rem] text-astro-muted">
                  {i.nota}
                </span>
              )}
            </p>
            <p className="shrink-0 text-sm font-semibold text-white">
              {formatarReal(i.valor)}
            </p>
          </div>
          {/* Categorias nominais: todas na MESMA cor. Colorir cada barra de um
              jeito gastaria o canal de identidade repetindo o que o comprimento
              da barra ja diz. */}
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-admin-surface-2">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(2, (i.valor / max) * 100)}%`,
                backgroundColor: COR_DADO,
              }}
            />
          </div>
        </li>
      ))}
      {itens.length === 0 && (
        <li className="py-6 text-center text-sm text-astro-muted">
          Nenhuma receita no periodo.
        </li>
      )}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Divisao entre duas partes — barra empilhada unica
// ---------------------------------------------------------------------------

export function BarraDivisao({
  a,
  b,
}: {
  a: { rotulo: string; valor: number };
  b: { rotulo: string; valor: number };
}) {
  const total = a.valor + b.valor;

  if (total === 0) {
    return (
      <p className="py-6 text-center text-sm text-astro-muted">
        Nenhum pagamento confirmado no periodo.
      </p>
    );
  }

  const pctA = (a.valor / total) * 100;

  return (
    <div>
      {/* Uma barra, dois segmentos, 2px de respiro entre eles. Rosca de duas
          fatias e anti-padrao: a proporcao le pior num arco do que num
          comprimento lado a lado. */}
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
        <div style={{ width: `${pctA}%`, backgroundColor: COR_DADO }} />
        <div style={{ width: `${100 - pctA}%`, backgroundColor: COR_ALTERNATIVA }} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        {[
          { ...a, cor: COR_DADO, pct: pctA },
          { ...b, cor: COR_ALTERNATIVA, pct: 100 - pctA },
        ].map((s) => (
          <div key={s.rotulo}>
            <span className="flex items-center gap-2 text-xs text-astro-muted">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: s.cor }}
              />
              {s.rotulo}
            </span>
            <p className="mt-1 text-xl font-bold text-white">{s.valor}</p>
            <p className="font-mono text-[0.65rem] text-astro-muted">
              {s.pct.toFixed(0)}% dos atendimentos
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
