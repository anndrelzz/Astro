"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";

// Animacao de sucesso (login/cadastro), inspirada no app DinDin e adaptada
// para a identidade do Astro: fundo navy, circulo azul com ondas, sparkles
// azuis e barra de progresso — no mesmo espirito da tela 12 (confirmado).

// Posicoes fixas das estrelinhas (deterministico, sem hydration mismatch).
const SPARKLES = [
  { x: 18, y: 20, size: 16, delay: 0.4, dur: 3.2 },
  { x: 80, y: 16, size: 11, delay: 1.1, dur: 2.6 },
  { x: 12, y: 52, size: 9, delay: 0.7, dur: 3.8 },
  { x: 85, y: 44, size: 14, delay: 0.2, dur: 2.9 },
  { x: 22, y: 76, size: 10, delay: 1.6, dur: 3.4 },
  { x: 76, y: 74, size: 12, delay: 0.9, dur: 2.7 },
  { x: 50, y: 12, size: 9, delay: 1.9, dur: 3.6 },
  { x: 90, y: 28, size: 11, delay: 0.5, dur: 2.4 },
];

const AZUL = "#3b82f6"; // astro-blue-bright
const MUTED = "#8a97b1"; // astro-muted

function Sparkle({ x, y, size, delay, dur }: (typeof SPARKLES)[number]) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0, rotate: 0 }}
      animate={{ opacity: [0, 1, 0.7, 1, 0], scale: [0, 1, 0.85, 1, 0], rotate: 180 }}
      transition={{ delay, duration: dur, repeat: Infinity, ease: "easeInOut" }}
      style={{ position: "absolute", left: `${x}%`, top: `${y}%`, willChange: "transform, opacity" }}
    >
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
        <path d="M8 0 L8.6 6.4 L8 8 L7.4 6.4 Z" fill={AZUL} />
        <path d="M16 8 L9.6 8.6 L8 8 L9.6 7.4 Z" fill={AZUL} />
        <path d="M8 16 L7.4 9.6 L8 8 L8.6 9.6 Z" fill={AZUL} />
        <path d="M0 8 L6.4 7.4 L8 8 L6.4 8.6 Z" fill={AZUL} />
      </svg>
    </motion.div>
  );
}

export function SuccessScreen({
  title,
  subtitle = "Entrando no app…",
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="astro-dark fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden"
    >
      {SPARKLES.map((s, i) => (
        <Sparkle key={i} {...s} />
      ))}

      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", damping: 14, stiffness: 200, delay: 0.1 }}
        className="relative mb-8"
      >
        {/* Ondas pulsantes */}
        <motion.div
          animate={{ scale: [1, 1.7], opacity: [0.45, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 0.6, ease: "easeOut", delay: 0.4 }}
          className="absolute inset-0 rounded-full"
          style={{ backgroundColor: AZUL, willChange: "transform, opacity" }}
        />
        <motion.div
          animate={{ scale: [1, 1.4], opacity: [0.3, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 0.6, ease: "easeOut", delay: 0.8 }}
          className="absolute inset-0 rounded-full"
          style={{ backgroundColor: AZUL, willChange: "transform, opacity" }}
        />
        <div
          className="flex h-28 w-28 items-center justify-center rounded-full"
          style={{
            background: "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)",
            boxShadow: "0 8px 40px rgba(37,99,235,0.55)",
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.35, type: "spring", stiffness: 300 }}
          >
            <Check size={56} color="#ffffff" strokeWidth={2.5} />
          </motion.div>
        </div>
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
        className="mb-2 text-center text-2xl font-bold text-white"
      >
        {title}
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="text-center text-sm"
        style={{ color: MUTED }}
      >
        {subtitle}
      </motion.p>

      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.3, duration: 1.9, ease: "linear" }}
        style={{ originX: 0, backgroundColor: AZUL }}
        className="absolute bottom-0 left-0 right-0 h-1"
      />
    </motion.div>
  );
}
