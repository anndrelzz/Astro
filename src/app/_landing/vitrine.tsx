"use client";

import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "framer-motion";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

// Vitrine do topo: o fluxo de agendamento do cliente num carrossel em pilha
// (como um baralho). Tres cartoes aparecem: um na frente, grande e nitido, e
// um espiando de cada lado, atras. Na troca, o da frente vai para tras da
// pilha e o de tras do outro lado vem para a frente.
//
// Cada cartao e um print real do Astro (estetica de teste, celular 390x844),
// em public/landing/fluxo, com uma faixa preta na direita trazendo o nome da
// etapa na vertical.
//
// Passa sozinho a cada 2,5 s; para com o mouse em cima dos cartoes ou com o
// foco do teclado neles. Da para arrastar (celular), usar as setas da tela ou
// as do teclado. Quem pede menos movimento no aparelho fica sem a troca
// automatica.

const CARTOES = [
  { img: "1-servico", etapa: 0, nome: "Serviço", titulo: "Escolhe o serviço", texto: "O preço já aparece certo para o carro que ele cadastrou." },
  { img: "2-horario", etapa: 1, nome: "Horário", titulo: "Escolhe dia e horário", texto: "Só aparecem horários com vaga, pela sua grade e capacidade." },
  { img: "3-pagamento", etapa: 2, nome: "Pagamento", titulo: "Escolhe como pagar", texto: "PIX copia e cola com a sua chave, ou pagamento no local." },
  { img: "4-acrescimo", etapa: 2, nome: "Acréscimo", titulo: "Avisado antes de pagar", texto: "Se a estética cobra acréscimo pela condição do carro, ele fica sabendo aqui." },
  { img: "5-pix", etapa: 2, nome: "PIX", titulo: "Paga por PIX", texto: "Copia o código e paga no app do banco dele." },
  { img: "6-detalhes", etapa: 3, nome: "Reservado", titulo: "Horário reservado", texto: "O agendamento cai no seu painel para você confirmar o pagamento." },
] as const;

const ETAPAS = ["Serviço", "Horário", "PIX", "Agendado"];
const INTERVALO_MS = 2500;

