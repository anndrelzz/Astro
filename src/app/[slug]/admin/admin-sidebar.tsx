"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ChevronDown,
  LayoutGrid,
  LogOut,
  Settings,
  Sparkles,
  Wallet,
} from "lucide-react";

// Barra lateral fixa do painel (mockup do admin em desktop). O menu e dividido
// em dois grupos, como no desenho: OPERACAO (o dia a dia) e LOJA (a vitrine).
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

export function AdminSidebar({
  slug,
  tenantNome,
  usuarioNome,
  pixPendentes,
}: {
  slug: string;
  tenantNome: string;
  usuarioNome: string;
  pixPendentes: number;
}) {
  const pathname = usePathname();
  const base = `/${slug}/admin`;

  // O mockup preve 7 itens. Grade de horarios e Identidade visual entram no
  // menu quando forem construidas como telas proprias — hoje ainda vivem
  // dentro de Configuracoes. Link para tela inexistente e 404, nao vale a
  // aparencia.
  const operacao: Item[] = [
    { href: base, label: "Dashboard", icone: LayoutGrid, exato: true },
    {
      href: `${base}/agendamentos`,
      label: "Agendamentos",
      icone: CalendarDays,
      contador: pixPendentes,
    },
    { href: `${base}/servicos`, label: "Servicos", icone: Sparkles },
    { href: `${base}/financeiro`, label: "Financeiro", icone: Wallet },
  ];

  const loja: Item[] = [
    { href: `${base}/configuracoes`, label: "Configuracoes", icone: Settings },
  ];

  const iniciaisTenant = tenantNome
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    // Gradiente vertical: um azul um pouco mais claro so no topo (junto da
    // marca), escurecendo rapido — ja escuro no primeiro terco e quase preto
    // do meio para baixo. O claro e um brilho localizado, nao um degrade que
    // percorre a lateral inteira.
    <aside className="hidden w-[248px] shrink-0 flex-col border-r border-admin-border bg-[linear-gradient(180deg,#1e2d4a_0%,#0b1220_28%,#05070f_100%)] lg:flex">
      {/* Marca */}
      <div className="flex items-center gap-2.5 px-5 pt-6">
        <Image
          src="/logo-astro-branco.png"
          alt="Astro"
          width={712}
          height={219}
          priority
          className="h-5 w-auto"
        />
        <span className="rounded border border-admin-border px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-widest text-astro-muted">
          Admin
        </span>
      </div>

      {/* Estetica atual */}
      <div className="mx-4 mt-5 flex items-center gap-3 rounded-xl border border-admin-border bg-admin-surface px-3 py-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-astro-blue text-xs font-semibold text-white">
          {iniciaisTenant}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-semibold text-white">{tenantNome}</p>
          <p className="truncate font-mono text-[0.65rem] text-astro-muted">{slug}</p>
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 text-astro-muted" />
      </div>

      <nav className="mt-7 flex-1 px-4">
        <Grupo titulo="Operacao" itens={operacao} pathname={pathname} />
        <Grupo titulo="Loja" itens={loja} pathname={pathname} className="mt-7" />
      </nav>

      {/* Usuario logado */}
      <div className="mx-4 mb-5 flex items-center gap-3 rounded-xl border border-admin-border bg-admin-surface px-3 py-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-admin-surface-2 text-xs font-semibold text-white">
          {usuarioNome[0]?.toUpperCase() ?? "A"}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-semibold text-white">{usuarioNome}</p>
          <p className="truncate font-mono text-[0.65rem] text-astro-muted">dono · admin</p>
        </div>
        <Link
          href="/api/auth/signout"
          aria-label="Sair"
          className="shrink-0 text-astro-muted transition hover:text-white"
        >
          <LogOut className="h-4 w-4" />
        </Link>
      </div>
    </aside>
  );
}

// O painel e desktop-first (o mockup e de desktop, e as tarefas do admin -
// grade da semana, 5 precos por servico - pedem tela larga). Mas o Rafael da
// persona "tem smartphone e usa o computador ocasionalmente", entao o painel
// nao pode quebrar no celular: abaixo de lg a lateral some e entra esta barra.
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
    { href: `${base}/servicos`, label: "Servicos", icone: Sparkles },
    { href: `${base}/financeiro`, label: "Financeiro", icone: Wallet },
    { href: `${base}/configuracoes`, label: "Configuracoes", icone: Settings },
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
        <Link href="/api/auth/signout" aria-label="Sair" className="text-astro-muted">
          <LogOut className="h-4 w-4" />
        </Link>
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
                  ? "flex shrink-0 items-center gap-2 rounded-full bg-astro-blue/35 px-3.5 py-2 text-xs font-semibold text-white ring-1 ring-inset ring-astro-blue-bright/50 backdrop-blur-md"
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
      <p className="astro-label px-3 pb-2">{titulo}</p>
      <ul className="space-y-0.5">
        {itens.map((item) => {
          const ativo = estaAtivo(pathname, item);
          const Icone = item.icone;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={ativo ? "page" : undefined}
                // Item ativo em vidro azul: o fundo e TRANSLUCIDO (o gradiente
                // da lateral aparece por tras) com desfoque, borda azul clara
                // e brilho externo. Azul solido nao le como vidro — o que cria
                // o efeito e a transparencia somada ao blur e a borda luminosa.
                className={
                  ativo
                    ? "flex items-center gap-3 rounded-lg bg-[linear-gradient(120deg,rgba(59,130,246,0.55)_0%,rgba(37,99,235,0.32)_55%,rgba(29,78,216,0.18)_100%)] px-3 py-2.5 text-sm font-semibold text-white shadow-[0_4px_20px_-4px_rgba(59,130,246,0.55)] ring-1 ring-inset ring-astro-blue-bright/50 backdrop-blur-md"
                    : "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-astro-muted transition hover:bg-white/5 hover:text-white"
                }
              >
                <Icone className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
                {!!item.contador && item.contador > 0 && (
                  <span
                    className={
                      ativo
                        ? "flex h-5 min-w-5 items-center justify-center rounded-full bg-white/20 px-1.5 text-[0.65rem] font-semibold text-white"
                        : "flex h-5 min-w-5 items-center justify-center rounded-full bg-astro-blue px-1.5 text-[0.65rem] font-semibold text-white"
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
