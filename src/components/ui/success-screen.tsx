"use client";

import { motion, useReducedMotion } from "framer-motion";

// Tela de sucesso (login, cadastro e agendamento confirmado).
//
// Uma animacao so, em tres tempos e sem nada repetindo para sempre: o anel se
// desenha girando, o centro cresce e preenche o circulo, e o "certo" se
// desenha por cima. Tudo na cor da estetica (--color-astro-blue). O fundo e
// escuro e limpo, com um unico brilho suave atras do circulo, que se abre
// uma vez junto com o preenchimento.
//
// Com "reduzir movimento" ligado no sistema, a tela aparece ja no estado
// final, sem animar.

const COR = "var(--color-astro-blue)";
const COR_CLARA = "var(--color-astro-blue-bright)";

// Ritmo: desenhar o anel, preencher, desenhar o certo, e so entao o texto.
const T = { anel: 0.15, preencher: 0.6, certo: 0.95, texto: 1.15 };
const DESACELERA = [0.22, 1, 0.36, 1] as const;

export function SuccessScreen({ title, subtitle = "Entrando no app…" }: { title: string; subtitle?: string }) {
  const parado = useReducedMotion();
  const quando = (atraso: number, duracao: number) =>
    parado ? { duration: 0 } : { delay: atraso, duration: duracao, ease: DESACELERA };

  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: parado ? 0 : 0.25 }}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden bg-[#050507]"
    >
      {/* Brilho unico atras do circulo: abre uma vez e fica */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={quando(T.preencher, 1.1)}
        className="pointer-events-none absolute h-[38rem] w-[38rem] rounded-full"
        style={{ background: `radial-gradient(closest-side, color-mix(in srgb, ${COR} 32%, transparent), transparent)` }}
      />

      <div className="relative mb-9 h-32 w-32">
        <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden>
          {/* Trilho do anel */}
          <circle cx="60" cy="60" r="54" fill="none" stroke="white" strokeOpacity="0.06" strokeWidth="6" />

          {/* Anel se desenhando, girando de leve enquanto fecha */}
          <motion.circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke={COR_CLARA}
            strokeWidth="6"
            strokeLinecap="round"
            style={{ rotate: -90, transformOrigin: "60px 60px" }}
            initial={{ pathLength: 0, rotate: -90 }}
            animate={{ pathLength: 1, rotate: 270 }}
            transition={quando(T.anel, 0.75)}
          />

          {/* Centro: comeca como um ponto e cresce ate encher o circulo */}
          <motion.circle
            cx="60"
            cy="60"
            r="54"
            fill={COR}
            style={{ transformOrigin: "60px 60px" }}
            initial={{ scale: 0.04 }}
            animate={{ scale: 1 }}
            transition={parado ? { duration: 0 } : { delay: T.preencher, type: "spring", stiffness: 170, damping: 18 }}
          />

          {/* Certo desenhado por cima */}
          <motion.path
            d="M38 61 L53 76 L83 45"
            fill="none"
            stroke="white"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={quando(T.certo, 0.35)}
          />
        </svg>
      </div>

      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={quando(T.texto, 0.4)}
        className="mb-1.5 text-center text-2xl font-bold text-white"
      >
        {title}
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={quando(T.texto + 0.08, 0.4)}
        className="text-center text-sm text-astro-muted"
      >
        {subtitle}
      </motion.p>

      {/* Progresso ate abrir o app: avanca em ritmo constante (linear) */}
      <motion.div
        aria-hidden
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={parado ? { duration: 0 } : { delay: 0.2, duration: 2, ease: "linear" }}
        style={{ originX: 0, backgroundColor: COR_CLARA }}
        className="absolute right-0 bottom-0 left-0 h-0.5"
      />
    </motion.div>
  );
}
