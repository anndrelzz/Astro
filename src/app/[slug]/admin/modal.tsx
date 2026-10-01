"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

// Modal do painel, sobre o elemento <dialog> nativo.
//
// Usar o nativo em vez de uma div flutuante entrega de graca o que um modal
// precisa e costuma faltar quando se faz na mao: Esc fecha, o foco fica preso
// dentro enquanto aberto, o resto da pagina vira inerte para leitores de tela,
// e o fundo (::backdrop) e um pseudo-elemento de verdade — da para desfocar
// sem empilhar z-index.

export function Modal({
  aberto,
  onFechar,
  titulo,
  children,
  rodape,
}: {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  children: React.ReactNode;
  rodape?: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (aberto && !dialog.open) {
      dialog.showModal();
      // Trava a rolagem do fundo enquanto o modal esta aberto.
      document.body.style.overflow = "hidden";

      // O showModal() foca o primeiro elemento focavel, que aqui e o "X" de
      // fechar — e o atributo autofocus nao vence isso de forma confiavel
      // quando o dialog e aberto por codigo. Entao a procura e explicita: se o
      // conteudo tem um campo, ele recebe o foco. Num modal de um campo so,
      // obrigar um clique antes de digitar e atrito a toa.
      const campo = dialog.querySelector<HTMLElement>(
        "input:not([type=hidden]), textarea, select"
      );
      campo?.focus();
    } else if (!aberto && dialog.open) {
      dialog.close();
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [aberto]);

  return (
    <dialog
      ref={ref}
      // O Esc do navegador dispara "cancel"; o "close" cobre as duas saidas.
      onClose={onFechar}
      onCancel={onFechar}
      // Clique fora fecha: o <dialog> ocupa a tela toda, entao o alvo do
      // clique so e o proprio dialog quando cai no vazio ao redor do painel.
      onClick={(e) => {
        if (e.target === ref.current) onFechar();
      }}
      aria-labelledby="titulo-modal"
      // m-auto e obrigatorio aqui: o <dialog> nativo se centraliza sozinho com
      // margin:auto, mas o reset do Tailwind zera a margem de todo elemento
      // (`*, ::before, ::after { margin: 0 }`) e o modal cai no canto superior
      // esquerdo. Sem esta classe, a centralizacao do navegador nao acontece.
      //
      // Vidro fosco: o painel e quase transparente (bg-white/[0.06]) e quem da
      // corpo a ele e o backdrop-blur-2xl, que desfoca o conteudo atras. Isso
      // so funciona porque o fundo e escuro — a borda clara de 1px e o anel
      // interno sao o que desenha a "quina" do vidro e separa o painel da tela.
      //
      // O ::backdrop escurece antes de desfocar: sem ele, o modal aberto sobre
      // uma area clara (o banner azul do Dashboard) perderia contraste do texto.
      className="m-auto max-h-[85dvh] w-[min(34rem,92vw)] overflow-hidden rounded-2xl border border-white/15 bg-white/[0.06] p-0 text-slate-100 shadow-2xl shadow-black/70 ring-1 ring-inset ring-white/5 backdrop-blur-2xl backdrop:bg-black/60 backdrop:backdrop-blur-md"
    >
      {/* Brilho superior tingido pela cor do tenant (RF13), como na faixa do
          Catalogo e no painel de marca do login. E o que impede o vidro de
          parecer um retangulo cinza generico. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-28"
        style={{
          backgroundImage:
            "linear-gradient(180deg, color-mix(in srgb, var(--color-astro-blue) 28%, transparent) 0%, transparent 100%)",
        }}
      />

      <div className="relative flex max-h-[85dvh] flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <h2 id="titulo-modal" className="text-lg font-semibold text-white">
              {titulo}
            </h2>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="shrink-0 rounded-md p-1 text-astro-muted transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {rodape && (
          // Rodape um tom mais escuro que o corpo: assenta os botoes e evita
          // que eles flutuem no vidro sem base.
          <footer className="flex flex-wrap items-center gap-2 border-t border-white/10 bg-black/20 px-5 py-4">
            {rodape}
          </footer>
        )}
      </div>
    </dialog>
  );
}
