"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Maximize2, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// "Conheca o Astro por dentro": o print real de cada parte do painel do Admin
// (estetica limpa de demonstracao, tela de 1024x640: na landing o print aparece
// pequeno, e numa tela estreita a letra do painel sai maior), em
// public/landing/telas-admin,
// numa moldura de janela de navegador. O caminho nao pode ter "/admin/": o
// proxy.ts trata /{slug}/admin/... como area do Admin e manda para o login.
//
// O print e NAVEGAVEL: sobre os itens do menu lateral DENTRO da imagem ficam
// botoes invisiveis, e clicar em "Clientes" la dentro abre o print da tela de
// Clientes, como no Astro de verdade. Funciona porque todos os prints tem a
// mesma lateral, no mesmo lugar (y = centro do item, em pixels do print de
// 1600x1000). A faixa embaixo da janela traz o texto da tela aberta.
//
// "Ampliar" (no computador) abre a mesma janela em tela cheia, para ler os
// numeros do painel; o menu continua clicavel la dentro.
//
// No celular o menu do print fica pequeno demais para o dedo: la aparecem
// tambem botoes em linha acima da janela (rolam para o lado).

type Aba = {
  id: string;
  rotulo: string;
  texto: string;
  itens: string[];
  img: string;
  rota: string;
  /** Centro do item no menu lateral do print (px, imagem de 1600x1000). */
  y: number;
};

const ABAS: Aba[] = [
  {
    id: "painel",
    rotulo: "Painel do dia",
    texto: "Abriu o Astro, já vê quem chega hoje e quanto entrou.",
    itens: [
      "Agenda de hoje em ordem de horário",
      "Receita do dia e do mês",
      "Vagas livres no dia",
    ],
    img: "painel",
    y: 369,
    rota: "admin",
  },
  {
    id: "agenda",
    rotulo: "Agendamentos",
    texto: "Todos os horários marcados, separados pela situação do pagamento.",
    itens: [
      "Confirmados, PIX pendente, no local e concluídos",
      "Busca por cliente, placa ou serviço",
      "Confirmação do PIX com um toque",
    ],
    img: "agendamentos",
    y: 440,
    rota: "admin/agendamentos",
  },
  {
    id: "clientes",
    rotulo: "Clientes",
    texto: "Quem são os seus clientes, quem é novo e quem parou de voltar.",
    itens: [
      "Busca por nome, telefone, e-mail ou placa",
      "Novos, sem voltar há 60 dias e nunca agendaram",
      "WhatsApp do cliente a um toque",
    ],
    img: "clientes",
    y: 512,
    rota: "admin/clientes",
  },
  {
    id: "catalogo",
    rotulo: "Catálogo",
    texto: "Cada serviço com duração e um preço para cada tipo de veículo.",
    itens: [
      "Tipos de veículo definidos por você",
      "Pause um serviço sem apagar o histórico",
      "Duração e preço de cada serviço",
    ],
    img: "catalogo",
    y: 584,
    rota: "admin/catalogo",
  },
  {
    id: "horarios",
    rotulo: "Grade de horários",
    texto:
      "Os dias e horários em que a estética atende, e quantos carros ao mesmo tempo.",
    itens: [
      "Abre e fecha por dia da semana",
      "Copiar o horário para outros dias",
      "Capacidade e intervalo entre horários",
    ],
    img: "horarios",
    y: 656,
    rota: "admin/horarios",
  },
  {
    id: "financeiro",
    rotulo: "Financeiro",
    texto: "Quanto entrou, de onde veio e quanto ainda falta receber.",
    itens: [
      "Receita pelo dia em que o dinheiro entrou",
      "Por serviço, PIX contra no local e origem",
      "Clientes que mais gastaram e exportação em CSV",
    ],
    img: "financeiro",
    y: 728,
    rota: "admin/financeiro",
  },
  {
    id: "marca",
    rotulo: "Sua marca",
    texto: "O cliente vê a sua estética do começo ao fim, não o Astro.",
    itens: [
      "Logo e cor principal da estética",
      "Endereço, WhatsApp e horário de funcionamento",
      "Link próprio para divulgar",
    ],
    img: "identidade",
    y: 870,
    rota: "admin/identidade",
  },
  {
    id: "configuracoes",
    rotulo: "Configurações",
    texto: "O que o cliente vê sobre a estética e as regras de pagamento.",
    itens: [
      "Nome, descrição e endereço pelo CEP",
      "WhatsApp e contato da página",
      "Chave PIX e prazo de cancelamento",
    ],
    img: "configuracoes",
    y: 942,
    rota: "admin/configuracoes",
  },
];

