import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/front/componentes/astro";

// Molde das paginas /termos e /privacidade (LGPD, RNF08): o logo do Astro, o
// titulo, o aviso de versao academica e as secoes. Texto longo para ler, entao
// fundo escuro do site com letra clara e linhas curtas.

export function DocumentoLegal({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-black px-4 py-8 text-zinc-300 lg:py-14">
      <article className="mx-auto max-w-3xl">
        <Link href="/" aria-label="Astro, página inicial" className="inline-block">
          <Logo className="h-8" />
        </Link>

        <h1 className="mt-8 text-3xl font-bold text-white lg:text-4xl">{titulo}</h1>
        <p className="mt-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          Versão acadêmica, sem revisão jurídica (novembro de 2026). O Astro é um Trabalho de Conclusão de Curso;
          antes de uso comercial, este texto precisa ser revisado por um advogado.
        </p>

        <div className="mt-8 space-y-8 text-[15px] leading-relaxed">{children}</div>
      </article>
    </div>
  );
}

// O id vem do titulo, para a secao ser uma "regiao" com nome (leitor de tela e
// testes a acham pelo titulo).
export function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  const id = `secao-${titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-xl font-semibold text-white">
        {titulo}
      </h2>
      <div className="mt-3 space-y-3 [&_a]:text-astro-blue-bright [&_a]:underline [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-white [&_ul]:space-y-1.5">
        {children}
      </div>
    </section>
  );
}
