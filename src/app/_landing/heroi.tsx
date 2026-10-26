"use client";

import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import { useRef, useState } from "react";
import { Vitrine } from "./vitrine";

// Topo da landing: imagem do ceu ao fundo, orbitas por cima, menu, titulo
// e a vitrine com o celular.
//
// Duas animacoes aqui:
// - Entrada: titulo e frase aparecem um depois do outro; a vitrine
//   sobe por ultimo. E animacao CSS (classe landing-subir em globals.css), nao
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
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  // A foto anda 30% da propria altura enquanto o topo inteiro sai da tela.
  // O MotionConfig nao desliga movimento ligado a rolagem, entao quem pede
  // menos movimento fica com a foto parada aqui.
  const movimentoReduzido = useReducedMotion();
  const yFoto = useTransform(scrollYProgress, [0, 1], ["0%", movimentoReduzido ? "0%" : "30%"]);

  const { scrollY } = useScroll();
  const [rolou, setRolou] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setRolou(y > 24));

  return (
    <section ref={ref} id="topo" aria-labelledby="titulo" className="relative overflow-hidden pt-18 pb-20">
      {/* Foto: a altura acompanha a proporcao dela (2000x1125) para nao ampliar
          mais que o necessario numa tela larga. */}
      <motion.div
        aria-hidden
        style={{ y: yFoto }}
        className="absolute inset-x-0 top-0 h-[max(40rem,56.25vw)]"
      >
        <Image src="/landing/ceu-pb.webp" alt="" fill priority sizes="100vw" className="object-cover object-top" />
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
            <Image src="/logo-astro-branco.png" alt="Astro" width={712} height={219} className="h-6.5 w-auto" priority />
            <nav aria-label="Seções" className="hidden gap-6 text-sm text-landing-muted md:flex">
              {LINKS.map((l) => (
                <a key={l.href} href={l.href} className="py-2 transition-colors hover:text-landing-ink">
                  {l.rotulo}
                </a>
              ))}
            </nav>
            <a href="#preco" className="landing-btn landing-btn-primary landing-btn-sm">
              Começar agora
            </a>
          </div>
        </div>
      </header>

      <div className="landing-wrap relative z-10">
        <div className="grid justify-items-center gap-5 pt-12 pb-8 text-center md:pt-18 md:pb-12">
          <h1
            id="titulo"
            className="landing-subir [animation-delay:100ms] max-w-[50rem] text-[clamp(2.2rem,5.2vw,3.9rem)] leading-[1.07] font-extrabold tracking-tight text-balance [text-shadow:0_2px_30px_rgba(9,9,11,0.8)]"
          >
            A agenda da sua estética <span className="text-landing-glow">no ar</span>, com o
            cliente marcando sozinho.
          </h1>
          <p className="landing-subir [animation-delay:250ms] max-w-[38rem] text-lg text-[#e4e4e7] [text-shadow:0_1px_16px_rgba(9,9,11,0.9)]"
          >
            <mark className="bg-transparent bg-[linear-gradient(transparent_60%,rgba(37,99,235,0.6)_60%)] px-0.5 font-bold text-landing-ink">
              Preço certo, horário livre e PIX
            </mark>{" "}
            no mesmo lugar, com o logo e a cor da sua estética.
          </p>
        </div>

        <div className="landing-subir [animation-delay:600ms] [animation-duration:0.9s]">
          <Vitrine />
        </div>
      </div>
    </section>
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
      <circle cx="600" cy="600" r="560" fill="none" stroke="#ffffff" strokeOpacity=".10" />
      <circle cx="600" cy="600" r="470" fill="none" stroke="#ffffff" strokeOpacity=".14" />
      <circle cx="600" cy="600" r="380" fill="none" stroke="#ffffff" strokeOpacity=".18" strokeDasharray="3 10" />
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
