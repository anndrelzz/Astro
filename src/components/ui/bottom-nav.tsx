"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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

// Barra de navegacao do app do cliente no celular: uma barra branca presa no
// rodape, e o item ativo sobe para uma bolha acima dela, com um anel da cor
// do fundo que parece um recorte na barra. Ao tocar em outro item, a bolha
// desliza ate ele.
//
// Fica no layout de /[slug], e nao em cada pagina: assim ela continua montada
// entre Servicos, Agendamentos e Perfil e a bolha pode deslizar de um item ao
// outro (numa pagina, ela nasceria de novo a cada troca de tela). Aparece so
// nessas tres telas; agendar, pagar, login e o painel ficam sem ela.
//
// lg:hidden — no desktop quem navega e a barra lateral (ClienteShell). Uma
// barra presa no rodape e convencao de polegar; com mouse ela fica orfa no
// pe de um monitor largo.
export function BarraCliente({ slug }: { slug: string }) {
  const pathname = usePathname();
  const itens = itensCliente(slug);
  const daRota = itens.findIndex((item) => item.href === pathname);

  // O toque move a bolha na hora, sem esperar a outra tela carregar. Quando a
  // rota muda (a navegacao terminou, ou o cliente voltou pelo navegador), o
  // toque e esquecido e quem manda de novo e a rota. Zerar durante a
  // renderizacao, comparando com a rota anterior, e o padrao do React para
  // estado que depende de uma prop; com efeito, a bolha piscaria no item velho.
  const [toque, setToque] = useState<number | null>(null);
  const [rotaAnterior, setRotaAnterior] = useState(pathname);
  if (pathname !== rotaAnterior) {
    setRotaAnterior(pathname);
    setToque(null);
  }

  if (daRota === -1) return null;
  const ativo = toque ?? daRota;
  const Icone = itens[ativo].icone;

  return (
    <nav
      aria-label="Menu"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] lg:hidden"
    >
      <div className="relative w-full max-w-sm rounded-[1.75rem] bg-white shadow-[0_12px_32px_-12px_rgb(15_23_42/0.35)] ring-1 ring-black/5">
        {/* Bolha do item ativo. Ocupa a coluna do item e desliza com
            translateX; o anel na cor do fundo e o "recorte" na barra. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-1/3 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          style={{ transform: `translateX(${ativo * 100}%)` }}
        >
          <span className="absolute -top-7 left-1/2 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-white ring-[6px] ring-[#f6f8fb] shadow-[0_8px_20px_-8px_var(--color-astro-blue)]">
            <span
              key={ativo}
              className="flex h-11 w-11 animate-[surgir_350ms_cubic-bezier(0.22,1,0.36,1)] items-center justify-center rounded-full text-white motion-reduce:animate-none"
              style={{
                background:
                  "linear-gradient(135deg, var(--color-astro-blue-bright), var(--color-astro-blue))",
              }}
            >
              <Icone className="h-5 w-5" />
            </span>
          </span>
        </span>

        <ul className="relative grid h-16 grid-cols-3">
          {itens.map((item, i) => {
            const eAtivo = i === ativo;
            const IconeItem = item.icone;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={eAtivo ? "page" : undefined}
                  onClick={() => setToque(i)}
                  className="flex h-full flex-col items-center justify-end gap-1 pb-2.5 text-[0.7rem] font-semibold"
                >
                  {/* O icone do item ativo sobe para a bolha; aqui ele some. */}
                  <IconeItem
                    aria-hidden
                    className={`h-5 w-5 transition duration-300 motion-reduce:transition-none ${
                      eAtivo ? "translate-y-2 scale-50 opacity-0" : "text-zinc-400"
                    }`}
                  />
                  <span className={`transition-colors duration-300 ${eAtivo ? "text-astro-blue" : "text-zinc-500"}`}>
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
