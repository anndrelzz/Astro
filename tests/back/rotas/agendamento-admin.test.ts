import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { POST as agendarPeloAdmin } from "@/app/api/admin/agendamentos/route";
import { POST as cancelar } from "@/app/api/agendamentos/[id]/cancelar/route";
import { GET as consultarSlots } from "@/app/api/slots/route";
import { instanteNoFuso } from "@/compartilhado/fuso";
import { enviarEmail } from "@/back/notificacoes/email";
import { prisma } from "@/back/prisma";
import { calcularSlotsDisponiveis } from "@/back/slots";
import { withTenant } from "@/back/tenant-db";
import { comId, criarEstetica, diaDaqui, entrarComo, pedido, removerEstetica, type Estetica } from "./ajudantes";

// Agendamento feito pelo Admin (decisao do orientador, 30/10): o cliente chama
// no WhatsApp ou no Instagram, e o Admin agenda pelo cliente "coringa" da
// estetica, anotando o nome e o telefone de quem chamou.
//
// Regras combinadas com o Andre (04/11): pagamento sempre no local, preco
// automatico, sem notificacao nenhuma, pode fora da antecedencia minima e ate
// 60 dias a frente, mas nunca em horario lotado ou fora da grade.

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
const { tarefasDepois } = vi.hoisted(() => ({ tarefasDepois: [] as (() => unknown)[] }));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: (tarefa: () => unknown) => {
    tarefasDepois.push(tarefa);
  },
}));
async function depoisDaResposta() {
  for (const tarefa of tarefasDepois.splice(0)) await tarefa();
}
vi.mock("@/back/notificacoes/email", () => ({
  enviarEmail: vi.fn(async () => ({ enviado: true, modo: "log" })),
}));
vi.mock("@/back/notificacoes/telegram", () => ({
  enviarTelegram: vi.fn(async () => ({ enviado: true, modo: "log" })),
}));

let e: Estetica;

beforeAll(async () => {
  e = await criarEstetica("agenda-admin");
});

afterAll(async () => {
  await removerEstetica(e.tenant.slug);
  await prisma.$disconnect();
});

const corpo = (extra: Record<string, unknown> = {}) => ({
  servicoId: e.servico.id,
  segmentoId: e.segmento.id,
  modelo: "Civic",
  data: diaDaqui(3),
  hora: "10:00",
  contatoNome: "Joao do WhatsApp",
  contatoTelefone: "(47) 9 8888-7777",
  ...extra,
});

const agendar = (extra: Record<string, unknown> = {}) =>
  agendarPeloAdmin(pedido("POST", "/api/admin/agendamentos", corpo(extra)));

const buscar = (id: string) =>
  withTenant(e.tenant.id, (tx) =>
    tx.agendamento.findUnique({
      where: { id },
      include: { usuario: true, veiculo: true, notificacoes: true },
    })
  );

