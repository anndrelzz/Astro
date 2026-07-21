"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Diamond, Wallet, Check } from "lucide-react";
import Link from "next/link";

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MESES_ABR = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

function horaFim(hora: string, duracaoMin: number) {
  const [h, m] = hora.split(":").map(Number);
  const total = h * 60 + m + duracaoMin;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// Tela 10 — forma de pagamento. Cria o agendamento e roteia para PIX (tela
// 11) ou confirmacao (tela 12) conforme a escolha.
export function PagamentoForm({
  slug,
  servicoId,
  veiculoId,
  data,
  hora,
  servico,
  segmento,
  preco,
  pixDisponivel,
}: {
  slug: string;
  servicoId: string;
  veiculoId: string;
  data: string;
  hora: string;
  servico: { nome: string; duracaoMin: number };
  segmento: string;
  preco: number;
  pixDisponivel: boolean;
}) {
  const router = useRouter();
  const [forma, setForma] = useState<"PIX" | "LOCAL">(
    pixDisponivel ? "PIX" : "LOCAL"
  );
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const d = new Date(data + "T00:00:00");
  const dataFmt = `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES_ABR[d.getMonth()]}`;
  const precoFmt = preco.toFixed(2).replace(".", ",");

  async function confirmar() {
    setErro(null);
    setEnviando(true);

    const resposta = await fetch("/api/agendamentos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ servicoId, veiculoId, data, hora, formaPagamento: forma }),
    });

    if (!resposta.ok) {
      const json = await resposta.json().catch(() => null);
      setErro(json?.error ?? "Não foi possível concluir o agendamento.");
      setEnviando(false);
      return;
    }

    const json = await resposta.json();
    if (json.status === "PIX_PENDENTE") {
      router.push(`/${slug}/pagamento/${json.id}`);
    } else {
      router.push(`/${slug}/confirmado/${json.id}`);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Cabecalho escuro com total */}
      <div className="astro-dark px-5 pb-12 pt-6">
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-between">
            <Link
              href={`/${slug}/agendar/${servicoId}`}
              aria-label="Voltar"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/80"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="font-semibold text-white">Pagamento</h1>
            <span className="h-11 w-11" />
          </div>
          <div className="mt-6 text-center">
            <p className="astro-label">Total a pagar</p>
            <p className="text-4xl font-bold text-white">R$ {precoFmt}</p>
          </div>
        </div>
      </div>

      {/* Sheet claro */}
      <div className="mx-auto -mt-4 max-w-md rounded-t-3xl bg-white px-5 pb-32 pt-6">
        {/* Resumo */}
        <div className="flex items-center gap-3 rounded-2xl border border-zinc-100 bg-white p-3 shadow-sm">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-astro-surface-2 to-astro-bg" />
          <div className="flex-1">
            <p className="font-semibold text-zinc-900">{servico.nome}</p>
            <p className="text-xs text-zinc-500">
              {dataFmt} · {hora}–{horaFim(hora, servico.duracaoMin)}
            </p>
          </div>
          <span className="rounded-md bg-zinc-100 px-2 py-1 text-[0.65rem] font-semibold text-zinc-500">
            {segmento}
          </span>
        </div>

        <p className="mt-6 astro-label">Forma de pagamento</p>
        <h2 className="mt-1 text-xl font-bold text-zinc-900">Como prefere pagar?</h2>

        {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}

        <div className="mt-4 space-y-3">
          {pixDisponivel && (
            <button
              onClick={() => setForma("PIX")}
              className={
                forma === "PIX"
                  ? "flex w-full items-center gap-3 rounded-2xl border-2 border-astro-blue bg-astro-blue/5 p-4 text-left"
                  : "flex w-full items-center gap-3 rounded-2xl border border-zinc-200 p-4 text-left"
              }
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-astro-blue text-white">
                <Diamond className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <p className="flex items-center gap-2 font-semibold text-zinc-900">
                  Pagar com PIX
                  <span className="rounded-full bg-astro-blue/10 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-astro-blue">
                    Instantâneo
                  </span>
                </p>
                <p className="text-xs text-zinc-500">
                  Copia e cola. Garante seu horário.
                </p>
              </div>
              {forma === "PIX" && (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-astro-blue text-white">
                  <Check className="h-4 w-4" />
                </span>
              )}
            </button>
          )}

          <button
            onClick={() => setForma("LOCAL")}
            className={
              forma === "LOCAL"
                ? "flex w-full items-center gap-3 rounded-2xl border-2 border-astro-blue bg-astro-blue/5 p-4 text-left"
                : "flex w-full items-center gap-3 rounded-2xl border border-zinc-200 p-4 text-left"
            }
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
              <Wallet className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <p className="font-semibold text-zinc-900">Pagar no local</p>
              <p className="text-xs text-zinc-500">
                Dinheiro ou cartão na hora do serviço.
              </p>
            </div>
            {forma === "LOCAL" && (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-astro-blue text-white">
                <Check className="h-4 w-4" />
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Botao fixo */}
      <div className="fixed inset-x-0 bottom-0 border-t border-zinc-100 bg-white/95 px-5 py-4 backdrop-blur">
        <div className="mx-auto max-w-md">
          <button
            onClick={confirmar}
            disabled={enviando}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-astro-blue py-3.5 text-sm font-semibold text-white shadow-lg shadow-astro-blue/25 disabled:opacity-50"
          >
            {enviando ? "Processando..." : forma === "PIX" ? "Gerar PIX" : "Confirmar agendamento"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
