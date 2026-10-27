// Fundo de todas as telas do Admin (vem do layout): uma grade de pontinhos sobre o
// preto, e faixas de luz em forma de onda que deslizam devagar por baixo dela.
// Os pontos so aparecem acesos onde a onda passa, entao o que se ve sao ondas
// feitas de pontos atravessando a tela. A luz e a cor da estetica
// (--color-astro-blue, RF13), entao muda junto com a Identidade visual.
//
// Como funciona: a camada de luz tem uma mascara de pontos (.pontos-luz), e
// so a luz se move (transform), que a placa de video resolve sem redesenhar a
// grade. Com "reduzir movimento" ligado no sistema, as ondas ficam paradas.
//
// Fica fixo na tela e atras de tudo: -z-10 dentro do layout do Admin, que tem
// `isolate` para que a camada negativa fique acima do fundo preto dele e
// abaixo da sidebar e do conteudo.

const LARGURA = 1440;
const ALTURA = 900;

// Faixa entre duas senoides que se repetem a cada `periodo`. O desenho tem
// duas larguras de tela; como o periodo divide a largura, deslocar metade do
// desenho cai no mesmo lugar e a animacao emenda sem salto.
function faixa(centro: number, amplitude: number, espessura: number, periodo: number, fase: number) {
  const y = (x: number, extra: number) =>
    centro + extra + amplitude * Math.sin((2 * Math.PI * x) / periodo + fase);
  const xs = Array.from({ length: (2 * LARGURA) / 30 + 1 }, (_, i) => i * 30);
  const topo = xs.map((x) => `${x},${y(x, 0).toFixed(1)}`);
  // A borda de baixo ondula um pouco defasada: a faixa engorda e afina.
  const base = xs
    .reverse()
    .map((x) => `${x},${(y(x, espessura) + 18 * Math.sin((2 * Math.PI * x) / periodo + fase + 1.2)).toFixed(1)}`);
  return `M${topo.join(" L")} L${base.join(" L")} Z`;
}

// Dois grupos que andam em sentidos e velocidades diferentes: quando as
// faixas se cruzam, os pontos acendem mais.
const PARA_ESQUERDA = [faixa(260, 80, 55, 1440, 0), faixa(690, 60, 45, 720, 2.1)];
const PARA_DIREITA = [faixa(480, 100, 40, 1440, 1.4)];

function Ondas({ caminhos, sentido }: { caminhos: string[]; sentido: "esquerda" | "direita" }) {
  return (
    <svg
      className={`absolute inset-y-0 left-0 h-full w-[200%] will-change-transform ${
        sentido === "esquerda" ? "animate-[ondas-esquerda_16s_linear_infinite]" : "animate-[ondas-direita_24s_linear_infinite]"
      } motion-reduce:animate-none`}
      viewBox={`0 0 ${2 * LARGURA} ${ALTURA}`}
      preserveAspectRatio="none"
    >
      <defs>
        <filter id={`desfoque-${sentido}`} x="-10%" y="-50%" width="120%" height="200%">
          <feGaussianBlur stdDeviation="22" />
        </filter>
      </defs>
      <g filter={`url(#desfoque-${sentido})`}>
        {caminhos.map((d) => (
          <path key={d} d={d} style={{ fill: "color-mix(in srgb, var(--color-astro-blue) 65%, white)" }} />
        ))}
      </g>
    </svg>
  );
}

export function FundoOndas() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Grade apagada: os pontos que a luz nao alcanca */}
      <div className="pontos-base absolute inset-0" />

      {/* Luz em ondas, vista so atraves dos pontos */}
      <div className="pontos-luz absolute inset-0 opacity-75">
        <Ondas caminhos={PARA_ESQUERDA} sentido="esquerda" />
        <Ondas caminhos={PARA_DIREITA} sentido="direita" />
      </div>
    </div>
  );
}
