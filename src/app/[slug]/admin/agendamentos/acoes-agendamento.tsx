"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AcoesAgendamento({
  agendamentoId,
  status,
}: {
  agendamentoId: string;
  status: string;
}) {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function chamar(acao: "confirmar-pix" | "cancelar") {
    setCarregando(true);
    setErro(null);
    const resposta = await fetch(`/api/agendamentos/${agendamentoId}/${acao}`, {
      method: "POST",
    });
    setCarregando(false);

    if (!resposta.ok) {
      const json = await resposta.json().catch(() => null);
      setErro(json?.error ?? "Nao foi possivel completar a acao.");
      return;
    }
    router.refresh();
  }

  const finalizado = status === "CANCELADO" || status === "CONCLUIDO";

  return (
    <div className="mt-2 flex items-center gap-2">
      {status === "PIX_PENDENTE" && (
        <button
          onClick={() => chamar("confirmar-pix")}
          disabled={carregando}
          className="rounded bg-astro-blue px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
        >
          Confirmar pagamento PIX
        </button>
      )}
      {!finalizado && (
        <button
          onClick={() => chamar("cancelar")}
          disabled={carregando}
          className="rounded border border-admin-border px-3 py-1 text-xs text-slate-200 disabled:opacity-50"
        >
          Cancelar
        </button>
      )}
      {erro && <span className="text-xs text-red-600">{erro}</span>}
    </div>
  );
}
