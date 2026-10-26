"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import { useState } from "react";

// Cartao do plano unico, com a troca entre cobranca mensal e anual. O anual
// mostra o total do ano e a economia em reais, nao so o valor por mes.

const PLANOS = {
  mensal: { mes: 50, etiqueta: "cobrança mensal", conta: "R$ 50 por mês, sem desconto.", economia: null },
  anual: { mes: 35, etiqueta: "cobrança anual", conta: "R$ 420 por ano.", economia: "Você economiza R$ 180 em relação ao mensal." },
} as const;

type Cobranca = keyof typeof PLANOS;

const INCLUI = [
  "Site de agendamento com o seu logo e a sua cor",
  "Agendamentos, clientes e serviços ilimitados",
  "Preço por porte do carro e acréscimo por condição",
  "PIX copia e cola com a sua chave",
  "Confirmação e lembretes por e-mail e Telegram",
  "Painel do dia, agendamentos e financeiro",
];

export function Plano() {
  const [cobranca, setCobranca] = useState<Cobranca>("anual");
  const plano = PLANOS[cobranca];

  return (
    <div className="grid justify-items-center gap-7">
      <div role="group" aria-label="Forma de cobrança" className="inline-flex rounded-full border border-landing-line bg-landing-card p-1">
        {(["mensal", "anual"] as const).map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={cobranca === c}
            onClick={() => setCobranca(c)}
            className={`relative inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-5 text-sm font-bold transition-colors ${
              cobranca === c ? "text-white" : "text-landing-muted hover:text-landing-ink"
            }`}
          >
            {cobranca === c && (
              <motion.span
                layoutId="cobranca-ativa"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
                className="absolute inset-0 rounded-full bg-[linear-gradient(135deg,#2563eb,#1d4ed8)]"
              />
            )}
            <span className="relative">{c === "mensal" ? "Mensal" : "Anual"}</span>
            {c === "anual" && (
              <span
                className={`relative rounded-full px-1.5 py-0.5 text-[0.7rem] ${
                  cobranca === "anual" ? "bg-white/20 text-white" : "bg-emerald-400/15 text-emerald-400"
                }`}
              >
                -30%
              </span>
            )}
          </button>
        ))}
      </div>

      <article className="grid w-full max-w-[31rem] gap-6 rounded-[1.75rem] border border-landing-glow/45 bg-[linear-gradient(180deg,#27272a,#111113)] p-6 shadow-[0_30px_80px_-30px_rgba(37,99,235,0.6)] sm:p-9">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-2xl font-extrabold">Astro</h3>
          <span className="text-sm text-landing-muted">{plano.etiqueta}</span>
        </div>

        <div aria-live="polite" className="grid gap-2">
          <div className="flex items-baseline gap-1.5 tabular-nums">
            <span className="text-xl font-bold text-landing-muted">R$</span>
            {/* O numero troca deslizando para cima ao mudar a cobranca. */}
            <span className="relative inline-flex h-[4.2rem] overflow-hidden">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={plano.mes}
                  initial={{ y: "100%", opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: "-100%", opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 28 }}
                  className="text-[4rem] leading-none font-extrabold tracking-tighter"
                >
                  {plano.mes}
                </motion.span>
              </AnimatePresence>
            </span>
            <span className="text-landing-muted">/mês</span>
          </div>
          <p className="text-landing-muted">
            {plano.conta}{" "}
            {plano.economia && <b className="text-emerald-400">{plano.economia}</b>}
          </p>
        </div>

        <ul className="grid gap-3">
          {INCLUI.map((item) => (
            <li key={item} className="flex items-start gap-3">
              <Check className="mt-1 size-4 shrink-0 text-landing-glow" strokeWidth={3} />
              {item}
            </li>
          ))}
        </ul>

        <a href="#duvidas" className="landing-btn landing-btn-primary w-full">
          Assinar o Astro
        </a>
      </article>
    </div>
  );
}
