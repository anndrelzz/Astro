import "server-only";
import { Prisma, type Servico, type Tenant } from "@/generated/prisma/client";
import { chaveDia, fimDoDia, inicioDoDia, minutosNoFuso, partesNoFuso } from "@/compartilhado/fuso";

// Quanto tempo antes do inicio um horario ainda pode ser reservado: da tempo
// de o cliente chegar e de a estetica se preparar.
export const ANTECEDENCIA_MINIMA_MIN = 30;

// RF02, RN06, RNF02 — calcula os slots de horario disponiveis para um dia,
// respeitando a grade de funcionamento, o intervalo configurado e a
// capacidade simultanea do tenant. Recebe o client de transacao ja
// contextualizado por withTenant (RLS) — nunca importa o `prisma` global.
//
// `data` e qualquer instante do dia consultado. Dia da semana, limites do dia
// e horario de cada agendamento sao lidos no fuso da estetica (compartilhado/fuso.ts),
// nao no fuso do servidor.
//
// Horario que ja passou, ou que comeca em menos de ANTECEDENCIA_MINIMA_MIN, nao
// entra na lista. Como a confirmacao (POST /api/agendamentos) reconfere a vaga
// por esta mesma funcao, ela tambem recusa esses horarios. `agora` so existe
// para os testes fixarem o relogio.
//
// `antecedenciaMin` troca o minimo de antecedencia: o Admin agenda pelo
// coringa ate em cima da hora (decisao de 04/11), com 0. Horario que ja
// passou continua fora para todo mundo.
export async function calcularSlotsDisponiveis(
  tx: Prisma.TransactionClient,
  tenant: Tenant,
  servico: Servico,
  data: Date,
  agora: Date = new Date(),
  { antecedenciaMin = ANTECEDENCIA_MINIMA_MIN }: { antecedenciaMin?: number } = {}
) {
  const { diaSemana } = partesNoFuso(data);

  const horario = await tx.horarioFuncionamento.findUnique({
    where: { tenantId_diaSemana: { tenantId: tenant.id, diaSemana } },
  });
  if (!horario) return [];

  const inicioDia = inicioDoDia(data);
  const fimDia = fimDoDia(data);
  const primeiroInicioPermitido = agora.getTime() + antecedenciaMin * 60_000;

  const agendamentosDoDia = await tx.agendamento.findMany({
    where: {
      tenantId: tenant.id,
      dataHora: { gte: inicioDia, lte: fimDia },
      status: { not: "CANCELADO" },
    },
    include: { servico: true },
  });

  const intervalos = agendamentosDoDia.map((agendamento) => {
    const inicio = minutosNoFuso(agendamento.dataHora);
    return { inicio, fim: inicio + agendamento.servico.duracaoMin };
  });

  const slots: string[] = [];

  for (
    let inicioMin = horario.horaInicioMin;
    inicioMin + servico.duracaoMin <= horario.horaFimMin;
    inicioMin += tenant.intervaloMinutos
  ) {
    const fimMin = inicioMin + servico.duracaoMin;

    // Brasilia nao tem horario de verao desde 2019: o dia tem sempre 24h e o
    // minuto N do dia e meia-noite + N minutos.
    if (inicioDia.getTime() + inicioMin * 60_000 < primeiroInicioPermitido) {
      continue;
    }

    if (picoDeCarros(intervalos, inicioMin, fimMin) < tenant.capacidadeSimultanea) {
      const horas = String(Math.floor(inicioMin / 60)).padStart(2, "0");
      const minutos = String(inicioMin % 60).padStart(2, "0");
      slots.push(`${horas}:${minutos}`);
    }
  }

  return slots;
}

type Intervalo = { inicio: number; fim: number };

// Issue #117 — a capacidade e de carros AO MESMO TEMPO. Dois agendamentos que
// encostam no horario, mas um depois do outro, nunca somam dois carros.
//
// Devolve o maior numero de carros juntos em algum momento de [inicioMin, fimMin).
// A lotacao so sobe quando um carro chega, entao basta olhar o inicio do horario
// e o inicio de cada agendamento que cai dentro dele.
function picoDeCarros(intervalos: Intervalo[], inicioMin: number, fimMin: number): number {
  const momentos = [inicioMin];
  for (const { inicio } of intervalos) {
    if (inicio > inicioMin && inicio < fimMin) momentos.push(inicio);
  }

  let pico = 0;
  for (const momento of momentos) {
    const juntos = intervalos.filter(({ inicio, fim }) => inicio <= momento && fim > momento).length;
    pico = Math.max(pico, juntos);
  }
  return pico;
}

// RN06 — sem esta trava, duas confirmacoes para o mesmo dia podem ler a mesma
// vaga livre e gravar as duas: o agendamento de uma so fica visivel para a
// outra no commit.
//
// A trava coloca em fila as confirmacoes da mesma estetica no mesmo dia (o
// mesmo recorte que calcularSlotsDisponiveis consulta); dias diferentes nao
// esperam um pelo outro. E de transacao: o Postgres a solta sozinho no commit
// ou no rollback. Chamar ANTES de calcularSlotsDisponiveis, dentro do mesmo
// withTenant. Uma colisao do hashtext so faz duas filas virarem uma — nunca
// libera um horario lotado.
//
// A espera na fila tem limite (lock_timeout): se a confirmacao da frente
// travar, as de tras desistem com FilaDeAgendamentoOcupada em vez de ficarem
// penduradas ate o timeout de 5 s da transacao do Prisma. O limite vale so
// para pegar a trava; depois volta ao padrao do banco.
export const ESPERA_MAXIMA_FILA_MS = 3000;

export class FilaDeAgendamentoOcupada extends Error {
  constructor() {
    super("Fila de confirmacoes do dia ocupada alem do limite");
    this.name = "FilaDeAgendamentoOcupada";
  }
}

export async function travarDiaParaAgendamento(
  tx: Prisma.TransactionClient,
  tenantId: string,
  data: Date,
  esperaMaximaMs: number = ESPERA_MAXIMA_FILA_MS
) {
  const chave = `agendamento:${tenantId}:${chaveDia(data)}`;
  await tx.$executeRaw`SELECT set_config('lock_timeout', ${`${esperaMaximaMs}ms`}, true)`;
  try {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${chave}::text))`;
  } catch (erro) {
    if (estourouEsperaDaTrava(erro)) throw new FilaDeAgendamentoOcupada();
    throw erro;
  }
  await tx.$executeRaw`SET LOCAL lock_timeout TO DEFAULT`;
}

// 55P03 (lock_not_available) e o codigo do Postgres para o lock_timeout. Com o
// adapter pg, o Prisma devolve o codigo original dentro de meta.
function estourouEsperaDaTrava(erro: unknown): boolean {
  if (!(erro instanceof Prisma.PrismaClientKnownRequestError)) return false;
  const causa = (erro.meta?.driverAdapterError as { cause?: { originalCode?: string } } | undefined)?.cause;
  return causa?.originalCode === "55P03";
}
