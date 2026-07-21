"use client";

import { signIn } from "next-auth/react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Mail, Lock, User, Phone, Eye, EyeOff } from "lucide-react";
import { Logo, Field, FieldLabel, PrimaryButton } from "@/components/ui/astro";

// RN02, UC01, UC03 — ao acessar a URL da estetica sem sessao, o sistema
// exibe login ou cadastro. Apos cadastro, login automatico e retorno ao
// fluxo (callbackUrl). Visual conforme mockups (telas 02 e 03).
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
  const [mostrarSenha, setMostrarSenha] = useState(false);
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

    const ok = await autenticar();
    setCarregando(false);
    if (ok) {
      router.push(callbackUrl);
      router.refresh();
    }
  }

  const eLogin = modo === "login";

  return (
    <div className="astro-dark flex min-h-screen flex-col px-6 py-8">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        {/* Cabecalho */}
        <div className="flex items-center justify-between">
          <Logo className="text-lg text-white" />
        </div>

        {/* Titulo */}
        <div className="mt-10">
          <h1 className="text-3xl font-bold leading-tight text-white">
            {eLogin ? (
              <>
                Bom ter você
                <br />
                de <span className="italic text-astro-blue-bright">volta</span>.
              </>
            ) : (
              <>
                Crie sua conta
                <br />
                em <span className="italic text-astro-blue-bright">minutos</span>.
              </>
            )}
          </h1>
          <p className="mt-3 text-sm text-astro-muted">
            {eLogin
              ? "Entre para acompanhar seus agendamentos e veículos."
              : "Comece a agendar seus serviços automotivos premium."}
          </p>
        </div>

        {/* Formulario */}
        <form
          onSubmit={eLogin ? handleSubmitLogin : handleSubmitCadastro}
          className="mt-8 space-y-5"
        >
          {erro && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
              {erro}
            </p>
          )}

          {!eLogin && (
            <div className="space-y-1.5">
              <FieldLabel>Nome completo</FieldLabel>
              <Field
                icon={<User className="h-4 w-4" />}
                type="text"
                placeholder="Seu nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
              />
            </div>
          )}

          <div className="space-y-1.5">
            <FieldLabel>E-mail</FieldLabel>
            <Field
              icon={<Mail className="h-4 w-4" />}
              type="email"
              placeholder="voce@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {!eLogin && (
            <div className="space-y-1.5">
              <FieldLabel>Telefone</FieldLabel>
              <Field
                icon={<Phone className="h-4 w-4" />}
                type="tel"
                placeholder="(00) 00000-0000"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                required
              />
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <FieldLabel>Senha</FieldLabel>
            </div>
            <Field
              icon={<Lock className="h-4 w-4" />}
              type={mostrarSenha ? "text" : "password"}
              placeholder="••••••••"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              minLength={eLogin ? undefined : 6}
              right={
                <button
                  type="button"
                  onClick={() => setMostrarSenha((v) => !v)}
                  className="text-astro-muted hover:text-white"
                  aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                >
                  {mostrarSenha ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              }
            />
          </div>

          <PrimaryButton type="submit" disabled={carregando}>
            {carregando
              ? "Aguarde..."
              : eLogin
                ? "Entrar"
                : "Criar conta e continuar"}
          </PrimaryButton>
        </form>

        {/* Rodape: alternar login/cadastro */}
        <div className="mt-auto pt-8 text-center text-sm text-astro-muted">
          {eLogin ? "Ainda não tem conta? " : "Já tem conta? "}
          <button
            type="button"
            onClick={() => {
              setErro(null);
              setModo(eLogin ? "cadastro" : "login");
            }}
            className="font-semibold text-white underline-offset-4 hover:underline"
          >
            {eLogin ? "Criar agora" : "Entrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
