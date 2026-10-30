"use client";

import { useRef, useState } from "react";
import { Copy, Check } from "lucide-react";

// Copia o codigo PIX e mostra que copiou: o botao fica verde e da um pulo, o
// icone vira um "check", a caixa do codigo acende em verde e aparece uma
// linha dizendo o proximo passo. Tudo volta ao normal depois de 2,5 s.
export function CopiarPix({ codigo }: { codigo: string }) {
  // `vez` muda a cada toque, para a animacao rodar de novo mesmo se a pessoa
  // tocar duas vezes seguidas.
  const [vez, setVez] = useState(0);
  const copiado = vez > 0;
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  async function copiar() {
    if (!(await escreverNaAreaDeTransferencia(codigo))) return;
    navigator.vibrate?.(30);
    setVez((v) => v + 1);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setVez(0), 2500);
  }

  return (
    <div className="mt-2">
      <div
        className={`flex items-center gap-2 rounded-xl border p-2 transition-colors duration-300 ${
          copiado ? "border-emerald-300 bg-emerald-50" : "border-zinc-200"
        }`}
      >
        <code
          className={`flex-1 truncate px-2 text-xs transition-colors duration-300 ${
            copiado ? "text-emerald-700" : "text-zinc-500"
          }`}
        >
          {codigo}
        </code>
        <button
          key={vez}
          onClick={copiar}
          className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white transition-colors duration-200 motion-reduce:animate-none ${
            copiado ? "animate-[copiado-pulo_400ms_ease-out] bg-emerald-500" : "bg-astro-blue"
          }`}
        >
          {copiado ? (
            <Check className="h-3.5 w-3.5 animate-[copiado-check_300ms_ease-out] motion-reduce:animate-none" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copiado ? "Copiado!" : "Copiar"}
        </button>
      </div>

      {/* Aviso falado tambem para leitor de tela (aria-live). */}
      <p aria-live="polite" className="mt-2 min-h-5 text-center text-xs font-medium text-emerald-600">
        {copiado && (
          <span key={vez} className="inline-block animate-[surgir_250ms_ease-out] motion-reduce:animate-none">
            Código copiado! Agora é só colar no app do seu banco.
          </span>
        )}
      </p>
    </div>
  );
}

// navigator.clipboard so existe em pagina segura (https ou localhost). Aberta
// pelo IP da rede, como no teste pelo celular, ela nao existe; o caminho antigo
// (selecionar um campo escondido e mandar "copiar") ainda funciona ali.
async function escreverNaAreaDeTransferencia(texto: string) {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    // cai para o caminho antigo
  }
  const campo = document.createElement("textarea");
  campo.value = texto;
  campo.setAttribute("readonly", "");
  campo.style.position = "fixed";
  campo.style.opacity = "0";
  document.body.appendChild(campo);
  campo.select();
  campo.setSelectionRange(0, texto.length);
  const ok = document.execCommand("copy");
  campo.remove();
  return ok;
}
