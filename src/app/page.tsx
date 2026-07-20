// Landing institucional do Astro (apresentacao do produto + contato via
// WhatsApp para provisionamento manual de novas esteticas). Fica para depois
// da fundacao multi-tenant (M1) — ver README, secao "Planejamento".
export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-black">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Astro
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Landing institucional — em construcao.
      </p>
    </div>
  );
}
