"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarDays, User } from "lucide-react";

// Barra de navegacao flutuante do app mobile (telas 06, 13, etc.).
// Item ativo vira pill azul com label; inativos sao so icone.
export function BottomNav({ slug }: { slug: string }) {
  const pathname = usePathname();

  const itens = [
    { href: `/${slug}`, label: "Início", icon: Home, exato: true },
    { href: `/${slug}/historico`, label: "Agendamentos", icon: CalendarDays },
    { href: `/${slug}/perfil`, label: "Perfil", icon: User },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-5">
      <div className="flex items-center gap-1 rounded-full border border-black/5 bg-white/90 p-2 shadow-xl shadow-black/10 backdrop-blur">
        {itens.map((item) => {
          const ativo = item.exato
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icone = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
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
