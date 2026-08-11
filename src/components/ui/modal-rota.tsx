"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

// Casulo dos modais que sao rota interceptada. Ele so desenha o fundo
// embacado e o cartao; o conteudo vem de fora.
//
// Fechar e voltar no historico, e nao esconder um estado: como a rota
// interceptada trocou a URL ao abrir, o "voltar" do navegador e o Esc precisam
// levar de volta a tela de tras — que e onde o usuario acha que ainda esta.
export function ModalRota({
  titulo,
  rotulo,
  children,
}: {
  titulo: string;
  rotulo?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") router.back();
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
  }, [router]);

  return (
    // Gaveta pelo rodape no celular; cartao centralizado no desktop — o mesmo
    // comportamento do modal de "Editar dados" no perfil.
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      className="fixed inset-0 z-50 flex items-end justify-center lg:items-center lg:p-6"
    >
      <button
        aria-label="Fechar"
        onClick={() => router.back()}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />

      <div className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-4 lg:max-h-[88dvh] lg:max-w-2xl lg:rounded-3xl lg:pb-8 lg:pt-8">
        {/* Puxador — so faz sentido na gaveta. */}
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-zinc-200 lg:hidden" />

        <div className="flex items-start justify-between gap-4 px-6 lg:px-8">
          <div>
            {rotulo && <p className="astro-label">{rotulo}</p>}
            <h2 className="text-xl font-bold text-zinc-900">{titulo}</h2>
          </div>
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Fechar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 transition hover:bg-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 lg:px-8">{children}</div>
      </div>
    </div>
  );
}
