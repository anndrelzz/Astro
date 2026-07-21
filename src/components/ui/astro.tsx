import Link from "next/link";
import { ArrowRight, ArrowLeft } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

// Wordmark ASTRO com o "A" estilizado (chevron), conforme mockups.
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold tracking-[0.2em] ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-[1.1em] w-[1.1em]" fill="none">
        <path
          d="M12 3 L21 20 L14.5 16 L12 21 L9.5 16 L3 20 Z"
          fill="currentColor"
        />
      </svg>
      <span>ASTRO</span>
    </span>
  );
}

// Botao voltar (quadrado arredondado translucido).
export function BackButton({ href }: { href: string }) {
  return (
    <Link
      href={href}
      aria-label="Voltar"
      className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10"
    >
      <ArrowLeft className="h-5 w-5" />
    </Link>
  );
}

// Label tecnica em maiuscula espacada.
export function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="astro-label block">{children}</label>;
}

// Campo com icone a esquerda e slot opcional a direita (ex: mostrar senha).
export function Field({
  icon,
  right,
  ...props
}: ComponentProps<"input"> & { icon: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-astro-border bg-astro-surface px-4 py-3 focus-within:border-astro-blue-bright/60">
      <span className="text-astro-muted">{icon}</span>
      <input
        {...props}
        className="w-full bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
      />
      {right}
    </div>
  );
}

// Botao primario azul com seta em circulo branco.
export function PrimaryButton({
  children,
  ...props
}: ComponentProps<"button">) {
  return (
    <button
      {...props}
      className="flex w-full items-center justify-between gap-2 rounded-xl bg-gradient-to-r from-astro-blue to-astro-blue-bright px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-astro-blue/25 transition hover:brightness-110 disabled:opacity-50"
    >
      <span className="flex-1 text-center">{children}</span>
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
        <ArrowRight className="h-4 w-4" />
      </span>
    </button>
  );
}
