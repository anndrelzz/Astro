"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { Modal } from "./modal";
import {
  ArrowUpRight,
  CalendarDays,
  Clock,
  LayoutGrid,
  LogOut,
  Palette,
  Settings,
  Sparkles,
  Wallet,
} from "lucide-react";

// Barra lateral fixa do painel. O menu e dividido em dois grupos: OPERACAO (o
// dia a dia) e LOJA (a vitrine).
//
// A lateral e um bloco na cor da estetica (RF13, UC12 — a mesma cor escolhida
// em Identidade visual), e a identidade da estetica mora aqui: logo, nome,
// "Aberto/Fechado" e o atalho para o site publico. Por isso o Dashboard nao tem
// mais capa.
//
// O item ativo vira uma "aba" na cor do fundo do conteudo, que se funde com a
// area da direita: as duas curvas para dentro, em cima e embaixo do item, sao
// pseudo-elementos (before/after) pintados com um gradiente radial que deixa
// um quarto de circulo transparente. Com sombra (box-shadow) a curva saia
// serrilhada com zoom do navegador diferente de 100%.
//
// Client component por causa do usePathname, que marca o item ativo.

type Item = {
  href: string;
  label: string;
  icone: typeof CalendarDays;
  contador?: number;
  // O Dashboard mora na raiz /admin, entao "comeca com" marcaria ele como
  // ativo em todas as telas filhas. So ele precisa de comparacao exata.
  exato?: boolean;
};

function estaAtivo(pathname: string, item: Item) {
  if (item.exato) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function iniciaisDe(nome: string) {
  return nome
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export function AdminSidebar({
  slug,
  tenantNome,
  tenantLogo,
  aberto,
  usuarioNome,
  pixPendentes,
}: {
  slug: string;
  tenantNome: string;
  tenantLogo: string | null;
  aberto: boolean;
  usuarioNome: string;
  pixPendentes: number;
}) {
  const pathname = usePathname();
  const base = `/${slug}/admin`;

  const operacao: Item[] = [
    { href: base, label: "Dashboard", icone: LayoutGrid, exato: true },
    {
      href: `${base}/agendamentos`,
      label: "Agendamentos",
      icone: CalendarDays,
      contador: pixPendentes,
    },
    { href: `${base}/catalogo`, label: "Catálogo", icone: Sparkles },
    { href: `${base}/horarios`, label: "Grade de horários", icone: Clock },
    { href: `${base}/financeiro`, label: "Financeiro", icone: Wallet },
  ];

  const loja: Item[] = [
    { href: `${base}/identidade`, label: "Identidade visual", icone: Palette },
    { href: `${base}/configuracoes`, label: "Configurações", icone: Settings },
  ];

  return (
    // A cor vem de --color-astro-blue (a cor da estetica), escurecida em
    // direcao ao pe para o texto branco manter contraste mesmo com cores
    // claras.
    <aside
      className="sticky top-0 hidden h-dvh w-[260px] shrink-0 flex-col text-white lg:flex"
      style={{
        backgroundImage:
          "linear-gradient(180deg, color-mix(in srgb, var(--color-astro-blue) 92%, black) 0%, color-mix(in srgb, var(--color-astro-blue) 62%, black) 100%)",
      }}
    >
      {/* Marca da plataforma */}
      <div className="flex items-center gap-2.5 px-5 pt-6">
        <Image
          src="/logo-astro-branco.png"
          alt="Astro"
          width={712}
          height={219}
          priority
          className="h-5 w-auto"
        />
        <span className="font-mono text-[0.6rem] uppercase tracking-widest text-white/70">
          Admin
        </span>
      </div>

      {/* Estetica: logo, nome, aberto/fechado e site publico */}
      <div className="borda-viva mx-4 mt-5 grid gap-3 rounded-2xl bg-white/10 p-3">
        <div className="flex items-center gap-3">
          {tenantLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenantLogo}
              alt={`Logo ${tenantNome}`}
              className="h-10 w-10 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-bold text-astro-blue">
              {iniciaisDe(tenantNome)}
            </span>
          )}
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-semibold">{tenantNome}</p>
            <p className="truncate font-mono text-[0.65rem] text-white/70">
              astro.app/{slug}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold">
            <span
              className={`h-2 w-2 rounded-full ${
                aberto ? "bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.25)]" : "bg-white/40"
              }`}
            />
            {aberto ? "Aberto" : "Fechado"}
          </span>
          <Link
            href={`/${slug}`}
            className="flex items-center gap-1 rounded-full border border-white/35 px-2.5 py-1 text-xs font-semibold transition hover:bg-white/10"
          >
            Ver site
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Os itens encostam na borda direita (pr-0) para a aba se fundir com o
          conteudo. */}
      <nav className="mt-6 flex-1 pl-4">
        <Grupo titulo="Operação" itens={operacao} pathname={pathname} />
        <Grupo titulo="Loja" itens={loja} pathname={pathname} className="mt-6" />
      </nav>

      {/* Usuario logado */}
      <div className="mx-4 mb-5 flex items-center gap-3 rounded-2xl bg-black/20 px-3 py-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-astro-blue">
          {usuarioNome[0]?.toUpperCase() ?? "A"}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-semibold">{usuarioNome}</p>
          <p className="truncate font-mono text-[0.65rem] text-white/70">dono · admin</p>
        </div>
        <BotaoSair slug={slug} className="shrink-0 text-white/70 hover:text-white" />
      </div>
    </aside>
  );
}

