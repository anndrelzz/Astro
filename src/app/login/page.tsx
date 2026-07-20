// Placeholder do fluxo de login (RN02, UC01). A logica de submit (signIn do
// next-auth/react com email + senha + tenantSlug) entra no M2, junto com o
// restante do fluxo de agendamento.
export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <form className="w-full max-w-sm space-y-4 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Entrar
        </h1>
        <input
          type="email"
          placeholder="E-mail"
          className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <input
          type="password"
          placeholder="Senha"
          className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          className="w-full rounded bg-zinc-900 py-2 text-white dark:bg-zinc-50 dark:text-black"
        >
          Entrar
        </button>
      </form>
    </div>
  );
}
