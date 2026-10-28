"use client";

// Campo de placa desenhado como uma placa de verdade (UC02, tela 08).
//
// A faixa de cima traz estado e cidade da ESTETICA, vindos do cadastro do
// tenant — e enfeite, nao dado do carro: o cliente pode ter emplacado em outra
// cidade. Ela existe para o campo ser reconhecivel de imediato, nao para
// afirmar a origem do veiculo.
//
// Sem cidade/estado cadastrados a faixa cai para "BRASIL", que e o que aparece
// nas placas do padrao Mercosul — assim a placa nunca fica com a faixa vazia.
export function InputPlaca({
  valor,
  aoMudar,
  cidade,
  estado,
}: {
  valor: string;
  aoMudar: (valor: string) => void;
  cidade?: string | null;
  estado?: string | null;
}) {
  const cabecalho =
    [estado, cidade].filter(Boolean).join(" - ").toUpperCase() || "BRASIL";

  return (
    // Cores do padrao Mercosul: face branca com borda preta, faixa azul no
    // topo com texto branco e a bandeira do Brasil a direita.
    <div className="overflow-hidden rounded-xl border-2 border-zinc-900 bg-white shadow-sm transition focus-within:ring-4 focus-within:ring-astro-blue/30">
      <div className="relative flex items-center justify-center bg-[#003399] px-3 py-1">
        <span className="text-[0.6rem] font-semibold tracking-[0.25em] text-white">
          {cabecalho}
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
