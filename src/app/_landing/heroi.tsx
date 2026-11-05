"use client";

import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import Image from "next/image";
import { useRef, useState } from "react";
import { EntrarNaEstetica } from "@/front/landing/entrar-na-estetica";

// Topo da landing: imagem do ceu ao fundo, orbitas por cima, menu; texto a
// esquerda e um leque com tres telas reais do cliente a direita; no pe, a
// faixa azul com as palavras do que o Astro faz. Titulo,
// frase e os dois botoes ("Comecar agora" e "Ja tenho cadastro", que abre a
// busca da estetica, igual ao "Entrar" do menu). Ocupa exatamente uma tela (min-h-svh): o fluxo do
// cliente com o celular fica na secao seguinte, para nada aparecer cortado
// no pe da primeira tela.
//
// Duas animacoes aqui:
// - Entrada: titulo, frase e botoes aparecem um depois do outro. E animacao
//   CSS (classe landing-subir em globals.css), nao
//   framer-motion: assim roda assim que o HTML chega, sem esperar o JavaScript
//   carregar — com framer, o titulo ficaria invisivel ate a pagina hidratar,
//   o que no 4G pode levar segundos.
// - Profundidade: ao rolar, a foto desce mais devagar que o texto, como se o
//   ceu estivesse longe (parallax).
//
// O menu e fixo no topo da tela: acompanha a rolagem. Depois de rolar um
// pouco, ganha fundo mais escuro e sombra, para nao se perder sobre o
// conteudo que passa por baixo.

const LINKS = [
  { href: "#comparativo", rotulo: "Comparativo" },
  { href: "#por-dentro", rotulo: "Por dentro" },
  { href: "#recursos", rotulo: "Recursos" },
  { href: "#preco", rotulo: "Preço" },
  { href: "#duvidas", rotulo: "Dúvidas" },
];

