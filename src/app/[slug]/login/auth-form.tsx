"use client";

import { getSession, signIn } from "next-auth/react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ArrowRight, Mail, Lock, User, Phone, Eye, EyeOff } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Logo } from "@/components/ui/astro";
import { FundoOndas } from "../admin/fundo-ondas";
import { ThemeColor } from "@/components/ui/theme-color";
import { SuccessScreen } from "@/components/ui/success-screen";
import { callbackUrlSeguro } from "@/lib/callback-url";
import { PainelMarca, type Estetica } from "./painel-marca";
import { LIMITES } from "@/lib/validations/limites";

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
// Layout: um cartao sobre o fundo de pontos com ondas (o mesmo do painel). O
// lado colorido, na cor da estetica, tem a borda em curva; o formulario fica
// no lado escuro. No celular o cartao ocupa a tela inteira, o lado colorido
// vira a faixa do topo e tudo cabe na area visivel sem rolar (conferido de
// 375x635, o iPhone X com as barras do Safari, para cima).
export function AuthForm({
  modo,
  estetica,
}: {
  modo: "login" | "cadastro";
  estetica: Estetica;
}) {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Valor fora da propria estetica vira null e e ignorado (ver callback-url.ts).
  const callbackUrlParam = callbackUrlSeguro(
    searchParams.get("callbackUrl"),
    slug,
  );

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
  // react-hooks/set-state-in-effect reclama de setState sincrono no efeito, e
  // esta certa no caso geral: quase sempre significa estado que poderia ser
  // derivado. Aqui nao ha o que derivar — a informacao E "a hidratacao
  // terminou", e o unico jeito de saber isso e um efeito rodar, ja que efeito
  // nao roda no servidor. Este e o padrao canonico para o caso.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMontado(true), []);

  // Um id por campo para ligar cada rotulo ao seu input. useId gera um valor
  // unico e igual no servidor e no navegador, o que um id fixo escrito a mao
  // nao garante se o formulario aparecer duas vezes na mesma pagina.
  const id = useId();

  const eLogin = modo === "login";
  const atendidas = REGRAS_SENHA.filter((r) => r.ok(senha)).length;

  // Preserva o callbackUrl ao alternar entre login e cadastro.
  const qs = callbackUrlParam
    ? `?callbackUrl=${encodeURIComponent(callbackUrlParam)}`
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
      setErro("E-mail ou senha inválidos.");
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
        body: JSON.stringify({
          tenantSlug: slug,
          nome,
          email,
          telefone,
          senha,
        }),
      });
      if (!resposta.ok) {
        const json = await resposta.json().catch(() => null);
        setErro(json?.error ?? "Não foi possível criar a conta.");
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

    // Um link especifico na URL (callbackUrl) sempre ganha: e para onde o
    // usuario ia quando foi barrado no login. Sem ele, o admin cai direto no
    // painel e o cliente na vitrine da estetica. O cadastro so cria CLIENTE,
    // entao a consulta a sessao roda apenas no login.
    let destino = `/${slug}`;
    if (callbackUrlParam) {
      destino = callbackUrlParam;
    } else if (eLogin) {
      const sessao = await getSession();
      if (sessao?.user.role === "ADMIN") destino = `/${slug}/admin`;
    }

    setTimeout(() => {
      router.push(destino);
      router.refresh();
    }, 2300);
  }

  return (
    <div className="relative isolate flex min-h-dvh justify-center bg-black lg:items-center lg:p-6 [@media(min-height:820px)]:lg:p-10">
      <ThemeColor color="#000000" />
      <FundoOndas />

      {/* Animacao de sucesso (login/cadastro) */}
      <AnimatePresence>
        {sucesso && (
          <SuccessScreen
            title={eLogin ? "Login realizado!" : "Cadastro realizado!"}
          />
        )}
      </AnimatePresence>

      <div className="relative flex w-full max-w-5xl flex-col">
        <div className="relative flex flex-1 flex-col overflow-hidden bg-[#0b0b0f] lg:grid lg:min-h-[34rem] lg:flex-none lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:rounded-[2rem] lg:border lg:border-white/10 lg:shadow-[0_40px_120px_-40px_var(--color-astro-blue)]">
          <PainelMarca modo={modo} estetica={estetica} />
          {/* Coluna 1 vazia no computador: o painel colorido fica por baixo, absoluto */}
          <div aria-hidden className="hidden lg:block" />

          {/* Formulario */}
          <div
            className={`relative flex flex-1 flex-col px-6 pt-1 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] lg:px-12 ${eLogin ? "lg:py-10" : "lg:py-7"}`}
          >
            <div className="hidden justify-end lg:flex">
              <Logo className="h-9" />
            </div>

            <div className="my-auto">
              <h1
                className={`text-2xl font-bold text-white ${eLogin ? "lg:text-3xl" : ""}`}
              >
                {eLogin ? "Entrar" : "Criar conta"}
              </h1>
              <p
                className={`mt-1 text-sm text-astro-muted ${eLogin ? "" : "hidden lg:block"}`}
              >
                {eLogin
                  ? "Use o e-mail e a senha cadastrados."
                  : "Leva menos de um minuto."}
              </p>

              <form
                onSubmit={handleSubmit}
                className={eLogin ? "mt-5 space-y-3.5 lg:mt-6 lg:space-y-4" : "mt-2 space-y-2 lg:mt-4 lg:space-y-3"}
              >
                {erro && (
                  <p
                    role="alert"
                    className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300"
                  >
                    {erro}
                  </p>
                )}

                {!eLogin && (
                  <CampoAuth
                    id={`${id}-nome`}
                    rotulo="Nome completo"
                    icone={<User className="h-4 w-4" />}
                    autoComplete="name"
                    type="text"
                    placeholder="Seu nome"
                    maxLength={LIMITES.nomePessoa}
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                  />
                )}

                {/* No cadastro, e-mail e telefone dividem a linha no computador,
                    para o formulario caber na tela sem rolar. */}
                <div
                  className={
                    eLogin
                      ? ""
                      : "space-y-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0"
                  }
                >
                  <CampoAuth
                    id={`${id}-email`}
                    rotulo="E-mail"
                    icone={<Mail className="h-4 w-4" />}
                    autoComplete="email"
                    type="email"
                    placeholder="voce@email.com"
                    maxLength={LIMITES.email}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />

                  {!eLogin && (
                    <CampoAuth
                      id={`${id}-telefone`}
                      rotulo="Telefone"
                      icone={<Phone className="h-4 w-4" />}
                      autoComplete="tel"
                      type="tel"
                      placeholder="(00) 00000-0000"
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      required
                    />
                  )}
                </div>

                <div>
                  <CampoAuth
                    id={`${id}-senha`}
                    rotulo="Senha"
                    icone={<Lock className="h-4 w-4" />}
                    // No login o navegador oferece a senha salva; no cadastro,
                    // sugere uma nova e guarda junto com o e-mail.
                    autoComplete={eLogin ? "current-password" : "new-password"}
                    type={mostrarSenha ? "text" : "password"}
                    placeholder="••••••••"
                    // So no cadastro: quem ja tem conta com senha maior continua entrando.
                    maxLength={eLogin ? undefined : LIMITES.senha}
                    minLength={eLogin ? undefined : 8}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    required
                    direita={
                      <button
                        type="button"
                        onClick={() => setMostrarSenha((v) => !v)}
                        className="grid h-8 w-8 place-items-center rounded-full text-astro-muted hover:text-white"
                        aria-label={
                          mostrarSenha ? "Ocultar senha" : "Mostrar senha"
                        }
                      >
                        {mostrarSenha ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    }
                  />

                  {/* Medidor de forca: uma barra por regra atendida, com as
                      mesmas regras que o servidor exige. */}
                  {!eLogin && (
                    <div className="pt-1.5 lg:pt-2">
                      <div className="flex gap-1.5" aria-hidden>
                        {REGRAS_SENHA.map((regra, i) => (
                          <span
                            key={regra.rotulo}
                            className={`h-1 flex-1 rounded-full ${senha.length > 0 && i < atendidas ? "bg-astro-blue-bright" : "bg-white/10"}`}
                          />
                        ))}
                      </div>
                      <p className="mt-1 text-xs text-astro-muted lg:mt-1.5">
                        Mínimo de {REGRAS_SENHA.map((r) => r.rotulo).join(", ")}
                        .
                      </p>
                    </div>
                  )}
                </div>

                {!eLogin && (
                  <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-astro-muted lg:text-sm">
                    <input
                      type="checkbox"
                      checked={aceitouTermos}
                      onChange={(e) => setAceitouTermos(e.target.checked)}
                      required
                      className="mt-0.5 h-4 w-4 shrink-0 accent-astro-blue"
                    />
                    <span>
                      Li e aceito os{" "}
                      <strong className="font-semibold text-white">
                        Termos de uso
                      </strong>{" "}
                      e a{" "}
                      <strong className="font-semibold text-white">
                        Política de privacidade
                      </strong>{" "}
                      da Astro.
                    </span>
                  </label>
                )}

                <button
                  type="submit"
                  disabled={carregando || !montado}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-astro-blue px-5 py-3.5 text-sm font-semibold text-white shadow-[0_14px_30px_-12px_var(--color-astro-blue)] transition hover:brightness-110 disabled:opacity-50"
                >
                  {carregando
                    ? "Aguarde..."
                    : !montado
                      ? "Carregando…"
                      : eLogin
                        ? "Entrar"
                        : "Criar conta"}
                  {!carregando && montado && <ArrowRight className="h-4 w-4" />}
                </button>
              </form>

              <p
                className={`text-center text-sm text-astro-muted ${eLogin ? "mt-5 lg:mt-6" : "mt-2.5 lg:mt-4"}`}
              >
                {eLogin ? "Ainda não tem conta? " : "Já tem conta? "}
                <Link
                  href={outraRota}
                  className="font-semibold text-astro-blue-bright underline-offset-4 hover:underline"
                >
                  {eLogin ? "Criar agora" : "Entrar"}
                </Link>
              </p>
            </div>

            {/* Sem "voltar a vitrine": /[slug] redireciona quem nao esta
                logado para ca, entao o link seria um laco. */}
            <p
              className={`hidden text-right text-xs text-astro-muted/70 ${eLogin ? "lg:block" : ""}`}
            >
              © {new Date().getFullYear()} Astro Estética Automotiva
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Campo do login e do cadastro: rotulo visivel, icone a esquerda e formato
// de pilula, sobre o lado escuro do cartao.
function CampoAuth({
  id,
  rotulo,
  icone,
  direita,
  ...props
}: ComponentProps<"input"> & {
  id: string;
  rotulo: string;
  icone: ReactNode;
  direita?: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm text-slate-300 lg:mb-1.5">
        {rotulo}
      </label>
      <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.05] py-1 pr-1.5 pl-4 transition focus-within:border-astro-blue-bright/70 focus-within:bg-white/[0.08]">
        <span className="text-astro-muted">{icone}</span>
        <input
          id={id}
          {...props}
          className="min-w-0 flex-1 bg-transparent py-2 text-sm lg:py-2.5 text-white placeholder:text-white/30 focus:outline-none"
        />
        {direita}
      </div>
    </div>
  );
}
