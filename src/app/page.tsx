import { redirect } from "next/navigation";

// Landing institucional do Astro (apresentacao do produto + contato via
// WhatsApp para provisionamento manual de novas esteticas). Fica para depois
// da fundacao multi-tenant (M1) — ver README, secao "Planejamento".
export default function Home() {
  // Atalho de desenvolvimento: com TENANT_PADRAO no .env, a raiz manda direto
  // para o login daquela estetica, para nao ter de digitar o slug a cada vez.
  // Sem a variavel — que e o caso em producao — a raiz e a landing.
  const tenantPadrao = process.env.TENANT_PADRAO;
  if (tenantPadrao) redirect(`/${tenantPadrao}/login`);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 dark:bg-black">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Astro
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Landing institucional — em construcao.
      </p>
    </div>
  );
}