export function Heroi() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  // A foto anda 30% da propria altura enquanto o topo inteiro sai da tela.
  // O MotionConfig nao desliga movimento ligado a rolagem, entao quem pede
  // menos movimento fica com a foto parada aqui.
  const movimentoReduzido = useReducedMotion();
  const yFoto = useTransform(
    scrollYProgress,
    [0, 1],
    ["0%", movimentoReduzido ? "0%" : "30%"],
  );

  const { scrollY } = useScroll();
  const [rolou, setRolou] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setRolou(y > 24));

  return (
    <section
      ref={ref}
      id="topo"
      aria-labelledby="titulo"
      className="landing-tela relative flex min-h-svh flex-col overflow-hidden pt-24"
    >
      {/* Foto: cobre a tela inteira da abertura. */}
      <motion.div aria-hidden style={{ y: yFoto }} className="absolute inset-0">
        <Image
          src="/landing/ceu-pb.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-top"
        />
        {/* Veu escuro: segura a leitura do titulo e funde a foto com o fundo. */}
        <div className="absolute inset-0 bg-[radial-gradient(60%_45%_at_50%_32%,rgba(9,9,11,0.55),rgba(9,9,11,0)_70%),linear-gradient(180deg,rgba(9,9,11,0.25)_0%,rgba(9,9,11,0)_35%,rgba(9,9,11,0.6)_70%,#09090b_100%)]" />
      </motion.div>

      <Orbitas />

      {/* fixed: fica no topo da tela enquanto a pagina rola. A margem de cima
          soma a area segura do celular (notch). O espaco que o menu ocupava
          no fluxo vira o pt-18 da secao. */}
      <header className="fixed inset-x-0 top-0 z-50 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="landing-wrap">
          <div
            className={`flex items-center justify-between gap-4 rounded-full border py-2 pr-2 pl-5 backdrop-blur-md transition-[background-color,border-color,box-shadow] duration-300 ${
              rolou
                ? "border-landing-line-strong bg-[rgba(17,17,19,0.85)] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)]"
                : "border-landing-line bg-[rgba(17,17,19,0.6)]"
            }`}
          >
            <Image
              src="/logo-astro-branco.png"
              alt="Astro"
              width={712}
              height={219}
              className="h-6.5 w-auto"
              priority
            />
            <nav
              aria-label="Seções"
              className="hidden gap-6 text-sm text-landing-muted md:flex"
            >
              {LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="py-2 transition-colors hover:text-landing-ink"
                >
                  {l.rotulo}
                </a>
              ))}
            </nav>
            <div className="flex items-center gap-2">
              <EntrarNaEstetica className="landing-btn landing-btn-ghost landing-btn-sm whitespace-nowrap">
                Entrar
              </EntrarNaEstetica>
              {/* No celular, "Comecar agora" nao cabe na barra ao lado do
                  "Entrar": fica so "Comecar" (o completo esta logo abaixo). */}
              <a
                href="#preco"
                className="landing-btn landing-btn-primary landing-btn-sm whitespace-nowrap"
              >
                <span className="sm:hidden">Começar</span>
                <span className="max-sm:hidden">Começar agora</span>
              </a>
            </div>
          </div>
        </div>
      </header>

      <div className="landing-wrap relative z-10 flex flex-1 items-center py-6">
        <div className="grid w-full items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-6">
          <div className="grid justify-items-center gap-6 text-center lg:justify-items-start lg:text-left">
            <h1
              id="titulo"
              className="landing-subir [animation-delay:100ms] max-w-[40rem] text-[clamp(2.2rem,4.6vw,4rem)] leading-[1.07] font-extrabold tracking-tight text-balance [text-shadow:0_2px_30px_rgba(9,9,11,0.8)]"
            >
              A agenda da sua estética{" "}
              <span className="text-landing-glow">no ar</span>, com o cliente
              marcando sozinho.
            </h1>
            <p className="landing-subir [animation-delay:250ms] max-w-[34rem] text-lg text-[#e4e4e7] [text-shadow:0_1px_16px_rgba(9,9,11,0.9)]">
              <mark className="bg-transparent bg-[linear-gradient(transparent_60%,rgba(37,99,235,0.6)_60%)] px-0.5 font-bold text-landing-ink">
                Preço certo, horário livre e PIX
              </mark>{" "}
              no mesmo lugar, com o logo e a cor da sua estética.
            </p>
            <div className="landing-subir [animation-delay:400ms] flex flex-wrap justify-center gap-3 pt-2 lg:justify-start">
              <a href="#preco" className="landing-btn landing-btn-primary">
                Começar agora
              </a>
              <EntrarNaEstetica className="landing-btn landing-btn-ghost">
                Já tenho cadastro
              </EntrarNaEstetica>
            </div>
          </div>

          <div className="landing-subir [animation-delay:550ms] [animation-duration:0.9s]">
            <LequeDeCelulares />
          </div>
        </div>
      </div>

      <FaixaDePalavras />
    </section>
  );
}

// Tres telas reais do cliente em leque: a do meio de frente, as dos lados
// menores e inclinadas por tras, sobre um semicirculo de luz azul. A altura
// vem da tela (svh), para o leque caber na abertura junto com a faixa.
const LEQUE = [
  {
    img: "2-horario",
    alt: "Tela do cliente escolhendo dia e horário",
    lado: -1,
  },
  {
    img: "1-servico",
    alt: "Tela inicial do cliente, com os serviços e o preço para o carro dele",
    lado: 0,
  },
  {
    img: "5-pix",
    alt: "Tela do cliente pagando com PIX copia e cola",
    lado: 1,
  },
] as const;