export function PorDentro() {
  const [ativa, setAtiva] = useState(0);
  // Ate a primeira troca, um ponto pulsa sobre "Clientes" no print, para
  // mostrar que o menu dele e clicavel.
  const [explorou, setExplorou] = useState(false);
  const [ampliado, setAmpliado] = useState(false);
  const aba = ABAS[ativa];

  function abrir(i: number) {
    setAtiva(i);
    setExplorou(true);
  }

  // O print e limitado pela ALTURA da tela (largura = altura x 1,6, a
  // proporcao dele), para a secao inteira caber numa tela sem cortar o painel.
  return (
    <div className="grid gap-4">
      <div
        aria-label="Telas do painel"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden"
      >
        {ABAS.map((a, i) => (
          <button
            key={a.id}
            type="button"
            onClick={() => abrir(i)}
            aria-pressed={i === ativa}
            className={`min-h-11 shrink-0 cursor-pointer rounded-full border px-4 text-sm font-semibold transition-colors ${
              i === ativa
                ? "border-transparent bg-landing-blue text-white"
                : "border-landing-line-strong text-landing-muted"
            }`}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      {/* Janela de navegador com o print real. */}
      <div className="mx-auto w-full lg:max-w-[calc((100svh_-_15.5rem)_*_1.6)]">
        <Janela
          aba={aba}
          ativa={ativa}
          abrir={abrir}
          explorou={explorou}
          acao={
            <button
              type="button"
              onClick={() => setAmpliado(true)}
              aria-label="Ampliar o painel"
              className="hidden shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-landing-line-strong px-2.5 py-1 text-xs font-semibold text-landing-ink transition-colors hover:border-landing-glow lg:inline-flex"
            >
              <Maximize2 aria-hidden className="size-3.5" />
              Ampliar
            </button>
          }
        />
      </div>

      {ampliado &&
        createPortal(
          <TelaCheia aoFechar={() => setAmpliado(false)}>
            {(fechar) => (
              <Janela
                grande
                aba={aba}
                ativa={ativa}
                abrir={abrir}
                explorou={explorou}
                acao={fechar}
              />
            )}
          </TelaCheia>,
          document.body,
        )}

      {/* Faixa com o texto da tela aberta, embaixo da janela. */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={aba.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          aria-live="polite"
          className="vidro flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 rounded-2xl px-5 py-2.5 text-sm"
        >
          <p>
            <b className="font-extrabold">{aba.rotulo}</b>
            <span className="text-zinc-300"> · {aba.texto}</span>
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {aba.itens.map((item) => (
              <li
                key={item}
                className="flex items-center gap-1.5 text-zinc-200"
              >
                <Check
                  className="size-3.5 shrink-0 text-landing-glow"
                  strokeWidth={3}
                />
                {item}
              </li>
            ))}
          </ul>
          {!explorou && (
            <p className="hidden text-xs text-landing-glow lg:block">
              Clique no menu do painel para navegar.
            </p>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// A janela de navegador com o print e o menu clicavel por cima. Usada na
// secao e na tela cheia do "Ampliar" (grande), com o mesmo estado: trocar de
// tela numa troca na outra.
function Janela({
  aba,
  ativa,
  abrir,
  explorou,
  acao,
  grande = false,
}: {
  aba: Aba;
  ativa: number;
  abrir: (i: number) => void;
  explorou: boolean;
  acao: ReactNode;
  grande?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-landing-line-strong bg-[#0c0c0e] shadow-[0_30px_80px_-30px_rgba(37,99,235,0.45)]">
      <div className="flex items-center gap-3 border-b border-landing-line px-4 py-1.5">
        <span aria-hidden className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
        </span>
        <span className="min-w-0 flex-1 truncate rounded-md bg-landing-card px-3 py-1 text-center font-mono text-xs text-landing-muted">
          …/sua-estetica/{aba.rota}
        </span>
        {acao}
      </div>
      <div className="relative">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={aba.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Image
              src={`/landing/telas-admin/${aba.img}.webp`}
              alt={`Tela real do painel do Astro: ${aba.rotulo}`}
              width={1600}
              height={1000}
              sizes={grande ? "100vw" : "(min-width: 72rem) 72rem, 100vw"}
              className="block h-auto w-full"
            />
          </motion.div>
        </AnimatePresence>

        {/* Itens clicaveis por cima do menu lateral do print. */}
        <nav aria-label="Menu do painel" className="absolute inset-0">
          {ABAS.map((a, i) => (
            <button
              key={a.id}
              type="button"
              aria-label={`Abrir ${a.rotulo}`}
              aria-current={i === ativa ? "page" : undefined}
              onClick={() => abrir(i)}
              className="absolute left-[1.5%] w-[23.8%] cursor-pointer rounded-[0.6rem] outline-none transition-colors hover:bg-white/10 hover:ring-1 hover:ring-white/40 focus-visible:ring-2 focus-visible:ring-landing-glow"
              style={{ top: `${(a.y - 34) / 10}%`, height: "6.8%" }}
            >
              {!explorou && a.id === "clientes" && (
                <span
                  aria-hidden
                  className="absolute top-1/2 right-[10%] flex size-3 -translate-y-1/2"
                >
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/80 motion-reduce:animate-none" />
                  <span className="relative inline-flex size-3 rounded-full bg-white" />
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

// Tela cheia do "Ampliar": o painel ocupa o monitor inteiro (limitado pela
// altura, na proporcao do print). Esc, o botao Fechar ou o clique fora fecham.
// Vai para o <body> (portal) porque a secao tem animacao com transform, que
// prenderia o "position: fixed" dentro dela.
function TelaCheia({
  aoFechar,
  children,
}: {
  aoFechar: () => void;
  children: (fechar: ReactNode) => ReactNode;
}) {
  const botao = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    botao.current?.focus();
    const antes = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = antes;
    };
  }, []);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Painel do Astro em tela cheia"
      onKeyDown={(e) => {
        if (e.key === "Escape") aoFechar();
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) aoFechar();
      }}
      className="fixed inset-0 z-[60] grid place-items-center bg-black/85 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-[calc((100svh_-_5.5rem)_*_1.6)]">
        {children(
          <button
            ref={botao}
            type="button"
            onClick={aoFechar}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-landing-line-strong px-2.5 py-1 text-xs font-semibold text-landing-ink transition-colors hover:border-landing-glow"
          >
            <X aria-hidden className="size-3.5" />
            Fechar
          </button>,
        )}
      </div>
    </div>
  );
}
