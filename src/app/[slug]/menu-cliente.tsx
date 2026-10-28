"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { itemAtivo, itensCliente } from "@/components/ui/bottom-nav";

// Menu do cliente em abas, no corpo da tela (celular). Substitui a pilula
// flutuante do rodape nas telas ja redesenhadas: ela cobria o fim da lista de
// servicos. No computador quem navega e a barra lateral, entao some.
export function MenuCliente({ slug }: { slug: string }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Menu" className="lg:hidden">
      <ul className="grid grid-cols-[1fr_1.3fr_1fr] gap-1 rounded-full border border-zinc-200 bg-white/80 p-1 shadow-sm backdrop-blur">
        {itensCliente(slug).map((item) => {
          const ativo = itemAtivo(pathname, item);
          const Icone = item.icone;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={ativo ? "page" : undefined}
                className={`flex items-center justify-center gap-1.5 rounded-full px-1.5 py-2.5 text-sm font-semibold transition ${
                  ativo ? "bg-astro-blue text-white shadow-sm" : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                {/* Abaixo de 420px o icone sai, e a aba do meio e mais larga, para
                    "Agendamentos" caber inteiro num iPhone X (375px). */}
                <Icone className="h-4 w-4 shrink-0 max-[419px]:hidden" />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
