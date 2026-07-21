"use client";

import { signIn } from "next-auth/react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

// RN02, UC01, UC03 — ao acessar a URL da estetica sem sessao, o sistema
// exibe login ou cadastro. Apos cadastro, login automatico e retorno ao
// fluxo (callbackUrl).
export default function LoginPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? `/${slug}`;

  const [modo, setModo] = useState<"login" | "cadastro">("login");

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function autenticar() {
    const resultado = await signIn("credentials", {
      email,
      password: senha,
      tenantSlug: slug,
      redirect: false,
    });

    if (resultado?.error) {
      setErro("E-mail ou senha invalidos.");
      return false;
    }
    return true;
  }

  async function handleSubmitLogin(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    const ok = await autenticar();

    setCarregando(false);
    if (ok) {
      router.push(callbackUrl);
      router.refresh();
    }
  }

  async function handleSubmitCadastro(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    const resposta = await fetch("/api/auth/cadastro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantSlug: slug, nome, email, telefone, senha }),
    });

    if (!resposta.ok) {
      const json = await resposta.json().catch(() => null);
      setErro(json?.error ?? "Nao foi possivel criar a conta.");
      setCarregando(false);
      return;
    }

    // UC01 — apos salvar o cadastro, o cliente retorna ao fluxo (login automatico).
    const ok = await autenticar();

    setCarregando(false);
    if (ok) {
      router.push(callbackUrl);
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <form
        onSubmit={modo === "login" ? handleSubmitLogin : handleSubmitCadastro}
        className="w-full max-w-sm space-y-4 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800"
      >
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          {modo === "login" ? "Entrar" : "Criar conta"}
        </h1>

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        {modo === "cadastro" && (
          <>
            <input
              type="text"
              placeholder="Nome completo"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
            <input
              type="tel"
              placeholder="Telefone"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              required
              className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </>
        )}

        <input
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <input
          type="password"
          placeholder="Senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
          minLength={modo === "cadastro" ? 6 : undefined}
          className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />

        <button
          type="submit"
          disabled={carregando}
          className="w-full rounded bg-zinc-900 py-2 text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-black"
        >
          {carregando
            ? "Aguarde..."
            : modo === "login"
              ? "Entrar"
              : "Criar conta e continuar"}
        </button>

        <button
          type="button"
          onClick={() => {
            setErro(null);
            setModo(modo === "login" ? "cadastro" : "login");
          }}
          className="w-full text-center text-sm text-zinc-600 underline dark:text-zinc-400"
        >
          {modo === "login"
            ? "Nao tem conta? Criar conta"
            : "Ja tem conta? Entrar"}
        </button>
      </form>
    </div>
  );
}
