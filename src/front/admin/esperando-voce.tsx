"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// "Esperando voce": os PIX que o cliente diz ter pago e que o dono ainda
// precisa conferir no banco e confirmar (RN05, UC16). Usa a mesma rota da tela
// de Agendamentos; depois de confirmar, router.refresh() recarrega os numeros
// do Dashboard (faturamento, contador do menu) sem sair da pagina.
//
// Para confirmar com acrescimo ou cancelar, o caminho continua sendo a tela de
// Agendamentos, que tem essas acoes.

export type ItemEsperando = {
  id: string;
  hora: string;
  dia: string;
  cliente: string;
  detalhe: string;
};

export function EsperandoVoce({ itens }: { itens: ItemEsperando[] }) {
  const router = useRouter();
  const [processando, setProcessando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar(id: string) {
    setProcessando(id);
    setErro(null);
    const resposta = await fetch(`/api/agendamentos/${id}/confirmar-pagamento`, { method: "POST" });
    setProcessando(null);
    if (!resposta.ok) {
      const json = await resposta.json().catch(() => null);
      setErro(json?.error ?? "Não foi possível confirmar o pagamento.");
      return;
    }
    router.refresh();
  }

  return (
    <section className="rounded-3xl border border-admin-border bg-admin-surface p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-white">Esperando você</h2>
        <span className="text-xs text-astro-muted">PIX para confirmar</span>
      </div>

      {erro && <p className="mb-3 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">{erro}</p>}

      {itens.length === 0 ? (
        <p className="rounded-xl border border-dashed border-admin-border p-6 text-center text-sm text-astro-muted">
          Nenhum PIX esperando confirmação.
        </p>
      ) : (
        <ul className="grid gap-2">
          {itens.map((item) => (
            <li
              key={item.id}
              className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-admin-surface-2 px-3 py-2.5"
            >
              <span className="font-mono text-sm font-bold text-white">
                {item.hora}
                <small className="block text-[0.65rem] font-medium text-astro-muted">{item.dia}</small>
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-white">{item.cliente}</span>
                <span className="block truncate text-xs text-astro-muted">{item.detalhe}</span>
              </span>
              <button
                type="button"
                onClick={() => confirmar(item.id)}
                disabled={processando === item.id}
                className="rounded-full bg-astro-blue px-3.5 py-2 text-xs font-semibold whitespace-nowrap text-white transition hover:brightness-110 disabled:opacity-50"
              >
                {processando === item.id ? "Confirmando..." : "Confirmar PIX"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
