"use client";

// Campo de placa desenhado como uma placa de verdade (UC02, tela 08), no
// padrao Mercosul: a faixa azul diz "BRASIL", como nas placas reais.
export function InputPlaca({
  valor,
  aoMudar,
}: {
  valor: string;
  aoMudar: (valor: string) => void;
}) {
  return (
    // Cores do padrao Mercosul: face branca com borda preta, faixa azul no
    // topo com texto branco e a bandeira do Brasil a direita.
    <div className="overflow-hidden rounded-xl border-2 border-zinc-900 bg-white shadow-sm transition focus-within:ring-4 focus-within:ring-astro-blue/30">
      <div className="relative flex items-center justify-center bg-[#003399] px-3 py-1">
        <span className="text-[0.6rem] font-semibold tracking-[0.25em] text-white">
          BRASIL
        </span>
        <BandeiraBrasil className="absolute right-2.5 h-2.5 w-3.5" />
      </div>

      <input
        value={valor}
        onChange={(e) => aoMudar(e.target.value.toUpperCase())}
        // Cabe o padrao antigo (ABC-1234) e o Mercosul (ABC1D23); o limite
        // existe para o texto nao estourar a largura da placa.
        maxLength={8}
        placeholder="ABC-1234"
        required
        aria-label="Placa do veículo"
        className="w-full bg-transparent px-4 pb-2.5 pt-2 text-center font-mono text-3xl font-bold uppercase tracking-[0.1em] text-zinc-900 placeholder:font-normal placeholder:text-zinc-900/25 focus:outline-none"
      />
    </div>
  );
}

// Bandeira simplificada (retangulo verde, losango amarelo, circulo azul):
// no tamanho da faixa, mais detalhe nao aparece.
function BandeiraBrasil({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 20 14" className={className}>
      <rect width="20" height="14" fill="#009C3B" />
      <path d="M10 1.5 18 7l-8 5.5L2 7z" fill="#FFDF00" />
      <circle cx="10" cy="7" r="3.2" fill="#002776" />
    </svg>
  );
}
