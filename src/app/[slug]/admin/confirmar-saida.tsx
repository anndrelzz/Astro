"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { Loader2, LogOut } from "lucide-react";

// Confirmacao de saida do painel. Usa o <dialog> nativo, como o Modal do
// painel (Esc fecha, foco preso, resto da pagina inerte), mas com desenho
// proprio: um aviso curto e centralizado, nao um formulario com cabecalho.
//
// Mostra quem esta saindo e de qual estetica, para quem divide o computador
// da loja ter certeza de que a conta e a sua. Sair nao apaga nada, entao o
// botao usa a cor da estetica, nao o vermelho de acao destrutiva.
export function ConfirmarSaida({
  aberto,
  onFechar,
  slug,
  usuarioNome,
  tenantNome,
}: {
  aberto: boolean;
  onFechar: () => void;
  slug: string;
  usuarioNome?: string;
  tenantNome?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelar = useRef<HTMLButtonElement>(null);
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (aberto && !dialog.open) {
      dialog.showModal();
      document.body.style.overflow = "hidden";
      // Foco no "Continuar no painel": Enter por engano nao desloga ninguem.
      cancelar.current?.focus();
    } else if (!aberto && dialog.open) {
      dialog.close();
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [aberto]);

  function sair() {
    setSaindo(true);
    // callbackUrl para o login DESTA estetica: a raiz do dominio nao pertence
    // a nenhuma (RN09).
    signOut({ callbackUrl: `/${slug}/login` });
  }

  const primeiroNome = usuarioNome?.split(" ")[0];

  return (
    <dialog
      ref={ref}
      onClose={onFechar}
      onCancel={(e) => {
        if (saindo) e.preventDefault();
        else onFechar();
      }}
      onClick={(e) => {
        if (e.target === ref.current && !saindo) onFechar();
      }}
      aria-labelledby="titulo-sair"
      aria-describedby="texto-sair"
      className="m-auto w-[min(27rem,92vw)] overflow-hidden rounded-3xl border border-white/12 bg-[#0d0d11] p-0 text-slate-100 shadow-2xl shadow-black/70 backdrop:bg-black/70 backdrop:backdrop-blur-sm open:animate-[surgir_200ms_cubic-bezier(0.22,1,0.36,1)] motion-reduce:open:animate-none"
    >
      {/* Brilho da cor da estetica no topo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40"
        style={{
          background:
            "radial-gradient(70% 100% at 50% 0%, color-mix(in srgb, var(--color-astro-blue) 35%, transparent), transparent)",
        }}
      />

      <div className="relative flex flex-col items-center px-6 pt-8 pb-6 text-center">
        <span
          className="grid h-16 w-16 place-items-center rounded-full text-white"
          style={{
            background: "linear-gradient(135deg, var(--color-astro-blue), var(--color-astro-blue-bright))",
            boxShadow:
              "0 0 0 8px color-mix(in srgb, var(--color-astro-blue) 18%, transparent), 0 12px 32px -8px var(--color-astro-blue)",
          }}
        >
          <LogOut className="h-7 w-7 translate-x-0.5" />
        </span>

        <h2 id="titulo-sair" className="mt-5 text-xl font-bold text-white">
          Sair do painel?
        </h2>
        <p id="texto-sair" className="mt-2 text-sm leading-relaxed text-astro-muted">
          Para voltar, é só entrar de novo com seu e-mail e senha.
        </p>

        {/* Quem esta saindo, para quem divide o computador da loja */}
        {usuarioNome && (
          <div className="mt-4 flex max-w-full items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] py-1.5 pr-4 pl-1.5">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-black">
              {usuarioNome[0]?.toUpperCase()}
            </span>
            <span className="min-w-0 truncate text-sm">
              <b className="font-semibold text-white">{primeiroNome}</b>
              {tenantNome && <span className="text-astro-muted"> · {tenantNome}</span>}
            </span>
          </div>
        )}

        <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
          <button
            ref={cancelar}
            type="button"
            onClick={onFechar}
            disabled={saindo}
            className="rounded-full border border-admin-border px-4 py-3 text-sm font-semibold whitespace-nowrap text-slate-200 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
          >
            Continuar no painel
          </button>
          <button
            type="button"
            onClick={sair}
            disabled={saindo}
            className="flex items-center justify-center gap-2 rounded-full bg-astro-blue px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_-12px_var(--color-astro-blue)] transition hover:brightness-110 disabled:opacity-70"
          >
            {saindo ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saindo...
              </>
            ) : (
              "Sair"
            )}
          </button>
        </div>
      </div>
    </dialog>
  );
}
