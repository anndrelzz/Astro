"use client";

import { useState } from "react";
import { CheckCircle2, Mail } from "lucide-react";

// Dashboard do dono: enquanto o e-mail nao estiver confirmado, os avisos de
// novos agendamentos e cancelamentos nao chegam por e-mail, porque levam dados
// dos clientes (LGPD, a mesma regra do cliente). O aviso fica no topo ate ele
// confirmar, e reenvia o link pela mesma rota do Perfil (no maximo 3 por hora).
export function AvisoEmailDoDono({
  email,
  confirmado,
  status,
}: {
  email: string;
  confirmado: boolean;
  /** Resultado do link de confirmacao (?email=...). */
  status?: "confirmado" | "link-invalido";
}) {
  const [envio, setEnvio] = useState<{ ok: boolean; mensagem: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (confirmado && status === "confirmado") {
    return (
      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" aria-hidden />
        <p className="text-sm font-semibold text-white">
          E-mail confirmado! Os avisos de novos agendamentos vão chegar por lá.
        </p>
      </div>
    );
  }
  if (confirmado) return null;

  async function reenviar() {
    setEnviando(true);
    try {
      const resposta = await fetch("/api/perfil/reenviar-confirmacao", { method: "POST" });
      const json = await resposta.json().catch(() => null);
      setEnvio(
        resposta.ok
          ? { ok: true, mensagem: `Enviamos um novo link para ${email}.` }
          : { ok: false, mensagem: json?.error ?? "Não foi possível reenviar agora." }
      );
    } catch {
      setEnvio({ ok: false, mensagem: "Não foi possível reenviar agora." });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Mail className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden />
        <div>
          <p className="font-semibold text-white">Confirme seu e-mail para receber os avisos de agendamento</p>
          <p className="mt-0.5 text-sm text-astro-muted">
            {status === "link-invalido"
              ? "Esse link de confirmação expirou ou já foi usado. Peça um novo ao lado."
              : `Mandamos um link para ${email}. Até você confirmar, os avisos de novos agendamentos não chegam por e-mail.`}
          </p>
          {envio && (
            <p className={`mt-1 text-sm font-medium ${envio.ok ? "text-emerald-300" : "text-red-300"}`}>
              {envio.mensagem}
            </p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={reenviar}
        disabled={enviando}
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-astro-blue px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
      >
        {enviando ? "Enviando..." : "Reenviar e-mail de confirmação"}
      </button>
    </div>
  );
}
