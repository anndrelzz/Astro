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

// Cabecalho escuro com botao voltar e titulo centralizado (telas 08, 10, 11).
export function ScreenHeader({
  href,
  title,
  children,
}: {
  href: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="astro-dark px-5 pb-8 pt-6">
      <div className="mx-auto flex max-w-md items-center justify-between">
        <Link
          href={href}
          aria-label="Voltar"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-semibold text-white">{title}</h1>
        <span className="h-11 w-11" />
      </div>
      {children}
    </div>
  );
}

// Campo com icone a esquerda e slot opcional a direita (ex: mostrar senha).
//
// claroNoDesktop: as telas de login e cadastro sao escuras no celular e claras
// no desktop (telas 02 e 03 do mockup). Em vez de duplicar o componente, o
// campo ganha a variante clara a partir de lg. Quem nao passa a flag continua
// escuro em qualquer largura.
export function Field({
  icon,
  right,
  claroNoDesktop = false,
  ...props
}: ComponentProps<"input"> & {
  icon: ReactNode;
  right?: ReactNode;
  claroNoDesktop?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border border-astro-border bg-astro-surface px-4 py-3 focus-within:border-astro-blue-bright/60 ${
        claroNoDesktop
          ? "lg:border-zinc-200 lg:bg-zinc-50 lg:focus-within:border-astro-blue"
          : ""
      }`}
    >
      <span className={`text-astro-muted ${claroNoDesktop ? "lg:text-zinc-400" : ""}`}>
        {icon}
      </span>
      <input
        {...props}
        className={`w-full bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none ${
          claroNoDesktop ? "lg:text-zinc-900 lg:placeholder:text-zinc-400" : ""
        }`}
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
