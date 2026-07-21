"use client";

import { useState } from "react";

export function VincularTelegram({ jaVinculado }: { jaVinculado: boolean }) {
  const [link, setLink] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function gerarLink() {
    setCarregando(true);
    const resposta = await fetch("/api/telegram/vincular", { method: "POST" });
    const json = await resposta.json();
    setLink(json.link);
    setCarregando(false);
  }

  if (jaVinculado) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Telegram vinculado. Voce recebe notificacoes por e-mail e Telegram.
      </p>
    );
  }

  return (
    <div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Vinculo opcional — sem ele, voce continua recebendo notificacoes por
        e-mail normalmente (RN12).
      </p>
      <button
        onClick={gerarLink}
        disabled={carregando}
        className="mt-2 rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-black"
      >
        Vincular Telegram
      </button>
      {link && (
        <p className="mt-2 text-sm">
          Abra este link no Telegram e toque em START:{" "}
          <a href={link} className="underline" target="_blank" rel="noreferrer">
            {link}
          </a>
        </p>
      )}
    </div>
  );
}
