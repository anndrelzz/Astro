"use client";

import { Barlow_Condensed } from "next/font/google";

// Letra alta e estreita, parecida com a FE-Schrift das placas Mercosul (a
// fonte oficial nao e livre).
const letraPlaca = Barlow_Condensed({ subsets: ["latin"], weight: "600" });

// Campo de placa no visual da placa Mercosul (UC02, tela 08): borda preta
// grossa, faixa azul com "BRASIL" e a bandeira, e a placa em letras pretas.
export function InputPlaca({
  valor,
  aoMudar,
}: {
  valor: string;
  aoMudar: (valor: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border-[5px] border-zinc-900 bg-white shadow-sm transition focus-within:ring-4 focus-within:ring-astro-blue/30">
      <div className="relative flex h-8 items-center justify-center bg-[#1C3FAA]">
        <span
          className={`${letraPlaca.className} text-xl leading-none tracking-[0.12em] text-white`}
        >
          BRASIL
        </span>
        <BandeiraBrasil className="absolute right-2 h-5 w-7 ring-1 ring-white" />
      </div>

      <input
        value={valor}
        onChange={(e) => aoMudar(e.target.value.toUpperCase())}
        // Cabe o padrao antigo (ABC-1234) e o Mercosul (ABC1D23); o limite
        // existe para o texto nao estourar a largura da placa.
        maxLength={8}
        placeholder="ABC1D23"
        required
        aria-label="Placa do veículo"
        data-placa
        className={`${letraPlaca.className} block h-[4.5rem] w-full bg-transparent px-4 text-center text-[3.4rem] uppercase leading-none tracking-[0.06em] text-zinc-900 placeholder:text-zinc-900/20 focus:outline-none`}
      />
    </div>
  );
}

// Bandeira simplificada (retangulo verde, losango amarelo, circulo azul):
// no tamanho da faixa, mais detalhe nao aparece.
function BandeiraBrasil({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 14"
      preserveAspectRatio="none"
      className={className}
    >
      <rect width="20" height="14" fill="#009C3B" />
      <path d="M10 1.5 18 7l-8 5.5L2 7z" fill="#FFDF00" />
      <circle cx="10" cy="7" r="3.2" fill="#002776" />
    </svg>
  );
}
