"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function hojeISO() {
  const hoje = new Date();
  const offset = hoje.getTimezoneOffset();
  return new Date(hoje.getTime() - offset * 60000).toISOString().slice(0, 10);
}

export function AgendamentoForm({
  slug,
  tenantId,
  servicoId,
  veiculoId,
  pixDisponivel,
}: {
  slug: string;
  tenantId: string;
  servicoId: string;
  veiculoId: string;
  pixDisponivel: boolean;
}) {
  const router = useRouter();

  const [data, setData] = useState(hojeISO());
  const [slots, setSlots] = useState<string[]>([]);
  const [carregandoSlots, setCarregandoSlots] = useState(false);
  const [horaSelecionada, setHoraSelecionada] = useState<string | null>(null);
  const [formaPagamento, setFormaPagamento] = useState<"PIX" | "LOCAL">(
    pixDisponivel ? "PIX" : "LOCAL"
  );
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{
    id: string;
    status: string;
    pixChaveCopiaCola: string | null;
  } | null>(null);

  useEffect(() => {
    setHoraSelecionada(null);
    setCarregandoSlots(true);
    fetch(`/api/slots?tenantId=${tenantId}&servicoId=${servicoId}&data=${data}`)
      .then((r) => r.json())
      .then((json) => setSlots(json.slots ?? []))
      .finally(() => setCarregandoSlots(false));
  }, [data, tenantId, servicoId]);

  async function confirmar() {
    if (!horaSelecionada) return;
    setConfirmando(true);
    setErro(null);

    const resposta = await fetch("/api/agendamentos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        servicoId,
        veiculoId,
        data,
        hora: horaSelecionada,
        formaPagamento,
      }),
    });

    setConfirmando(false);

    if (!resposta.ok) {
      const json = await resposta.json().catch(() => null);
      setErro(json?.error ?? "Nao foi possivel confirmar o agendamento.");
      return;
    }

    setResultado(await resposta.json());
  }

  // RN05, UC04 — horario ja bloqueado; tela de pagamento (PIX ou local).
  if (resultado) {
    return (
      <div className="mt-6 max-w-md rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Agendamento confirmado!
        </h2>
        {resultado.status === "PIX_PENDENTE" ? (
          <>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Pague via PIX Copia e Cola e aguarde a confirmacao do Admin:
            </p>
            <code className="mt-2 block break-all rounded bg-zinc-100 p-3 text-xs dark:bg-zinc-900">
              {resultado.pixChaveCopiaCola}
            </code>
            <p className="mt-2 text-sm text-zinc-500">Status: PIX pendente</p>
          </>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">
            Pagamento no local. Status: pendente pagamento.
          </p>
        )}
        <button
          onClick={() => router.push(`/${slug}`)}
          className="mt-4 rounded bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-50 dark:text-black"
        >
          Voltar para a estetica
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 max-w-md space-y-4">
      <div>
        <label className="block text-sm text-zinc-600 dark:text-zinc-400">
          Data
        </label>
        <input
          type="date"
          value={data}
          min={hojeISO()}
          onChange={(e) => setData(e.target.value)}
          className="mt-1 rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Horarios disponiveis
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {carregandoSlots && (
            <span className="text-sm text-zinc-500">Carregando...</span>
          )}
          {!carregandoSlots && slots.length === 0 && (
            <span className="text-sm text-zinc-500">
              Nenhum horario disponivel nesse dia.
            </span>
          )}
          {slots.map((slot) => (
            <button
              key={slot}
              onClick={() => setHoraSelecionada(slot)}
              className={`rounded border px-3 py-1 text-sm ${
                horaSelecionada === slot
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-black"
                  : "border-zinc-300 dark:border-zinc-700"
              }`}
            >
              {slot}
            </button>
          ))}
        </div>
      </div>

      {horaSelecionada && (
        <div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Pagamento</p>
          <div className="mt-2 flex gap-2">
            {pixDisponivel && (
              <button
                onClick={() => setFormaPagamento("PIX")}
                className={`rounded border px-3 py-1 text-sm ${
                  formaPagamento === "PIX"
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-black"
                    : "border-zinc-300 dark:border-zinc-700"
                }`}
              >
                PIX
              </button>
            )}
            <button
              onClick={() => setFormaPagamento("LOCAL")}
              className={`rounded border px-3 py-1 text-sm ${
                formaPagamento === "LOCAL"
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-black"
                  : "border-zinc-300 dark:border-zinc-700"
              }`}
            >
              Pagar no local
            </button>
          </div>
        </div>
      )}

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <button
        onClick={confirmar}
        disabled={!horaSelecionada || confirmando}
        className="w-full rounded bg-zinc-900 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-black"
      >
        {confirmando ? "Confirmando..." : "Confirmar agendamento"}
      </button>
    </div>
  );
}
