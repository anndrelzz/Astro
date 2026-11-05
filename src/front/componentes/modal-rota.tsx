"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  animate,
  motion,
  useDragControls,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { X } from "lucide-react";

// Casulo dos modais que sao rota interceptada. Ele so desenha o fundo
// embacado e o cartao; o conteudo vem de fora.
//
// Fechar e voltar no historico, e nao esconder um estado: como a rota
// interceptada trocou a URL ao abrir, o "voltar" do navegador e o Esc precisam
// levar de volta a tela de tras — que e onde o usuario acha que ainda esta.
//
// No celular e uma gaveta: sobe de baixo ao abrir e fecha ao ser puxada para
// baixo pelo topo (puxador e titulo). So o topo arrasta porque o resto tem
// campos e rola; arrastar dali brigaria com a rolagem e com a digitacao.
export function ModalRota({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  // Respeita quem tem preferencia por menos movimento (SO), comum em quem
  // tem enjoo/vestibular: sem isso a transicao de deslocamento rodava igual.
  const movimentoReduzido = useReducedMotion();

  // Deslocamento vertical da gaveta. O fundo clareia conforme ela desce.
  const y = useMotionValue(0);
  const opacidadeFundo = useTransform(y, [0, 400], [1, 0]);
  const arrasto = useDragControls();
  const gaveta = useRef<HTMLDivElement>(null);
  const fechando = useRef(false);

  // Desce a gaveta ate sumir e so entao volta no historico: a rota
  // interceptada desmonta na hora, sem tempo para animacao de saida.
  const fechar = useCallback(() => {
    if (fechando.current) return;
    fechando.current = true;
    const altura = gaveta.current?.offsetHeight ?? 600;
    animate(y, altura, {
      duration: movimentoReduzido ? 0 : 0.22,
      ease: "easeIn",
    }).then(() => router.back());
  }, [movimentoReduzido, router, y]);

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") fechar();
    }
    document.addEventListener("keydown", aoTeclar);

    // Trava a rolagem do fundo enquanto o modal esta aberto — sem isso a
    // pagina de tras rola junto quando o cursor sai do cartao.
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = overflowAnterior;
    };
  }, [fechar]);

  return (
    // Gaveta pelo rodape no celular; cartao centralizado no desktop — o mesmo
    // comportamento do modal de "Editar dados" no perfil.
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      className="fixed inset-0 z-50 flex items-end justify-center lg:items-center lg:p-6"
    >
      <motion.button
        aria-label="Fechar"
        onClick={fechar}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        style={{ opacity: opacidadeFundo }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: movimentoReduzido ? 0 : 0.25 }}
      />

      <motion.div
        ref={gaveta}
        className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white pb-[calc(env(safe-area-inset-bottom)+1.5rem)] lg:max-h-[88dvh] lg:max-w-2xl lg:rounded-3xl lg:pb-8 lg:pt-8"
        style={{ y }}
        initial={{ y: movimentoReduzido ? 0 : "100%" }}
        animate={{ y: 0 }}
        transition={
          movimentoReduzido
            ? { duration: 0 }
            : { type: "spring", damping: 32, stiffness: 320 }
        }
        drag="y"
        dragControls={arrasto}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 1 }}
        onDragEnd={(_, info) => {
          // Fecha se desceu bastante ou foi "jogada" para baixo; senao volta.
          if (info.offset.y > 120 || info.velocity.y > 500) fechar();
        }}
      >
        {/* Topo arrastavel: puxador e titulo. touch-none para o navegador nao
            tratar o gesto como rolagem da pagina. */}
        <div
          onPointerDown={(e) => {
            if (!window.matchMedia("(min-width: 1024px)").matches)
              arrasto.start(e);
          }}
          className="touch-none pt-4 lg:touch-auto lg:pt-0"
        >
          {/* Puxador — so faz sentido na gaveta. */}
          <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-zinc-200 lg:hidden" />

          <div className="flex items-start justify-between gap-4 px-6 lg:px-8">
            <h2 className="text-xl font-bold text-zinc-900">{titulo}</h2>
            <button
              type="button"
              onClick={fechar}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="Fechar"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 transition hover:bg-zinc-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="px-6 lg:px-8">{children}</div>
      </motion.div>
    </div>
  );
}