export function Vitrine() {
  const [ativo, setAtivo] = useState(0);
  const [pausado, setPausado] = useState(false);
  const movimentoReduzido = useReducedMotion();
  const pilha = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(1000);
  const [alturaTela, setAlturaTela] = useState(900);

  const ir = useCallback((delta: number) => {
    setAtivo((a) => (a + delta + CARTOES.length) % CARTOES.length);
  }, []);

  // Troca automatica.
  useEffect(() => {
    if (pausado || movimentoReduzido) return;
    const id = setTimeout(() => ir(1), INTERVALO_MS);
    return () => clearTimeout(id);
  }, [ativo, pausado, movimentoReduzido, ir]);

  // O tamanho do cartao acompanha a area da pilha e a altura da tela.
  useEffect(() => {
    const el = pilha.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setLargura(e.contentRect.width));
    ro.observe(el);
    const medirTela = () => setAlturaTela(window.innerHeight);
    medirTela();
    window.addEventListener("resize", medirTela);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", medirTela);
    };
  }, []);

  // Altura do print: o maior que cabe na tela junto com as etapas e o pe do
  // palco (~200px), ate 640px. A largura vem da proporcao do celular, e o
  // cartao inteiro (print + faixa) tambem precisa caber na largura da pilha
  // com os vizinhos espiando.
  // No celular a faixa preta e mais fina e os vizinhos espiam menos, para
  // sobrar largura para o print.
  const estreito = largura < 500;
  const FAIXA = estreito ? 40 : 52;
  const telaA0 = Math.min(640, Math.max(360, alturaTela - 200));
  const telaL0 = (telaA0 * 390) / 844;
  const cabeLargura = largura / (estreito ? 1.22 : 1.5) - FAIXA;
  const telaL = Math.round(Math.min(telaL0, cabeLargura));
  const telaA = Math.round((telaL * 844) / 390);
  const cartaoL = telaL + FAIXA;
  const deslocamento = cartaoL * (estreito ? 0.13 : 0.28);
  const atual = CARTOES[ativo];

  function aoSoltar(_: unknown, info: PanInfo) {
    if (info.offset.x < -40) ir(1);
    else if (info.offset.x > 40) ir(-1);
  }

  return (
    <div
      className="relative z-10 overflow-hidden rounded-[2rem] border border-landing-line bg-[linear-gradient(160deg,rgba(39,39,42,0.9)_0%,rgba(9,9,11,0.97)_100%)] shadow-[0_40px_100px_-40px_rgba(37,99,235,0.5)]"
    >
      {/* Alto: as etapas do agendamento. */}
      <div className="relative z-20 flex justify-center px-5 pt-6 sm:px-8 sm:pt-7">
        <ol aria-label="Etapas do agendamento" className="flex flex-wrap items-center justify-center gap-1.5">
          {ETAPAS.map((nome, i) => (
            <li key={nome} className="flex items-center gap-1.5">
              {i > 0 && (
                <span
                  aria-hidden
                  className={`h-px w-3 transition-colors duration-500 sm:w-5 ${i <= atual.etapa ? "bg-landing-blue" : "bg-landing-line-strong"}`}
                />
              )}
              <span
                aria-current={i === atual.etapa ? "step" : undefined}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[0.7rem] font-bold tracking-wider uppercase transition-colors duration-500 sm:text-xs ${
                  i === atual.etapa
                    ? "border-landing-blue bg-landing-blue text-white shadow-[0_0_24px_-4px_rgba(37,99,235,0.8)]"
                    : i < atual.etapa
                      ? "border-landing-blue/60 text-landing-glow"
                      : "border-landing-line-strong text-landing-muted"
                }`}
              >
                {i < atual.etapa && <Check aria-hidden className="size-3" strokeWidth={3} />}
                {nome}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {/* Meio: no computador, texto e setas a esquerda e a pilha a direita;
          no celular, a pilha em cima e o texto embaixo. */}
      <div className="relative z-10 grid items-center gap-6 px-5 pt-5 pb-6 sm:px-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-10">
        <div className="order-2 grid gap-5 lg:order-1">
          <div aria-live="polite" className="min-h-28">
            <AnimatePresence mode="wait">
              <motion.div
                key={atual.img}
                initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -10, filter: "blur(6px)" }}
                transition={{ duration: 0.35 }}
                className="grid gap-2"
              >
                <p className="font-mono text-sm font-bold text-landing-glow">
                  {String(ativo + 1).padStart(2, "0")} / {String(CARTOES.length).padStart(2, "0")}
                </p>
                <h3 className="text-2xl font-bold lg:text-3xl">{atual.titulo}</h3>
                <p className="max-w-sm text-landing-muted lg:text-lg">{atual.texto}</p>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => ir(-1)} aria-label="Tela anterior" className="grid size-11 cursor-pointer place-items-center rounded-full border border-landing-line-strong text-landing-ink transition-colors hover:border-landing-glow">
              <ChevronLeft className="size-5" />
            </button>
            <button type="button" onClick={() => ir(1)} aria-label="Próxima tela" className="grid size-11 cursor-pointer place-items-center rounded-full border border-landing-line-strong text-landing-ink transition-colors hover:border-landing-glow">
              <ChevronRight className="size-5" />
            </button>
          </div>
        </div>

        <motion.div
          ref={pilha}
          role="region"
          aria-roledescription="carrossel"
          aria-label="Telas do agendamento do cliente"
          tabIndex={0}
          // Pausa so com o mouse em cima dos cartoes ou com o foco do teclado
          // neles. O resto do palco (texto, setas) nao segura a troca.
          onMouseEnter={() => setPausado(true)}
          onMouseLeave={() => setPausado(false)}
          onFocus={() => setPausado(true)}
          onBlur={() => setPausado(false)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") ir(1);
            if (e.key === "ArrowLeft") ir(-1);
          }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.15}
          onDragEnd={aoSoltar}
          className="relative order-1 cursor-grab touch-pan-y rounded-3xl outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-landing-glow lg:order-2"
          style={{ height: telaA }}
        >
          {CARTOES.map((c, i) => {
            // Posicao relativa ao cartao da frente: -1 (atras, a esquerda),
            // 0 (frente), 1 (atras, a direita). Os demais ficam escondidos
            // atras da pilha, esperando a vez.
            let rel = i - ativo;
            if (rel > CARTOES.length / 2) rel -= CARTOES.length;
            if (rel < -CARTOES.length / 2 + 1) rel += CARTOES.length;
            const lado = Math.abs(rel) === 1;
            const visivel = Math.abs(rel) <= 1;
            return (
              <motion.button
                key={c.img}
                type="button"
                tabIndex={-1}
                aria-hidden={rel !== 0}
                onClick={() => rel !== 0 && ir(rel)}
                initial={false}
                animate={{
                  x: visivel ? rel * deslocamento : 0,
                  scale: rel === 0 ? 1 : lado ? 0.86 : 0.74,
                  opacity: visivel ? 1 : 0,
                  filter: rel === 0 ? "brightness(1)" : "brightness(0.45)",
                }}
                transition={{ type: "spring", stiffness: 170, damping: 24 }}
                className="absolute top-0 left-1/2 flex overflow-hidden rounded-[1.8rem] border border-white/15 bg-black text-left shadow-[0_30px_70px_-20px_rgba(0,0,0,0.95)]"
                style={{
                  width: cartaoL,
                  height: telaA,
                  marginLeft: -cartaoL / 2,
                  zIndex: rel === 0 ? 3 : lado ? 2 : 1,
                  pointerEvents: visivel ? "auto" : "none",
                }}
              >
                <Image
                  src={`/landing/fluxo/${c.img}.webp`}
                  alt={rel === 0 ? `Tela do Astro: ${c.titulo}` : ""}
                  width={600}
                  height={1298}
                  sizes="300px"
                  priority={i < 2}
                  draggable={false}
                  className="h-full w-auto shrink-0 select-none"
                  style={{ width: telaL }}
                />
                {/* Faixa preta com a etapa na vertical. */}
                <span
                  className="flex shrink-0 flex-col items-center justify-between py-5"
                  style={{ width: FAIXA }}
                >
                  <span className="font-mono text-[0.65rem] font-bold text-landing-glow [writing-mode:vertical-rl]">
                    {String(i + 1).padStart(2, "0")} · Astro
                  </span>
                  <span className="rotate-180 text-2xl font-extrabold tracking-tight text-white [writing-mode:vertical-rl]">
                    {c.nome}
                  </span>
                </span>
              </motion.button>
            );
          })}
        </motion.div>
      </div>

      <div aria-hidden className="relative z-20 h-1 bg-landing-line">
        <motion.div
          className="h-full bg-landing-blue"
          animate={{ width: `${((ativo + 1) / CARTOES.length) * 100}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
    </div>
  );
}