// O painel e desktop-first (as tarefas do admin - grade da semana, 5 precos por
// servico - pedem tela larga). Mas o Rafael da persona "tem smartphone e usa o
// computador ocasionalmente", entao o painel nao pode quebrar no celular:
// abaixo de lg a lateral some e entra esta barra.
export function AdminMobileNav({
  slug,
  tenantNome,
  pixPendentes,
}: {
  slug: string;
  tenantNome: string;
  pixPendentes: number;
}) {
  const pathname = usePathname();
  const base = `/${slug}/admin`;

  const itens: Item[] = [
    { href: base, label: "Dashboard", icone: LayoutGrid, exato: true },
    { href: `${base}/agendamentos`, label: "Agendamentos", icone: CalendarDays, contador: pixPendentes },
    { href: `${base}/catalogo`, label: "Catálogo", icone: Sparkles },
    { href: `${base}/horarios`, label: "Grade", icone: Clock },
    { href: `${base}/financeiro`, label: "Financeiro", icone: Wallet },
    { href: `${base}/configuracoes`, label: "Configurações", icone: Settings },
  ];

  return (
    <div className="border-b border-admin-border bg-admin-bg lg:hidden">
      <div className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <span className="flex items-center gap-2">
          <Image
            src="/logo-astro-branco.png"
            alt="Astro"
            width={712}
            height={219}
            className="h-4 w-auto"
          />
          <span className="text-xs text-astro-muted">{tenantNome}</span>
        </span>
        <BotaoSair slug={slug} className="text-astro-muted hover:text-white" />
      </div>

      <nav className="flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {itens.map((item) => {
          const ativo = estaAtivo(pathname, item);
          const Icone = item.icone;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={ativo ? "page" : undefined}
              className={
                ativo
                  ? "flex shrink-0 items-center gap-2 rounded-full bg-astro-blue px-3.5 py-2 text-xs font-semibold text-white"
                  : "flex shrink-0 items-center gap-2 rounded-full border border-admin-border px-3.5 py-2 text-xs text-astro-muted"
              }
            >
              <Icone className="h-3.5 w-3.5" />
              {item.label}
              {!!item.contador && item.contador > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-white/20 px-1 text-[0.6rem] font-semibold">
                  {item.contador}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function Grupo({
  titulo,
  itens,
  pathname,
  className = "",
}: {
  titulo: string;
  itens: Item[];
  pathname: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="px-3 pb-2 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-white/60">
        {titulo}
      </p>
      <ul className="space-y-0.5">
        {itens.map((item) => {
          const ativo = estaAtivo(pathname, item);
          const Icone = item.icone;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={ativo ? "page" : undefined}
                className={
                  ativo
                    ? // Aba: fundo do conteudo + as duas curvas para dentro.
                      "relative flex items-center gap-3 rounded-l-2xl bg-admin-bg py-3 pr-4 pl-3 text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-white/70 before:pointer-events-none before:absolute before:-top-5 before:right-0 before:h-5 before:w-5 before:bg-[radial-gradient(circle_at_0_0,transparent_19.5px,var(--color-admin-bg)_20px)] after:pointer-events-none after:absolute after:-bottom-5 after:right-0 after:h-5 after:w-5 after:bg-[radial-gradient(circle_at_0_100%,transparent_19.5px,var(--color-admin-bg)_20px)]"
                    : "mr-4 flex items-center gap-3 rounded-2xl py-3 pr-3 pl-3 text-sm text-white/85 outline-none transition hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/70"
                }
              >
                <Icone
                  className={`h-4 w-4 shrink-0 ${ativo ? "text-astro-blue-bright" : ""}`}
                />
                <span className="flex-1 truncate">{item.label}</span>
                {!!item.contador && item.contador > 0 && (
                  <span
                    className={
                      ativo
                        ? "flex h-5 min-w-5 items-center justify-center rounded-full bg-astro-blue px-1.5 text-[0.65rem] font-semibold text-white"
                        : "flex h-5 min-w-5 items-center justify-center rounded-full bg-white/20 px-1.5 text-[0.65rem] font-semibold text-white"
                    }
                  >
                    {item.contador}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Sair do painel, com confirmacao sobre a propria tela.
//
// Antes os dois botoes eram <Link href="/api/auth/signout">, que leva a pagina
// generica do NextAuth: fundo liso, textos em ingles ("Signout / Are you sure
// you want to sign out?") e nenhuma relacao com o painel. Ela tambem nao tem
// como voltar — quem abriu por engano precisa usar o botao do navegador — e no
// fim joga o usuario na raiz do dominio, que nao pertence a nenhuma estetica.
//
// O lado do cliente ja resolvia isso com signOut() direto (ver
// cliente-sidebar.tsx); aqui o admin passa a fazer o mesmo, com a confirmacao
// num Modal, que e onde ela pertence.
//
// O Modal usa <dialog> nativo, entao o desfoque do fundo vem do ::backdrop —
// nao de uma div empilhada por cima — e Esc, clique fora e foco preso vem de
// graca.
function BotaoSair({ slug, className = "" }: { slug: string; className?: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const [saindo, setSaindo] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        aria-label="Sair"
        className={`transition ${className}`}
      >
        <LogOut className="h-4 w-4" />
      </button>

      <Modal
        aberto={confirmando}
        onFechar={() => setConfirmando(false)}
        titulo="Sair da conta"
        rodape={
          <>
            <button
              type="button"
              onClick={() =>
                // callbackUrl para o login DESTA estetica: a raiz do dominio
                // nao pertence a nenhuma (RN09).
                signOut({ callbackUrl: `/${slug}/login` }).then(() =>
                  setSaindo(true)
                )
              }
              disabled={saindo}
              className="rounded-lg bg-astro-blue px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
            >
              {saindo ? "Saindo..." : "Sair"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10 hover:text-white"
            >
              Cancelar
            </button>
          </>
        }
      >
        <p className="text-sm text-astro-muted">
          Tem certeza que deseja sair? Você precisará entrar novamente para
          acessar o painel.
        </p>
      </Modal>
    </>
  );
}
