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
  subtitulo,
  children,
  rodape,
}: {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  subtitulo?: string;
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
      className="m-auto max-h-[85dvh] w-[min(34rem,92vw)] rounded-2xl border border-admin-border bg-admin-surface p-0 text-slate-100 shadow-2xl shadow-black/60 backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      <div className="flex max-h-[85dvh] flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-admin-border px-5 py-4">
          <div className="min-w-0">
            {subtitulo && <p className="astro-label">{subtitulo}</p>}
            <h2 id="titulo-modal" className="mt-0.5 text-lg font-semibold text-white">
              {titulo}
            </h2>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="shrink-0 rounded-md p-1 text-astro-muted transition hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {rodape && (
          <footer className="flex flex-wrap items-center gap-2 border-t border-admin-border px-5 py-4">
            {rodape}
          </footer>
        )}
      </div>
    </dialog>
  );
}
