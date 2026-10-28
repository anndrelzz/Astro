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

// Recorte do circulo, adaptado do "Navigation bar with circle flexible
// highlight POC" (Zed Dash, CodePen KKPeOPm): um circulo branco e, por baixo,
// a barra com um vao em arco ao redor dele. No original o vao e transparente;
// aqui ele e um anel cinza, para nao aparecer o fundo de pontos pelo vao. O
// desenho comeca 13px acima do original para o anel caber inteiro. Desenhado
// em 112x105 e exibido a 75% (84x79): o topo da barra fica 31px abaixo do
// topo do desenho, e o centro do circulo 6px abaixo do topo da barra.
const RECORTE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='112' height='105' viewBox='0 -13 112 105'%3E%3Ccircle cx='56' cy='36' r='48.5' fill='%23E6E9ED'/%3E%3Ccircle cx='56' cy='36' r='36' fill='%23FFF'/%3E%3Cpath d='M104 35.2L104 35.2c0 26.3-20.9 48.3-47.2 48.8C29.9 84.4 8 62.8 8 36v-0.8c0-4-3.2-7.2-7.2-7.2H0v64h112V28h-0.8C107.2 28 104 31.2 104 35.2z' fill='%23FFF'/%3E%3C/svg%3E\")";

// Centro horizontal do item i (de 3) dentro da faixa entre os cantos: o
// circulo de 84px fica encostado no canto no primeiro e no ultimo item.
const centro = (i: number) => `calc(42px + ${i} * (100% - 84px) / 2)`;

// Tempo do deslize do circulo.
const DESLIZE_MS = 450;

// Menu do cliente no celular, preso no rodape de Servicos, Agendamentos e
// Perfil: uma barra branca em que o item ativo sobe para um circulo, separado
// da barra por um vao em arco. Ao tocar em outro item, o circulo desliza ate
// ele.
//
// Como o deslize funciona: a barra e montada em pedacos — canto, faixa,
// circulo, faixa, canto — e as duas faixas dividem a sobra. No primeiro item
// a faixa da esquerda encolhe a zero; no ultimo, a da direita; no meio, as
// duas tem o mesmo tamanho. Animar o crescimento das faixas empurra o
// circulo.
//
// O icone escolhido sobe para dentro do circulo e ganha a cor da estetica.
// Enquanto o circulo passa, os icones somem e voltam (nav-pisca), para nao
// aparecer um icone "atravessando" o circulo.
//
// Fica no layout de /[slug], e nao em cada pagina: assim ela continua montada
// entre as tres telas e o circulo desliza de um item ao outro enquanto a tela
// nova carrega (numa pagina, ela nasceria de novo a cada troca). Ela mesma
// decide onde aparece: so nessas tres rotas; agendar, pagar, login e o painel
// ficam sem ela.
//
// lg:hidden — no desktop quem navega e a barra lateral (ClienteShell).
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
  const ativo = toque ?? Math.max(daRota, 0);

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
      className="fixed inset-x-0 bottom-0 z-40 px-4 pt-[31px] pb-[calc(env(safe-area-inset-bottom)+0.75rem)] lg:hidden"
    >
      {/* 62px: o nome do item ativo fica abaixo do anel, que desce ate 42px. */}
      <div className="relative mx-auto h-[62px] w-full max-w-[23rem]">
        {/* A barra recortada. Sombra curta e para baixo, como a dos cards. */}
        <div
          aria-hidden
          className="absolute inset-0 flex [filter:drop-shadow(0_6px_14px_rgb(15_23_42/0.12))]"
        >
          <div className="w-4 rounded-l-2xl bg-white shadow-[0.25rem_0_0_white]" />
          <div className="flex flex-1">
            <div
              className="bg-white transition-[flex-grow] ease-in-out motion-reduce:transition-none"
              style={{ flexGrow: ativo === 0 ? 0 : 1, transitionDuration: `${DESLIZE_MS}ms` }}
            />
            <div
              className="relative -top-[31px] h-[calc(100%+31px)] w-[84px] shrink-0"
              style={{
                // O desenho cobre os 48px de cima da barra; o resto e branco.
                background: `${RECORTE} top / 84px 79px no-repeat, linear-gradient(white, white) bottom / 100% calc(100% - 79px + 1px) no-repeat`,
              }}
            />
            <div
              className="bg-white transition-[flex-grow] ease-in-out motion-reduce:transition-none"
              style={{ flexGrow: ativo === itens.length - 1 ? 0 : 1, transitionDuration: `${DESLIZE_MS}ms` }}
            />
          </div>
          <div className="w-4 rounded-r-2xl bg-white shadow-[-0.25rem_0_0_white]" />
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
                  ? "animate-[nav-pisca_600ms_forwards]"
                  : i === de
                    ? "animate-[nav-pisca-curto_300ms]"
                    : i === atravessado
                      ? "animate-[nav-pisca_450ms]"
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
                  {/* Ativo: sobe ate o centro do circulo depois que ja sumiu;
                      inativo: volta para baixo enquanto esta apagado. */}
                  <span
                    className={`mt-2 transition-[transform,color] motion-reduce:transition-none ${
                      eAtivo
                        ? "-translate-y-3 text-astro-blue delay-[225ms] duration-200"
                        : "text-zinc-400 delay-[120ms] duration-0"
                    }`}
                  >
                    <span key={vez} className={`block motion-reduce:animate-none ${pisca}`}>
                      <Icone aria-hidden className="h-5 w-5" />
                    </span>
                  </span>
                  <span
                    className={`absolute bottom-1.5 text-[0.7rem] font-semibold transition-colors duration-300 ${
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