function LequeDeCelulares() {
  return (
    <div className="relative mx-auto grid h-[min(36svh,20rem)] w-full max-w-[34rem] place-items-center lg:h-[min(60svh,32rem)]">
      {/* semicirculo de luz atras dos celulares */}
      <div
        aria-hidden
        className="absolute bottom-0 left-1/2 aspect-[2/1] w-[92%] -translate-x-1/2 rounded-t-full bg-[radial-gradient(100%_100%_at_50%_100%,rgba(37,99,235,0.85),rgba(37,99,235,0.25)_60%,transparent_75%)]"
      />
      {LEQUE.map((c) => (
        <div
          key={c.img}
          className={`absolute bottom-[4%] aspect-[600/1298] overflow-hidden rounded-[1.6rem] border-4 border-[#27272a] bg-black shadow-[0_30px_70px_-20px_rgba(0,0,0,0.95)] ${
            c.lado === 0 ? "z-10 h-full" : "h-[82%] brightness-75"
          }`}
          style={
            c.lado === 0
              ? undefined
              : {
                  transform: `translateX(${c.lado * 62}%) rotate(${c.lado * 9}deg)`,
                  transformOrigin: "bottom center",
                }
          }
        >
          <Image
            src={`/landing/fluxo/${c.img}.webp`}
            alt={c.alt}
            width={600}
            height={1298}
            sizes="16rem"
            priority={c.lado === 0}
            className="block h-full w-auto"
          />
        </div>
      ))}
    </div>
  );
}

// Faixa azul no pe da abertura com o que o Astro faz, em cinco palavras,
// passando devagar (letreiro). A lista vem duas vezes seguidas: andar metade
// do caminho cai no mesmo desenho, e o letreiro emenda sem salto. Quem pede
// menos movimento ve a faixa parada.
const PALAVRAS = [
  "Agenda online",
  "Preço por porte",
  "PIX copia e cola",
  "Lembretes por e-mail e Telegram",
  "Sua marca",
  "Horário sem conflito",
];

function FaixaDePalavras() {
  return (
    <div className="relative z-10 overflow-hidden border-y border-white/15 bg-[linear-gradient(90deg,#1e3a8a,#2563eb_50%,#1e3a8a)] py-3.5">
      <ul
        aria-label="O que o Astro faz"
        className="flex w-max animate-[landing-letreiro_40s_linear_infinite] motion-reduce:animate-none"
      >
        {[...PALAVRAS, ...PALAVRAS].map((p, i) => (
          <li
            key={`${p}-${i}`}
            aria-hidden={i >= PALAVRAS.length}
            className="flex items-center gap-6 px-6 text-lg font-bold whitespace-nowrap text-white"
          >
            <span aria-hidden className="size-1.5 rounded-full bg-white/70" />
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Linhas de orbita sobre a foto, com tres pontinhos girando devagar. A
// rotacao e CSS (animate-spin com duracao longa); motion-reduce:animate-none
// para quem pede menos movimento.
function Orbitas() {
  const girar = "origin-[600px_600px] motion-reduce:animate-none";
  return (
    <svg
      aria-hidden
      viewBox="0 0 1200 1200"
      className="pointer-events-none absolute top-[-14rem] left-1/2 w-[52rem] max-w-none -translate-x-1/2 md:top-[-22rem] md:w-[78rem]"
    >
      <circle
        cx="600"
        cy="600"
        r="560"
        fill="none"
        stroke="#ffffff"
        strokeOpacity=".10"
      />
      <circle
        cx="600"
        cy="600"
        r="470"
        fill="none"
        stroke="#ffffff"
        strokeOpacity=".14"
      />
      <circle
        cx="600"
        cy="600"
        r="380"
        fill="none"
        stroke="#ffffff"
        strokeOpacity=".18"
        strokeDasharray="3 10"
      />
      <g className={`${girar} animate-[spin_70s_linear_infinite]`}>
        <circle cx="1160" cy="600" r="6" fill="#fafafa" />
      </g>
      <g className={`${girar} animate-[spin_110s_linear_infinite_reverse]`}>
        <circle cx="600" cy="130" r="4.5" fill="#60a5fa" />
      </g>
      <g className={`${girar} animate-[spin_50s_linear_infinite]`}>
        <circle cx="220" cy="600" r="3.5" fill="#60a5fa" />
      </g>
    </svg>
  );
}
