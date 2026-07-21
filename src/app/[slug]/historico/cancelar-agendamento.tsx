"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CancelarAgendamento({ agendamentoId }: { agendamentoId: string }) {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function cancelar() {
    setCarregando(true);
    setErro(null);
    const resposta = await fetch(`/api/agendamentos/${agendamentoId}/cancelar`, {
      method: "POST",
    });
    setCarregando(false);

    if (!resposta.ok) {
      const json = await resposta.json().catch(() => null);
      setErro(json?.error ?? "Nao foi possivel cancelar.");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <button
        onClick={cancelar}
        disabled={carregando}
        className="rounded border border-zinc-300 px-3 py-1 text-xs disabled:opacity-50 dark:border-zinc-700"
      >
        {carregando ? "Cancelando..." : "Cancelar agendamento"}
      </button>
      {erro && <p className="mt-1 text-xs text-red-600">{erro}</p>}
    </div>
  );
}
