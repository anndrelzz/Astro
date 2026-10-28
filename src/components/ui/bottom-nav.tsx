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

// Recorte da bolha, adaptado do "Navigation bar with circle flexible
// highlight POC" (Zed Dash, CodePen KKPeOPm): um circulo branco e, por baixo,
// a barra com um vao em arco ao redor dele. No original o vao e transparente;
// aqui ele e um anel cinza, porque a lista de servicos rola por baixo da barra
// e aparecia pelo vao. O desenho comeca 13px acima do original para o anel
// caber inteiro: mede 112x105, e o topo da barra fica na linha 41.
const RECORTE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='112' height='105' viewBox='0 -13 112 105'%3E%3Ccircle cx='56' cy='36' r='48.5' fill='%23E6E9ED'/%3E%3Ccircle cx='56' cy='36' r='36' fill='%23FFF'/%3E%3Cpath d='M104 35.2L104 35.2c0 26.3-20.9 48.3-47.2 48.8C29.9 84.4 8 62.8 8 36v-0.8c0-4-3.2-7.2-7.2-7.2H0v64h112V28h-0.8C107.2 28 104 31.2 104 35.2z' fill='%23FFF'/%3E%3C/svg%3E\")";

// Centro horizontal do item i (de 3) dentro da faixa entre os cantos: o
// circulo de 7rem fica encostado no canto no primeiro e no ultimo item.
const centro = (i: number) => `calc(3.5rem + ${i} * (100% - 7rem) / 2)`;

// Barra de navegacao do app do cliente no celular: uma barra branca presa no
// rodape, e o item ativo sobe para um circulo acima dela, separado da barra
// por um vao em arco. Ao tocar em outro item, o circulo desliza ate ele.
//
// Como o deslize funciona: a barra e montada em pedacos — canto, faixa,
// circulo, faixa, canto — e as duas faixas dividem a sobra. No primeiro item
// a faixa da esquerda encolhe a zero; no ultimo, a da direita; no meio, as
// duas tem o mesmo tamanho. Animar o crescimento das faixas empurra o
// circulo. A sombra e um drop-shadow no conjunto, para contornar o recorte.
//
// O icone escolhido sobe para dentro do circulo e ganha a cor da estetica.
// Enquanto o circulo passa, os icones somem e voltam (nav-pisca), para nao
// aparecer um icone "atravessando" o circulo.
//
// Fica no layout de /[slug], e nao em cada pagina: assim ela continua montada
// entre Servicos, Agendamentos e Perfil e o circulo pode deslizar de um item
// ao outro (numa pagina, ela nasceria de novo a cada troca de tela). Aparece
// so nessas tres telas; agendar, pagar, login e o painel ficam sem ela.
//
// lg:hidden — no desktop quem navega e a barra lateral (ClienteShell). Uma
// barra presa no rodape e convencao de polegar; com mouse ela fica orfa no
// pe de um monitor largo.
export function BarraCliente({ slug }: { slug: string }) {
  const pathname = usePathname();
  const itens = itensCliente(slug);
  const daRota = itens.findIndex((item) => item.href === pathname);

  // O toque move o circulo na hora, sem esperar a outra tela carregar. Quando
  // a rota muda (a navegacao terminou, ou o cliente voltou pelo navegador), o
  // toque e esquecido e quem manda de novo e a rota. Zerar durante a
  // renderizacao, comparando com a rota anterior, e o padrao do React para
  // estado que depende de uma prop; com efeito, o circulo piscaria no item velho.
  const [toque, setToque] = useState<number | null>(null);
  const [rotaAnterior, setRotaAnterior] = useState(pathname);
  if (pathname !== rotaAnterior) {
    setRotaAnterior(pathname);
    setToque(null);
  }
  const ativo = toque ?? daRota;

  // De onde o circulo saiu, para saber quais icones piscam. `vez` reinicia as
  // animacoes a cada troca; na primeira renderizacao nada pisca.
  const [movimento, setMovimento] = useState({ de: ativo, para: ativo, vez: 0 });
  if (ativo !== movimento.para) {
    setMovimento({ de: movimento.para, para: ativo, vez: movimento.vez + 1 });
  }

  if (daRota === -1) return null;
  const { de, vez } = movimento;
  const atravessado = Math.abs(ativo - de) === 2 ? 1 : -1;

  return (
    <nav
      aria-label="Menu"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] lg:hidden"
    >
      <div className="relative h-[4.75rem] w-full max-w-[23rem]">
        {/* A barra recortada */}
        <div
          aria-hidden
          className="absolute inset-0 flex [filter:drop-shadow(0_0_0.5rem_rgb(0_0_0/0.1))_drop-shadow(0_0_0.25rem_rgb(0_0_0/0.08))]"
        >
          <div className="w-4 rounded-tl-2xl rounded-bl-[1.75rem] bg-white shadow-[0.25rem_0_0_white]" />
          <div className="flex flex-1">
            <div
              className="bg-white transition-[flex-grow] duration-700 ease-in-out motion-reduce:transition-none"
              style={{ flexGrow: ativo === 0 ? 0 : 1 }}
            />
            <div
              className="relative -top-[41px] h-[calc(100%+41px)] w-28 shrink-0"
              style={{
                // O desenho cobre os 64px de cima da barra; o resto e branco.
                background: `${RECORTE} top / 112px 105px no-repeat, linear-gradient(white, white) bottom / 100% calc(100% - 105px + 1px) no-repeat`,
              }}
            />
            <div
              className="bg-white transition-[flex-grow] duration-700 ease-in-out motion-reduce:transition-none"
              style={{ flexGrow: ativo === itens.length - 1 ? 0 : 1 }}
            />
          </div>
          <div className="w-4 rounded-tr-2xl rounded-br-[1.75rem] bg-white shadow-[-0.25rem_0_0_white]" />
        </div>

        {/* Itens, nos mesmos centros do circulo */}
        <ul className="absolute inset-y-0 right-4 left-4">
          {itens.map((item, i) => {
            const eAtivo = i === ativo;
            const Icone = item.icone;
            const pisca =
              vez === 0
                ? ""
                : eAtivo
                  ? "animate-[nav-pisca_900ms_forwards]"
                  : i === de
                    ? "animate-[nav-pisca-curto_450ms]"
                    : i === atravessado
                      ? "animate-[nav-pisca_750ms]"
                      : "";
            return (
              <li
                key={item.href}
                className="absolute inset-y-0 w-24 -translate-x-1/2"
                style={{ left: centro(i) }}
              >
                <Link
                  href={item.href}
                  aria-current={eAtivo ? "page" : undefined}
                  onClick={() => setToque(i)}
                  className="relative flex h-full flex-col items-center"
                >
                  {/* Ativo: sobe 18px (centro do circulo) e cresce, depois que
                      ja sumiu; inativo: desce de volta enquanto esta apagado. */}
                  <span
                    className={`mt-4 transition-[transform,color] motion-reduce:transition-none ${
                      eAtivo
                        ? "-translate-y-[1.125rem] scale-125 text-astro-blue delay-[375ms] duration-250"
                        : "text-zinc-400 delay-[190ms] duration-0"
                    }`}
                  >
                    <span key={vez} className={`block motion-reduce:animate-none ${pisca}`}>
                      <Icone aria-hidden className="h-5 w-5" />
                    </span>
                  </span>
                  <span
                    className={`absolute bottom-2.5 text-[0.7rem] font-semibold transition-colors duration-300 ${
                      eAtivo ? "text-astro-blue" : "text-zinc-500"
                    }`}
                  >
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
