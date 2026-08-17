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
    // Moldura cinza por fora, face da placa por dentro — as duas camadas sao o
    // que faz o objeto parecer parafusado, e nao um retangulo cinza.
    <div className="rounded-2xl bg-zinc-400/70 p-1.5 shadow-sm transition focus-within:bg-astro-blue/40">
      <div className="rounded-xl bg-zinc-300 px-4 pb-2.5 pt-2">
        <div className="flex items-center justify-center gap-2.5">
          {/* Os furos de parafuso da placa real. */}
          <span className="h-1 w-4 rounded-full bg-zinc-400" />
          <span className="text-[0.6rem] font-semibold tracking-[0.25em] text-astro-bg">
            {cabecalho}
          </span>
          <span className="h-1 w-4 rounded-full bg-zinc-400" />
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
          className="w-full bg-transparent text-center font-mono text-3xl font-bold uppercase tracking-[0.1em] text-astro-bg placeholder:font-normal placeholder:text-astro-bg/25 focus:outline-none"
        />
      </div>
    </div>
  );
}
