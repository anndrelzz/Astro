"use client";

import { useEffect, useRef } from "react";
import { TriangleAlert } from "lucide-react";

// Segunda confirmacao do Catalogo (decisao do Andre, 10/11): mudar a duracao
// ou o preco de um servico vale so para os proximos agendamentos, porque cada
// agendamento guarda a duracao e o valor de quando foi feito. O aviso mostra o
// que mudou e pede "Salvar mesmo assim", para o dono saber o que esta fazendo.
//
// Mesmo desenho do aviso de sair do painel (ConfirmarSaida), com o <dialog>
// nativo: Esc e o clique fora valem como "Voltar".
export function AvisoMudancaServico({
  mudancas,
  salvando,
  onVoltar,
  onConfirmar,
}: {
  /** Linhas como "Duração: 1h → 2h". Vazio = aviso fechado. */
  mudancas: string[];
  salvando: boolean;
  onVoltar: () => void;
  onConfirmar: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const voltar = useRef<HTMLButtonElement>(null);
  const aberto = mudancas.length > 0;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (aberto && !dialog.open) {
      dialog.showModal();
      // Foco no "Voltar": um Enter por engano nao salva.
      voltar.current?.focus();
    } else if (!aberto && dialog.open) {
      dialog.close();
    }
  }, [aberto]);

  return (
    <dialog
      ref={ref}
      role="alertdialog"
      aria-labelledby="titulo-aviso-mudanca"
      aria-describedby="texto-aviso-mudanca"
      onCancel={(e) => {
        e.preventDefault();
        if (!salvando) onVoltar();
      }}
      onClick={(e) => {
        if (e.target === ref.current && !salvando) onVoltar();
      }}
      className="m-auto w-[min(28rem,92vw)] overflow-hidden rounded-3xl border border-white/12 bg-[#0d0d11] p-0 text-slate-100 shadow-2xl shadow-black/70 backdrop:bg-black/70 backdrop:backdrop-blur-sm open:animate-[surgir_200ms_cubic-bezier(0.22,1,0.36,1)] motion-reduce:open:animate-none"
    >
      {aberto && (
        <div className="flex flex-col items-center px-6 pt-8 pb-6 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-amber-400/15 text-amber-300 ring-8 ring-amber-400/10">
            <TriangleAlert className="h-8 w-8" aria-hidden />
          </span>

          <h2 id="titulo-aviso-mudanca" className="mt-5 text-xl font-bold text-white">
            Essa mudança vale para os próximos agendamentos
          </h2>

          <ul className="mt-4 w-full space-y-1.5 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left text-sm">
            {mudancas.map((linha) => (
              <li key={linha} className="font-medium text-white">
                {linha}
              </li>
            ))}
          </ul>

          <p id="texto-aviso-mudanca" className="mt-4 text-sm leading-relaxed text-astro-muted">
            Os agendamentos já marcados continuam com a duração e o preço de quando foram feitos. A mudança vale
            para os agendamentos feitos a partir de agora.
          </p>

          <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
            <button
              ref={voltar}
              type="button"
              onClick={onVoltar}
              disabled={salvando}
              className="rounded-full border border-admin-border px-5 py-3 text-sm font-semibold text-slate-200 transition hover:text-white disabled:opacity-50"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={onConfirmar}
              disabled={salvando}
              className="rounded-full bg-amber-400 px-5 py-3 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-50"
            >
              {salvando ? "Salvando..." : "Salvar mesmo assim"}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
