"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Car, CalendarDays, User } from "lucide-react";

export type ItemCliente = {
  href: string;
  label: string;
  icone: typeof Car;
  // "Serviços" mora na raiz /[slug], entao "comeca com" marcaria ele como ativo
  // em todas as telas filhas. So ele precisa de comparacao exata.
  exato?: boolean;
};

// Fonte unica dos itens de navegacao do cliente. A barra lateral do desktop
// (cliente-sidebar.tsx) consome esta mesma lista: sao duas formas do mesmo
// menu, e um item novo precisa entrar em um lugar so.
export function itensCliente(slug: string): ItemCliente[] {
  return [
    { href: `/${slug}`, label: "Serviços", icone: Car, exato: true },
    { href: `/${slug}/historico`, label: "Agendamentos", icone: CalendarDays },
    { href: `/${slug}/perfil`, label: "Perfil", icone: User },
  ];
}

export function itemAtivo(pathname: string, item: ItemCliente) {
  if (item.exato) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

// Barra de navegacao flutuante do app mobile (telas 06, 13, etc.).
// Item ativo vira pill azul com label; inativos sao so icone.
//
// lg:hidden — no desktop quem navega e a barra lateral (ClienteShell). Uma
// pilula presa no rodape e convencao de polegar; com mouse ela fica orfa no
// pe de um monitor largo.
export function BottomNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const itens = itensCliente(slug);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] lg:hidden">
      <div className="flex items-center gap-1 rounded-full border border-black/5 bg-white/90 p-2 shadow-xl shadow-black/10 backdrop-blur">
        {itens.map((item) => {
          const ativo = itemAtivo(pathname, item);
          const Icone = item.icone;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={ativo ? "page" : undefined}
              className={
                ativo
                  ? "flex items-center gap-2 rounded-full bg-astro-blue px-5 py-2.5 text-sm font-semibold text-white"
                  : "flex items-center rounded-full px-4 py-2.5 text-zinc-400 hover:text-zinc-600"
              }
            >
              <Icone className="h-5 w-5" />
              {ativo && <span>{item.label}</span>}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
