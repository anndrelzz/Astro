"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Botao "Ja fiz o pagamento" da tela do PIX: avisa o servidor (o Admin passa a
// ver "Cliente diz que pagou as 14:32" no painel) e leva para a confirmacao.
// Se o aviso falhar, o cliente segue do mesmo jeito: o pagamento ja foi feito
// no banco, e o Admin confere por la.
export function JaFizOPagamento({ slug, agendamentoId }: { slug: string; agendamentoId: string }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);

  async function avisar() {
    setEnviando(true);
    try {
      await fetch(`/api/agendamentos/${agendamentoId}/pagamento-informado`, { method: "POST" });
    } catch {
      // Sem rede: segue para a confirmacao mesmo assim.
    }
    router.push(`/${slug}/confirmado/${agendamentoId}`);
  }

  return (
    <button
      type="button"
      onClick={avisar}
      disabled={enviando}
      className="mt-4 flex w-full items-center justify-center rounded-xl bg-astro-blue py-3.5 text-sm font-semibold text-white shadow-lg shadow-astro-blue/25 disabled:opacity-70"
    >
      {enviando ? "Enviando..." : "Já fiz o pagamento"}
    </button>
  );
}