describe("POST /api/admin/agendamentos", () => {
  test("sem login responde 401, e cliente responde 403", async () => {
    entrarComo(null);
    expect((await agendar()).status).toBe(401);

    entrarComo(e.cliente);
    expect((await agendar()).status).toBe(403);
  });

  test("agenda pelo coringa, pagando no local, com o preco da tabela e o contato anotado", async () => {
    entrarComo(e.admin);
    const resposta = await agendar({ hora: "09:00" });
    expect(resposta.status).toBe(201);

    const ag = await buscar((await resposta.json()).id);
    expect(ag).toMatchObject({
      status: "PENDENTE_PAGAMENTO",
      formaPagamento: "LOCAL",
      contatoNome: "Joao do WhatsApp",
      contatoTelefone: "47988887777",
    });
    expect(Number(ag!.valor)).toBe(80);
    // A duracao do servico fica guardada, como o preco.
    expect(ag!.duracaoMin).toBe(60);
    expect(ag!.usuario.coringa).toBe(true);
    expect(ag!.usuario.role).toBe("CLIENTE");
    expect(ag!.veiculo).toMatchObject({ modelo: "Civic", segmentoId: e.segmento.id, usuarioId: ag!.usuarioId });
  });

  test("nao gera notificacao nenhuma: o coringa nao tem e-mail de verdade", async () => {
    entrarComo(e.admin);
    vi.mocked(enviarEmail).mockClear();
    const resposta = await agendar({ hora: "11:00" });
    await depoisDaResposta();

    const ag = await buscar((await resposta.json()).id);
    expect(ag!.notificacoes).toHaveLength(0);
    expect(enviarEmail).not.toHaveBeenCalled();
  });

  test("o cancelamento pelo Admin tambem nao notifica", async () => {
    entrarComo(e.admin);
    const { id } = await (await agendar({ hora: "12:00" })).json();

    expect((await cancelar(pedido("POST", `/api/agendamentos/${id}/cancelar`), comId(id))).status).toBe(200);
    await depoisDaResposta();

    expect((await buscar(id))!.notificacoes).toHaveLength(0);
  });

  test("a estetica tem um coringa so, criado na primeira vez", async () => {
    entrarComo(e.admin);
    const a = await (await agendar({ hora: "13:00" })).json();
    const b = await (await agendar({ hora: "14:00" })).json();

    expect((await buscar(a.id))!.usuarioId).toBe((await buscar(b.id))!.usuarioId);
    const coringas = await withTenant(e.tenant.id, (tx) =>
      tx.usuario.count({ where: { tenantId: e.tenant.id, coringa: true } })
    );
    expect(coringas).toBe(1);
  });

  test("placa ja usada pelo coringa reaproveita o carro", async () => {
    entrarComo(e.admin);
    const a = await (await agendar({ hora: "15:00", placa: "xyz-1a23", marca: "Honda" })).json();
    const b = await (await agendar({ hora: "16:00", placa: "XYZ1A23" })).json();

    const [agA, agB] = [await buscar(a.id), await buscar(b.id)];
    expect(agB!.veiculoId).toBe(agA!.veiculoId);
    expect(agA!.veiculo).toMatchObject({ placa: "XYZ1A23", marca: "Honda" });
  });

  test("so o tipo de veiculo e o modelo sao obrigatorios", async () => {
    entrarComo(e.admin);
    const resposta = await agendar({ hora: "17:00", data: diaDaqui(4) });
    expect(resposta.status).toBe(201);

    const ag = await buscar((await resposta.json()).id);
    expect(ag!.veiculo).toMatchObject({ placa: "", marca: "", cor: "" });
  });

  test("pode marcar alem dos 14 dias do cliente, ate 60", async () => {
    entrarComo(e.admin);
    expect((await agendar({ data: diaDaqui(30) })).status).toBe(201);

    const longe = await agendar({ data: diaDaqui(61) });
    expect(longe.status).toBe(400);
    expect(await longe.json()).toMatchObject({ campo: "data" });
  });

  test("horario lotado e recusado, como para o cliente", async () => {
    entrarComo(e.admin);
    expect((await agendar({ data: diaDaqui(5) })).status).toBe(201);

    const segundo = await agendar({ data: diaDaqui(5) });
    expect(segundo.status).toBe(409);
  });

  test("fora da grade de funcionamento e recusado", async () => {
    entrarComo(e.admin);
    expect((await agendar({ data: diaDaqui(6), hora: "19:00" })).status).toBe(409);
  });

  test.each([
    [{ modelo: "" }, "modelo"],
    [{ contatoNome: " " }, "contatoNome"],
    [{ contatoTelefone: "123" }, "contatoTelefone"],
    [{ segmentoId: "nao-e-uuid" }, "segmentoId"],
  ])("dado invalido %o aponta o campo", async (extra, campo) => {
    entrarComo(e.admin);
    const resposta = await agendar(extra);
    expect(resposta.status).toBe(400);
    expect(await resposta.json()).toMatchObject({ campo });
  });
});

describe("horarios livres para o Admin", () => {
  test("o Admin pode pegar um horario dentro da antecedencia minima", async () => {
    // Amanha as 09:55: para o cliente, as 10:00 ja nao da (faltam 5 min).
    const [ano, mes, dia] = diaDaqui(1).split("-").map(Number);
    const agora = instanteNoFuso(ano, mes, dia, 9, 55);
    const doDia = instanteNoFuso(ano, mes, dia);

    const [doCliente, doAdmin] = await withTenant(e.tenant.id, (tx) =>
      Promise.all([
        calcularSlotsDisponiveis(tx, e.tenant, e.servico, doDia, agora),
        calcularSlotsDisponiveis(tx, e.tenant, e.servico, doDia, agora, { antecedenciaMin: 0 }),
      ])
    );

    expect(doCliente).not.toContain("10:00");
    expect(doAdmin).toContain("10:00");
    // Horario que ja passou continua fora, ate para o Admin.
    expect(doAdmin).not.toContain("09:00");
  });

  const slots = (data: string, extra = "") =>
    consultarSlots(
      pedido("GET", `/api/slots?tenantId=${e.tenant.id}&servicoId=${e.servico.id}&data=${data}${extra}`)
    );

  test("GET /api/slots com paraAdmin vai ate 60 dias, so para o Admin", async () => {
    entrarComo(e.admin);
    expect((await slots(diaDaqui(30), "&paraAdmin=1")).status).toBe(200);
    expect((await slots(diaDaqui(30))).status).toBe(400);

    entrarComo(e.cliente);
    expect((await slots(diaDaqui(3), "&paraAdmin=1")).status).toBe(403);
  });
});
