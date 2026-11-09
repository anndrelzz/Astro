"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { signIn } from "next-auth/react";
import { ArrowLeft, Eye, EyeOff, Lock, Mail, MailCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "@/front/componentes/astro";
import { FundoOndas } from "@/front/componentes/fundo-ondas";
import { ThemeColor } from "@/front/componentes/theme-color";
import { CampoAuth, REGRAS_SENHA } from "@/front/login/auth-form";
import { PainelMarca, type Estetica } from "@/front/login/painel-marca";
import { LIMITES } from "@/compartilhado/validacoes/limites";

// RFC 6.2 — "esqueci minha senha". Duas telas no mesmo cartao do login:
// pedir o link pelo e-mail e criar a senha nova pelo link. O pedido sempre
// responde a mesma coisa, tenha conta ou nao (a tela nao serve para descobrir
// quem e cliente da estetica).

const botaoCls =
  "flex w-full items-center justify-center gap-2 rounded-full bg-astro-blue py-3 text-sm font-semibold text-white shadow-[0_14px_30px_-14px_var(--color-astro-blue)] transition hover:brightness-110 disabled:opacity-50";

function CartaoAuth({ estetica, titulo, subtitulo, children }: { estetica: Estetica; titulo: string; subtitulo: string; children: ReactNode }) {
  return (
    <div className="relative isolate flex min-h-dvh items-center justify-center bg-black px-3 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-[calc(env(safe-area-inset-bottom)+0.5rem)] lg:p-6">
      <ThemeColor color="#000000" />
      <FundoOndas />
      <div className="relative w-full max-w-5xl">
        <div className="relative transform-gpu overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0b0b0f] shadow-[0_40px_120px_-40px_var(--color-astro-blue)] lg:grid lg:min-h-[34rem] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:rounded-[2rem]">
          <PainelMarca modo="login" estetica={estetica} />
          <div aria-hidden className="hidden lg:block" />
          <div className="relative flex flex-col px-5 pt-1 pb-6 lg:px-12 lg:py-10">
            <div className="hidden justify-end lg:flex">
              <Logo className="h-9" />
            </div>
            <div className="lg:my-auto">
              <h1 className="text-2xl font-bold text-white lg:text-3xl">{titulo}</h1>
              <p className="mt-1 text-sm text-astro-muted">{subtitulo}</p>
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function VoltarAoLogin({ slug }: { slug: string }) {
  return (
    <Link
      href={`/${slug}/login`}
      className="mt-5 inline-flex items-center gap-1.5 text-sm text-astro-muted transition hover:text-white"
    >
      <ArrowLeft className="h-4 w-4" />
      Voltar para o login
    </Link>
  );
}

export function EsqueciSenhaForm({ slug, estetica }: { slug: string; estetica: Estetica }) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    const resposta = await fetch("/api/auth/esqueci-senha", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantSlug: slug, email }),
    });
    setCarregando(false);
    if (!resposta.ok) {
      const json = await resposta.json().catch(() => null);
      setErro(json?.error ?? "Não foi possível enviar o link. Tente de novo.");
      return;
    }
    setEnviado(true);
  }

  if (enviado) {
    return (
      <CartaoAuth estetica={estetica} titulo="Confira seu e-mail" subtitulo="O link chega em alguns minutos.">
        <div role="status" className="mt-6 flex gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-200">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-astro-blue-bright" />
          <p>
            Se existir uma conta com {email} na {estetica.nome}, enviamos um link para criar uma senha nova. Ele vale
            por 1 hora. Não achou? Olhe também a caixa de spam.
          </p>
        </div>
        <VoltarAoLogin slug={slug} />
      </CartaoAuth>
    );
  }

  return (
    <CartaoAuth
      estetica={estetica}
      titulo="Esqueci minha senha"
      subtitulo="Digite o e-mail da sua conta e enviamos um link para criar uma senha nova."
    >
      <form onSubmit={enviar} className="mt-5 space-y-4">
        <CampoAuth
          id={`${id}-email`}
          rotulo="E-mail"
          icone={<Mail className="h-4 w-4" />}
          type="email"
          autoComplete="email"
          placeholder="voce@email.com"
          maxLength={LIMITES.email}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setErro(null);
          }}
          erro={erro ?? undefined}
          required
        />
        <button type="submit" disabled={carregando} className={botaoCls}>
          {carregando ? "Enviando..." : "Enviar link"}
        </button>
      </form>
      <VoltarAoLogin slug={slug} />
    </CartaoAuth>
  );
}

export function RedefinirSenhaForm({ slug, token, estetica }: { slug: string; token: string; estetica: Estetica }) {
  const router = useRouter();
  const id = useId();
  const [senha, setSenha] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [erroSenha, setErroSenha] = useState<string | null>(null);
  const [erroLink, setErroLink] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const atendidas = REGRAS_SENHA.filter((r) => r.ok(senha)).length;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErroSenha(null);
    setErroLink(null);
    setCarregando(true);
    const resposta = await fetch("/api/auth/redefinir-senha", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantSlug: slug, token, senha }),
    });
    const json = await resposta.json().catch(() => null);
    if (!resposta.ok) {
      setCarregando(false);
      if (json?.campo === "senha") setErroSenha(json.error);
      else setErroLink(json?.error ?? "Não foi possível salvar a senha.");
      return;
    }

    // Senha trocada: ja entra na conta, como depois do cadastro.
    await signIn("credentials", { email: json.email, password: senha, tenantSlug: slug, redirect: false });
    router.push(`/${slug}`);
    router.refresh();
  }

  return (
    <CartaoAuth estetica={estetica} titulo="Criar nova senha" subtitulo="Depois de salvar, você já entra na sua conta.">
      {erroLink && (
        <div role="alert" className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <p>{erroLink}</p>
          <Link href={`/${slug}/esqueci-senha`} className="mt-1 inline-block font-semibold text-white underline">
            Pedir um novo link
          </Link>
        </div>
      )}
      <form onSubmit={salvar} className="mt-5 space-y-4">
        <div>
          <CampoAuth
            id={`${id}-senha`}
            rotulo="Nova senha"
            icone={<Lock className="h-4 w-4" />}
            type={mostrar ? "text" : "password"}
            autoComplete="new-password"
            placeholder="••••••••"
            minLength={8}
            maxLength={LIMITES.senha}
            value={senha}
            onChange={(e) => {
              setSenha(e.target.value);
              setErroSenha(null);
            }}
            erro={erroSenha ?? undefined}
            required
            direita={
              <button
                type="button"
                onClick={() => setMostrar((v) => !v)}
                className="grid h-8 w-8 place-items-center rounded-full text-astro-muted hover:text-white"
                aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"}
              >
                {mostrar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          />
          {/* O mesmo medidor do cadastro, com as mesmas regras do servidor. */}
          <div className="pt-2">
            <div className="flex gap-1.5" aria-hidden>
              {REGRAS_SENHA.map((regra, i) => (
                <span
                  key={regra.rotulo}
                  className={`h-1 flex-1 rounded-full ${senha.length > 0 && i < atendidas ? "bg-astro-blue-bright" : "bg-white/10"}`}
                />
              ))}
            </div>
            <p className="mt-1.5 text-xs text-astro-muted">Mínimo de {REGRAS_SENHA.map((r) => r.rotulo).join(", ")}.</p>
          </div>
        </div>
        <button type="submit" disabled={carregando} className={botaoCls}>
          {carregando ? "Salvando..." : "Salvar nova senha"}
        </button>
      </form>
      <VoltarAoLogin slug={slug} />
    </CartaoAuth>
  );
}
