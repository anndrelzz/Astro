import Link from "next/link";

// Landing institucional do Astro (apresentacao do produto + contato via
// WhatsApp para provisionamento manual de novas esteticas). Fica para depois
// da fundacao multi-tenant (M1) — ver README, secao "Planejamento".
export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 dark:bg-black">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Astro
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Landing institucional — em construcao.
      </p>
      {/* Atalho temporario so para navegacao durante o desenvolvimento (remover
          quando a landing de verdade entrar). */}
      <Link
        href="/dev"
        className="text-sm font-medium text-zinc-900 underline dark:text-zinc-50"
      >
        Ir para o painel de testes
      </Link>
    </div>
  );
}
