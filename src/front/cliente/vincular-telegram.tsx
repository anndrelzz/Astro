"use client";

import { useState } from "react";
import { Check, ChevronRight, Send } from "lucide-react";

// UC15, RN12 — vinculo opcional do Telegram, como linha das "Acoes rapidas"
// do perfil (tela 04 do mockup). O vinculo e feito fora daqui: a rota gera um
// token de uso unico e o cliente toca em START no proprio Telegram.
export function VincularTelegram({ jaVinculado }: { jaVinculado: boolean }) {
  const [link, setLink] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function gerarLink() {
    setErro(null);
    setCarregando(true);

    const resposta = await fetch("/api/telegram/vincular", { method: "POST" });
    setCarregando(false);

    if (!resposta.ok) {
      setErro("Não foi possível gerar o link. Tente de novo.");
      return;
    }
    const json = await resposta.json();
    setLink(json.link);
  }

  if (jaVinculado) {
    return (
      <div className="flex items-center gap-3 px-4 py-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <Check className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="font-medium text-zinc-900">Telegram vinculado</p>
          <p className="text-xs text-zinc-500">
            Você recebe as notificações por e-mail e Telegram.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      <button
        type="button"
        onClick={gerarLink}
        disabled={carregando}
        className="flex w-full items-center gap-3 text-left disabled:opacity-50"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-astro-blue/10 text-astro-blue">
          <Send className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-zinc-900">Vincular Telegram</p>
          <p className="text-xs text-zinc-500">
            {carregando
              ? "Gerando o link..."
              : "Receba notificações de agendamento pelo Telegram"}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-zinc-300" />
      </button>

      {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}

      {/* O link so aparece depois de gerado: ele carrega um token de uso unico,
          entao nao faz sentido existir na tela antes de o cliente pedir. */}
      {link && (
        <div className="mt-3 rounded-xl bg-astro-blue/5 px-4 py-3">
          <p className="text-sm text-zinc-600">
            Abra o link no Telegram e toque em <strong>START</strong>. Ele vale
            para esta vinculação apenas.
          </p>
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-astro-blue px-4 py-2 text-xs font-semibold text-white"
          >
            <Send className="h-3.5 w-3.5" />
            Abrir no Telegram
          </a>
        </div>
      )}
    </div>
  );
}
