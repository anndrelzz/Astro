"use client";

import { Eye, EyeOff, Wallet } from "lucide-react";
import { useState } from "react";

// Cartao de faturamento do Dashboard: o numero que o dono mais quer ver, em
// destaque, na cor da estetica (RF13). Os tres periodos chegam prontos do
// servidor (page.tsx); aqui so se escolhe qual mostrar.
//
// O olho esconde os valores — util com o cliente olhando a tela do balcao.

export type Periodo = "hoje" | "semana" | "mes";

export type ResumoPeriodo = {
  rotulo: string;
  recebido: number;
  aReceber: number;
  atendimentos: number;
};

const BOTOES: { valor: Periodo; rotulo: string }[] = [
  { valor: "hoje", rotulo: "Hoje" },
  { valor: "semana", rotulo: "7 dias" },
  { valor: "mes", rotulo: "Mês" },
];

export function CartaoFaturamento({ periodos }: { periodos: Record<Periodo, ResumoPeriodo> }) {
  const [periodo, setPeriodo] = useState<Periodo>("hoje");
  const [oculto, setOculto] = useState(false);

  const atual = periodos[periodo];
  const [reais, centavos] = formatarPartes(atual.recebido);

  return (
    <section
      aria-label="Faturamento"
      className="relative overflow-hidden rounded-3xl p-6 text-white"
      style={{
        backgroundImage:
          "radial-gradient(120% 140% at 100% 0%, var(--color-astro-blue-bright) 0%, var(--color-astro-blue) 40%, color-mix(in srgb, var(--color-astro-blue) 55%, black) 100%)",
        boxShadow:
          "0 24px 60px -24px color-mix(in srgb, var(--color-astro-blue) 80%, transparent), 0 0 50px -10px color-mix(in srgb, var(--color-astro-blue-bright) 45%, transparent)",
      }}
    >
      {/* Aneis de orbita decorativos no canto */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full border border-white/20 shadow-[0_0_0_40px_rgba(255,255,255,0.04),0_0_0_90px_rgba(255,255,255,0.03)]"
      />

      <div className="relative flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-white/85">
          <Wallet className="h-4 w-4" />
          {atual.rotulo}
        </p>
        <button
          type="button"
          onClick={() => setOculto((o) => !o)}
          aria-label={oculto ? "Mostrar valores" : "Esconder valores"}
          aria-pressed={oculto}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-white/10 transition hover:bg-white/20"
        >
          {oculto ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      <p className="relative mt-4 flex items-baseline gap-1.5 font-extrabold tracking-tight tabular-nums">
        <span className="text-xl text-white/70">R$</span>
        <span className="text-5xl leading-none">{oculto ? "••••" : reais}</span>
        {!oculto && <span className="text-2xl text-white/80">,{centavos}</span>}
      </p>

      <div className="relative mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-white/80">
          A receber:{" "}
          <b className="text-white">{oculto ? "R$ ••••" : formatarReal(atual.aReceber)}</b>
          {" · "}
          {atual.atendimentos} atendimento{atual.atendimentos === 1 ? "" : "s"}
        </p>
        <div role="group" aria-label="Período" className="flex rounded-full bg-black/25 p-1">
          {BOTOES.map((b) => (
            <button
              key={b.valor}
              type="button"
              onClick={() => setPeriodo(b.valor)}
              aria-pressed={periodo === b.valor}
              className={
                periodo === b.valor
                  ? "rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-astro-blue"
                  : "rounded-full px-3.5 py-1.5 text-xs font-semibold text-white/85 transition hover:text-white"
              }
            >
              {b.rotulo}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function formatarReal(valor: number) {
  return `R$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// "1.234,50" -> ["1.234", "50"]: os centavos aparecem menores ao lado.
function formatarPartes(valor: number): [string, string] {
  const texto = valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const [inteiro, decimal] = texto.split(",");
  return [inteiro, decimal];
}
