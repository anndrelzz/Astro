// Fuso horario das esteticas. Toda data que vira "dia", "hora" ou "hoje" passa
// por aqui, e nao pelos metodos locais do Date (getHours, setHours, getDay...).
//
// Os metodos locais usam o fuso da MAQUINA que roda o codigo. No computador de
// desenvolvimento isso e Brasilia e tudo bate; num servidor na nuvem costuma
// ser UTC, e um agendamento escolhido para 10:00 era gravado como 10:00 UTC e
// exibido como 07:00. O mesmo vale para telas client: elas tambem sao
// renderizadas primeiro no servidor.
//
// Um fuso fixo atende o escopo atual (esteticas no fuso de Brasilia). Fuso por
// estetica, para Manaus ou Acre, seria trocar esta constante por um campo do
// tenant.
//
// Sem dependencia externa: so Intl, disponivel no Node e no navegador. Este
// arquivo e importado por componentes client, entao nao pode importar nada de
// servidor.
export const FUSO = "America/Sao_Paulo";

export type PartesData = {
  ano: number;
  /** 1 a 12 */
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  /** 0 = domingo ... 6 = sabado, mesma convencao do Date.getDay() e do banco */
  diaSemana: number;
};

const formatador = new Intl.DateTimeFormat("en-US", {
  timeZone: FUSO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  weekday: "short",
});

const DIAS_SEMANA = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Ano, mes, dia, hora e minuto que o relogio da estetica mostra no instante `d`. */
export function partesNoFuso(d: Date): PartesData {
  const p: Record<string, string> = {};
  for (const { type, value } of formatador.formatToParts(d)) p[type] = value;
  return {
    ano: Number(p.year),
    mes: Number(p.month),
    dia: Number(p.day),
    hora: Number(p.hour),
    minuto: Number(p.minute),
    diaSemana: DIAS_SEMANA.indexOf(p.weekday),
  };
}

/**
 * O instante em que o relogio da estetica marca ano/mes/dia hora:minuto.
 * Aceita valores fora da faixa (dia 0, mes 13) e normaliza como o Date.UTC,
 * o que serve para "ontem", "primeiro dia do mes passado" etc.
 */
export function instanteNoFuso(ano: number, mes: number, dia: number, hora = 0, minuto = 0): Date {
  const alvo = Date.UTC(ano, mes - 1, dia, hora, minuto);
  // Comeca supondo UTC e corrige pela diferenca observada. A segunda volta
  // cobre o caso de a correcao cruzar uma mudanca de horario de verao.
  let palpite = alvo;
  for (let i = 0; i < 2; i++) {
    const p = partesNoFuso(new Date(palpite));
    palpite += alvo - Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto);
  }
  return new Date(palpite);
}

/** Meia-noite (no fuso da estetica) do dia de `d`, deslocado em `dias`. */
export function inicioDoDia(d: Date, dias = 0): Date {
  const p = partesNoFuso(d);
  return instanteNoFuso(p.ano, p.mes, p.dia + dias);
}

/** Ultimo milissegundo (no fuso da estetica) do dia de `d`, deslocado em `dias`. */
export function fimDoDia(d: Date, dias = 0): Date {
  return new Date(inicioDoDia(d, dias + 1).getTime() - 1);
}

/** "AAAA-MM-DD" do dia de `d` no fuso da estetica. */
export function chaveDia(d: Date): string {
  const p = partesNoFuso(d);
  return `${p.ano}-${String(p.mes).padStart(2, "0")}-${String(p.dia).padStart(2, "0")}`;
}

/** "HH:MM" de `d` no fuso da estetica. */
export function horaMinuto(d: Date): string {
  const p = partesNoFuso(d);
  return `${String(p.hora).padStart(2, "0")}:${String(p.minuto).padStart(2, "0")}`;
}

/** Minutos desde a meia-noite de `d` no fuso da estetica (480 = 08:00). */
export function minutosNoFuso(d: Date): number {
  const p = partesNoFuso(d);
  return p.hora * 60 + p.minuto;
}
