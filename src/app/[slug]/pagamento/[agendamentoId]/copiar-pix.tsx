"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopiarPix({ codigo }: { codigo: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // clipboard indisponivel — ignora silenciosamente
    }
  }

  return (
    <div className="mt-2 flex items-center gap-2 rounded-xl border border-zinc-200 p-2">
      <code className="flex-1 truncate px-2 text-xs text-zinc-500">{codigo}</code>
      <button
        onClick={copiar}
        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-astro-blue px-3 py-2 text-xs font-semibold text-white"
      >
        {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copiado ? "Copiado" : "Copiar"}
      </button>
    </div>
  );
}
