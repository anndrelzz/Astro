"use client";

import { MotionConfig, motion } from "framer-motion";
import type { ReactNode } from "react";

// Envolve a landing inteira: com reducedMotion="user", o framer-motion
// respeita o "reduzir movimento" do aparelho e troca deslocamentos e escalas
// por troca direta de estado (opacidade e cor continuam).
export function ConfigAnimacao({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

// Faz um bloco surgir (sobe e aparece) quando entra na tela ao rolar a pagina.
// "once": anima so na primeira vez — rolar para cima e para baixo de novo nao
// repete o efeito. Quem pede menos movimento no aparelho ve o bloco parado
// (MotionConfig reducedMotion="user" em landing.tsx).
export function Revelar({
  children,
  atraso = 0,
  className,
}: {
  children: ReactNode;
  atraso?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: atraso }}
    >
      {children}
    </motion.div>
  );
}
