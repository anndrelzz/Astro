import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/ui/astro";
import { ThemeColor } from "@/components/ui/theme-color";

// Tela 01 do mockup mobile — "TELA INICIAL". Hero de entrada da estetica
// exibido quando o visitante ainda nao esta logado: chamada, subtitulo e o
// botao "Agendar agora" que leva ao login/cadastro (e de la ao fluxo).
export function Hero({ slug, nome }: { slug: string; nome: string }) {
  // Pilula de data no canto superior (ex: "20 JUL"), como no mockup.
  const hoje = new Date()
    .toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
    .replace(".", "")
    .toUpperCase();

  return (
    <div className="astro-dark flex min-h-dvh flex-col px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+1.5rem)]">
      <ThemeColor color="#0b1120" />

      {/* Topo: logo + data */}
      <header className="mx-auto flex w-full max-w-md items-center justify-between">
        <Logo className="text-lg text-white" />
        <span className="astro-label rounded-full border border-white/10 bg-white/5 px-3 py-1.5 !text-white/70">
          {hoje}
        </span>
      </header>

      {/* Chamada + acao, ancoradas embaixo */}
      <div className="mx-auto mt-auto w-full max-w-md">
        <h1 className="text-4xl font-bold leading-[1.05] text-white">
          Cuide do
          <br />
          seu carro
          <br />
          como ele{" "}
          <span className="italic text-astro-blue-bright">merece</span>.
        </h1>
        <p className="mt-5 max-w-xs text-sm leading-relaxed text-astro-muted">
          Agendamento online rápido e sem complicação. Estética, polimento e
          higienização com profissionais certificados.
        </p>

        <Link
          href={`/${slug}/login`}
          className="mt-8 flex items-center justify-between gap-2 rounded-2xl bg-gradient-to-r from-astro-blue to-astro-blue-bright px-6 py-4 text-base font-semibold text-white shadow-lg shadow-astro-blue/30 transition hover:brightness-110"
        >
          <span>Agendar agora</span>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
            <ArrowRight className="h-5 w-5" />
          </span>
        </Link>

        {/* Rodape tecnico */}
        <div className="mt-6 flex items-center justify-between">
          <span className="astro-label !text-white/30">{nome}</span>
          <div className="flex items-center gap-1.5">
            <span className="h-1 w-6 rounded-full bg-white/60" />
            <span className="h-1 w-3 rounded-full bg-white/15" />
            <span className="h-1 w-3 rounded-full bg-white/15" />
            <span className="h-1 w-3 rounded-full bg-white/15" />
          </div>
        </div>
      </div>
    </div>
  );
}
