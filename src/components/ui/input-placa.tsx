"use client";

import { Barlow_Condensed } from "next/font/google";

// Letra alta e estreita, parecida com a FE-Schrift das placas Mercosul (a
// fonte oficial nao e livre).
const letraPlaca = Barlow_Condensed({ subsets: ["latin"], weight: "600" });

// Campo de placa desenhado como uma placa Mercosul de verdade (UC02, tela 08):
// borda preta grossa, faixa azul com o emblema do Mercosul, "BRASIL" e a
// bandeira, e na face branca o QR code e o "BR" nos cantos.
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
        <EmblemaMercosul className="absolute left-2 h-6" />
        <span
          className={`${letraPlaca.className} text-xl leading-none tracking-[0.12em] text-white`}
        >
          BRASIL
        </span>
        <BandeiraBrasil className="absolute right-2 h-5 w-7 ring-1 ring-white" />
      </div>

      <div className="relative">
        {/* QR code e sigla do pais, como na placa real. */}
        <QrCode className="absolute left-1.5 top-1.5 h-5 w-5" />
        <span
          aria-hidden
          className={`${letraPlaca.className} absolute bottom-1 left-1.5 text-sm leading-none text-zinc-900`}
        >
          BR
        </span>

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
          className={`${letraPlaca.className} block h-[4.5rem] w-full bg-transparent px-8 text-center text-[3.4rem] uppercase leading-none tracking-[0.06em] text-zinc-900 placeholder:text-zinc-900/20 focus:outline-none`}
        />
      </div>
    </div>
  );
}

// Bandeira simplificada (retangulo verde, losango amarelo, circulo azul):
// no tamanho da faixa, mais detalhe nao aparece.
function BandeiraBrasil({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 20 14" preserveAspectRatio="none" className={className}>
      <rect width="20" height="14" fill="#009C3B" />
      <path d="M10 1.5 18 7l-8 5.5L2 7z" fill="#FFDF00" />
      <circle cx="10" cy="7" r="3.2" fill="#002776" />
    </svg>
  );
}

// Emblema do Mercosul: o Cruzeiro do Sul, um arco e o nome.
function EmblemaMercosul({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 40 24" className={className} fill="white">
      <circle cx="17" cy="3" r="1" />
      <circle cx="22" cy="5" r="1.1" />
      <circle cx="14" cy="7" r="0.8" />
      <circle cx="19" cy="9" r="1" />
      <path d="M6 15c8-3 20-3 28 0-8-1.6-20-1.6-28 0z" />
      <text x="20" y="22.5" textAnchor="middle" fontSize="6" fontFamily="sans-serif" fontWeight="600">
        MERCOSUL
      </text>
    </svg>
  );
}

// QR code de enfeite, so o desenho: tres quadrados de canto e alguns pontos.
function QrCode({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 21 21" className={className} fill="#a1a1aa">
      <path d="M0 0h7v7H0zM2 2v3h3V2zM14 0h7v7h-7zm2 2v3h3V2zM0 14h7v7H0zm2 2v3h3v-3z" fillRule="evenodd" />
      <path d="M9 0h2v2H9zM9 4h3v3H9zM13 9h2v2h-2zM9 9h2v3H9zM17 9h4v2h-4zM0 9h3v2H0zM5 9h2v2H5zM9 14h2v2H9zM12 13h2v4h-2zM16 13h2v2h-2zM19 15h2v3h-2zM15 18h3v3h-3zM9 18h3v3H9z" />
    </svg>
  );
}
