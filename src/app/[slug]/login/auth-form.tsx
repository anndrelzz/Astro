"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ArrowRight, Mail, Lock, User, Phone, Eye, EyeOff } from "lucide-react";
import { Logo, Field, FieldLabel, PrimaryButton } from "@/components/ui/astro";
import { ThemeColor } from "@/components/ui/theme-color";
import { SuccessScreen } from "@/components/ui/success-screen";
import { PainelMarca } from "./painel-marca";

// Regras de senha exibidas ao usuario no cadastro. Precisam bater exatamente
// com o que /api/auth/cadastro valida — texto que promete uma regra e servidor
// que aceita outra e pior do que nao ter texto nenhum.
const REGRAS_SENHA = [
  { rotulo: "8 caracteres", ok: (s: string) => s.length >= 8 },
  { rotulo: "1 número", ok: (s: string) => /\d/.test(s) },
  { rotulo: "1 letra maiúscula", ok: (s: string) => /[A-Z]/.test(s) },
];

// RN02, UC01, UC03 — telas 02 (login) e 03 (cadastro). Sao rotas separadas
// (/login e /cadastro), como no mockup: assim o "Criar agora" e uma navegacao
// real (funciona antes mesmo do JS hidratar) e nao um toggle client-side.
//
// Layout: no celular e uma coluna escura unica. A partir de lg vira a tela
// dividida do mockup — painel de marca de um lado, formulario claro do outro,
// com os lados invertidos entre login e cadastro.
export function AuthForm({ modo }: { modo: "login" | "cadastro" }) {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? `/${slug}`;

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [senha, setSenha] = useState("");
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  // So habilita o submit apos a hidratacao: evita que um toque antes do JS
  // carregar dispare um submit nativo do form (recarrega a pagina em silencio).
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  const eLogin = modo === "login";
  const atendidas = REGRAS_SENHA.filter((r) => r.ok(senha)).length;

  // Preserva o callbackUrl ao alternar entre login e cadastro.
  const qs = searchParams.get("callbackUrl")
    ? `?callbackUrl=${encodeURIComponent(searchParams.get("callbackUrl")!)}`
    : "";
  const outraRota = eLogin ? `/${slug}/cadastro${qs}` : `/${slug}/login${qs}`;

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    if (!eLogin) {
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
    }

    const ok = await autenticar();
    if (!ok) {
      setCarregando(false);
      return;
    }

    // Mostra a animacao de sucesso e so entao entra no app (RN02).
    setSucesso(true);
    const destino = callbackUrl.startsWith("/") ? callbackUrl : `/${slug}`;
    setTimeout(() => {
      router.push(destino);
      router.refresh();
    }, 2300);
  }

  return (
    <div className="astro-dark min-h-dvh lg:grid lg:min-h-dvh lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <ThemeColor color="#0b1120" />

      {/* Animacao de sucesso (login/cadastro) */}
      <AnimatePresence>
        {sucesso && (
          <SuccessScreen title={eLogin ? "Login realizado!" : "Cadastro realizado!"} />
        )}
      </AnimatePresence>

      <PainelMarca modo={modo} />

      {/* Coluna do formulario */}
      <div
        className={`flex min-h-dvh flex-col px-6 pb-8 pt-[calc(env(safe-area-inset-top)+2rem)] lg:min-h-dvh lg:bg-white lg:px-12 lg:pb-8 lg:pt-8 ${
          eLogin ? "" : "lg:order-1"
        }`}
      >
        {/* Topo: no celular so a marca; no desktop a marca some no login
            (ela ja esta no painel escuro) e aparece o atalho para a outra rota. */}
        <div className="flex items-center justify-between">
          <Logo className={`text-lg text-white ${eLogin ? "lg:hidden" : "lg:text-zinc-900"}`} />
          <p className="hidden text-sm text-zinc-500 lg:block">
            {eLogin ? "Ainda não tem conta? " : "Já tem conta? "}
            <Link
              href={outraRota}
              className="font-semibold text-astro-blue underline-offset-4 hover:underline"
            >
              {eLogin ? "Criar agora" : "Entrar"} →
            </Link>
          </p>
        </div>

        {/* Bloco central */}
        <div className="lg:flex lg:flex-1 lg:flex-col lg:justify-center">
          <div className="lg:mx-auto lg:w-full lg:max-w-md">
            <div className="mt-10 lg:mt-0">
              <p className="astro-label hidden lg:block">
                {eLogin ? "Entrar" : "Criar conta · Etapa 01 / 01"}
              </p>
              <h1 className="text-3xl font-bold leading-tight text-white lg:mt-2 lg:text-zinc-900">
                {eLogin ? (
                  <>
                    <span className="lg:hidden">
                      Bom ter você
                      <br />
                      de <span className="italic text-astro-blue-bright">volta</span>.
                    </span>
                    <span className="hidden lg:inline">Acesse sua conta</span>
                  </>
                ) : (
                  <>
                    Crie sua conta
                    <br className="lg:hidden" />{" "}
                    em <span className="italic text-astro-blue-bright">minutos</span>.
                  </>
                )}
              </h1>
              <p className="mt-3 text-sm text-astro-muted lg:text-zinc-500">
                {eLogin
                  ? "Use o e-mail e a senha cadastrados."
                  : "Comece a agendar seus serviços automotivos premium."}
              </p>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              {erro && (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300 lg:border-red-200 lg:bg-red-50 lg:text-red-600">
                  {erro}
                </p>
              )}

              {!eLogin && (
                <div className="space-y-1.5">
                  <FieldLabel>Nome completo</FieldLabel>
                  <Field
                    claroNoDesktop
                    icon={<User className="h-4 w-4" />}
                    type="text"
                    placeholder="Seu nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                  />
                </div>
              )}

              {/* No cadastro, e-mail e telefone dividem a linha no desktop
                  (tela 03); no celular continuam empilhados. */}
              <div className={!eLogin ? "space-y-5 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0" : ""}>
                <div className="space-y-1.5">
                  <FieldLabel>E-mail</FieldLabel>
                  <Field
                    claroNoDesktop
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
                      claroNoDesktop
                      icon={<Phone className="h-4 w-4" />}
                      type="tel"
                      placeholder="(00) 00000-0000"
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      required
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <FieldLabel>Senha</FieldLabel>
                <Field
                  claroNoDesktop
                  icon={<Lock className="h-4 w-4" />}
                  type={mostrarSenha ? "text" : "password"}
                  placeholder="••••••••"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  minLength={eLogin ? undefined : 8}
                  right={
                    <button
                      type="button"
                      onClick={() => setMostrarSenha((v) => !v)}
                      className="text-astro-muted hover:text-white lg:hover:text-zinc-600"
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

                {/* Medidor de forca (tela 03). Uma barra por regra atendida —
                    o usuario ve exatamente o que falta, e o texto lista as
                    mesmas regras que o servidor exige. */}
                {!eLogin && (
                  <div className="pt-1">
                    <div className="flex gap-1.5" aria-hidden>
                      {REGRAS_SENHA.map((regra, i) => (
                        <span
                          key={regra.rotulo}
                          className={`h-1 flex-1 rounded-full ${
                            senha.length === 0
                              ? "bg-white/10 lg:bg-zinc-200"
                              : i < atendidas
                                ? "bg-astro-blue"
                                : "bg-white/10 lg:bg-zinc-200"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="mt-1.5 text-xs text-astro-muted lg:text-zinc-500">
                      Mínimo de {REGRAS_SENHA.map((r) => r.rotulo).join(", ")}.
                    </p>
                  </div>
                )}
              </div>

              {!eLogin && (
                <label className="flex cursor-pointer items-start gap-2.5 text-sm text-astro-muted lg:text-zinc-600">
                  <input
                    type="checkbox"
                    checked={aceitouTermos}
                    onChange={(e) => setAceitouTermos(e.target.checked)}
                    required
                    className="mt-0.5 h-4 w-4 shrink-0 accent-astro-blue"
                  />
                  <span>
                    Li e aceito os{" "}
                    <strong className="font-semibold text-white lg:text-zinc-900">
                      Termos de uso
                    </strong>{" "}
                    e a{" "}
                    <strong className="font-semibold text-white lg:text-zinc-900">
                      Política de privacidade
                    </strong>{" "}
                    da Astro.
                  </span>
                </label>
              )}

              <PrimaryButton type="submit" disabled={carregando || !montado}>
                {carregando
                  ? "Aguarde..."
                  : !montado
                    ? "Carregando…"
                    : eLogin
                      ? "Entrar"
                      : "Criar conta"}
              </PrimaryButton>
            </form>

            {/* Alternar login/cadastro — no celular fica no rodape;
                no desktop essa navegacao ja esta no topo da coluna. */}
            <div className="mt-8 text-center text-sm text-astro-muted lg:hidden">
              {eLogin ? "Ainda não tem conta? " : "Já tem conta? "}
              <Link
                href={outraRota}
                className="font-semibold text-white underline-offset-4 hover:underline"
              >
                {eLogin ? "Criar agora" : "Entrar"}
              </Link>
            </div>
          </div>
        </div>

        {/* Rodape (so desktop, como no mockup) */}
        <div className="hidden items-center justify-between text-xs text-zinc-400 lg:flex">
          <span>© {new Date().getFullYear()} Astro Estética Automotiva</span>
          {!eLogin && (
            <Link
              href={`/${slug}`}
              className="inline-flex items-center gap-1 hover:text-zinc-600"
            >
              Voltar à vitrine
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
