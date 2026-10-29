import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { POST as criarSegmento } from "@/app/api/segmentos/route";
import { DELETE as removerSegmento, PATCH as editarSegmento } from "@/app/api/segmentos/[id]/route";
import { POST as criarServico } from "@/app/api/servicos/route";
import { DELETE as removerServico, PATCH as editarServico } from "@/app/api/servicos/[id]/route";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant-db";
import { comId, criarEstetica, daqui, entrarComo, pedido, removerEstetica, type Estetica } from "./ajudantes";

// UC08, RF01, RN01 — catalogo do Admin: servicos com preco por tipo de
// veiculo, e os tipos de veiculo que a estetica atende.

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));

let e: Estetica;

beforeAll(async () => {
  e = await criarEstetica("catalogo");
});

afterAll(async () => {
  await removerEstetica(e.tenant.slug);
  await prisma.$disconnect();
});

const banco = <T>(fn: Parameters<typeof withTenant<T>>[1]) => withTenant(e.tenant.id, fn);

const precosDe = (servicoId: string) =>
  banco((tx) => tx.precoServico.findMany({ where: { servicoId }, orderBy: { valor: "asc" } }));

describe("POST /api/servicos", () => {
  const servico = (extra: Record<string, unknown> = {}) => ({
    nome: "Higienizacao",
    duracaoMin: 90,
    precos: [{ segmentoId: e.segmento.id, valor: 150 }],
    ...extra,
  });

  test("so o Admin cria servico", async () => {
    entrarComo(e.cliente);
    expect((await criarServico(pedido("POST", "/api/servicos", servico()))).status).toBe(403);
  });

  test("dados invalidos respondem 400 com a mensagem do campo", async () => {
    entrarComo(e.admin);
    expect((await criarServico(pedido("POST", "/api/servicos", "x"))).status).toBe(400);
    const resposta = await criarServico(pedido("POST", "/api/servicos", servico({ duracaoMin: 2 })));
    expect(await resposta.json()).toEqual({ error: "Duracao minima de 5 minutos" });
  });

  test("cria o servico com um preco por tipo de veiculo", async () => {
    entrarComo(e.admin);
    const resposta = await criarServico(pedido("POST", "/api/servicos", servico()));
    expect(resposta.status).toBe(201);
    const criado = await resposta.json();
    expect(criado).toMatchObject({ nome: "Higienizacao", duracaoMin: 90, ativo: true, tenantId: e.tenant.id });
    expect((await precosDe(criado.id)).map((p) => Number(p.valor))).toEqual([150]);
  });

  test("preco faltando para um tipo ativo responde 400", async () => {
    const hatch = await banco((tx) => tx.segmento.create({ data: { tenantId: e.tenant.id, nome: "Hatch", ordem: 2 } }));
    try {
      entrarComo(e.admin);
      const resposta = await criarServico(pedido("POST", "/api/servicos", servico()));
      expect(resposta.status).toBe(400);
      expect(await resposta.json()).toEqual({ error: "Informe o preco para: Hatch" });
    } finally {
      await banco((tx) => tx.segmento.delete({ where: { id: hatch.id } }));
    }
  });
});

describe("PATCH e DELETE /api/servicos/[id]", () => {
  const edicao = (valor: number) => ({
    nome: "Lavagem completa",
    descricao: "Por dentro e por fora",
    duracaoMin: 75,
    precos: [{ segmentoId: e.segmento.id, valor }],
  });

  test("so o Admin edita e remove", async () => {
    entrarComo(e.cliente);
    const id = e.servico.id;
    expect((await editarServico(pedido("PATCH", `/api/servicos/${id}`, edicao(90)), comId(id))).status).toBe(403);
    expect((await removerServico(pedido("DELETE", `/api/servicos/${id}`), comId(id))).status).toBe(403);
  });

  test("servico que nao existe responde 404", async () => {
    entrarComo(e.admin);
    const id = randomUUID();
    expect((await editarServico(pedido("PATCH", `/api/servicos/${id}`, edicao(90)), comId(id))).status).toBe(404);
    expect((await removerServico(pedido("DELETE", `/api/servicos/${id}`), comId(id))).status).toBe(404);
  });

  test("edicao atualiza os dados e o preco sem duplicar a linha", async () => {
    entrarComo(e.admin);
    const id = e.servico.id;
    const resposta = await editarServico(pedido("PATCH", `/api/servicos/${id}`, edicao(95)), comId(id));
    expect(await resposta.json()).toMatchObject({ duracaoMin: 75, descricao: "Por dentro e por fora" });
    expect((await precosDe(id)).map((p) => Number(p.valor))).toEqual([95]);
  });

  test("edicao invalida responde 400", async () => {
    entrarComo(e.admin);
    const id = e.servico.id;
    const resposta = await editarServico(pedido("PATCH", `/api/servicos/${id}`, { nome: "" }), comId(id));
    expect(resposta.status).toBe(400);
  });

  test("servico sem agendamento e removido", async () => {
    const avulso = await banco((tx) =>
      tx.servico.create({ data: { tenantId: e.tenant.id, nome: "Cera", duracaoMin: 30 } })
    );
    entrarComo(e.admin);
    const resposta = await removerServico(pedido("DELETE", `/api/servicos/${avulso.id}`), comId(avulso.id));
    expect(await resposta.json()).toEqual({ ok: true });
  });

  test("servico com agendamento nao pode ser removido", async () => {
    await banco((tx) =>
      tx.agendamento.create({
        data: {
          tenantId: e.tenant.id,
          usuarioId: e.cliente.id,
          veiculoId: e.veiculo.id,
          servicoId: e.servico.id,
          dataHora: daqui(-48),
          formaPagamento: "LOCAL",
          status: "CONCLUIDO",
          valor: 80,
        },
      })
    );
    entrarComo(e.admin);
    const id = e.servico.id;
    const resposta = await removerServico(pedido("DELETE", `/api/servicos/${id}`), comId(id));
    expect(resposta.status).toBe(409);
  });
});

describe("POST /api/segmentos", () => {
  test("so o Admin cria tipo de veiculo", async () => {
    entrarComo(e.cliente);
    expect((await criarSegmento(pedido("POST", "/api/segmentos", { nome: "Moto", ordem: 5 }))).status).toBe(403);
  });

  test("dados invalidos respondem 400", async () => {
    entrarComo(e.admin);
    expect((await criarSegmento(pedido("POST", "/api/segmentos", "x"))).status).toBe(400);
    expect((await criarSegmento(pedido("POST", "/api/segmentos", { nome: "", ordem: 1 }))).status).toBe(400);
  });

  test("nome repetido responde 409", async () => {
    entrarComo(e.admin);
    const resposta = await criarSegmento(pedido("POST", "/api/segmentos", { nome: "Sedan", ordem: 5 }));
    expect(resposta.status).toBe(409);
  });

  test("tipo novo copia os precos de outro tipo", async () => {
    entrarComo(e.admin);
    const resposta = await criarSegmento(
      pedido("POST", "/api/segmentos", { nome: "SUV", ordem: 4, copiarPrecosDe: e.segmento.id })
    );
    expect(resposta.status).toBe(201);
    const suv = await resposta.json();
    const precoSedan = await banco((tx) =>
      tx.precoServico.findFirst({ where: { servicoId: e.servico.id, segmentoId: e.segmento.id } })
    );
    const precoSuv = await banco((tx) =>
      tx.precoServico.findFirst({ where: { servicoId: e.servico.id, segmentoId: suv.id } })
    );
    expect(Number(precoSuv!.valor)).toBe(Number(precoSedan!.valor));
  });

  test("tipo novo sem origem entra com preco zero em todos os servicos", async () => {
    entrarComo(e.admin);
    const novo = await (await criarSegmento(pedido("POST", "/api/segmentos", { nome: "Moto", ordem: 6 }))).json();
    const precos = await banco((tx) => tx.precoServico.findMany({ where: { segmentoId: novo.id } }));
    const servicos = await banco((tx) => tx.servico.count({ where: { tenantId: e.tenant.id } }));
    expect(precos).toHaveLength(servicos);
    expect(precos.every((p) => Number(p.valor) === 0)).toBe(true);
  });
});

describe("PATCH e DELETE /api/segmentos/[id]", () => {
  const novoSegmento = (nome: string) =>
    banco((tx) => tx.segmento.create({ data: { tenantId: e.tenant.id, nome, ordem: 7 } }));

  test("so o Admin edita e remove", async () => {
    entrarComo(e.cliente);
    const id = e.segmento.id;
    expect((await editarSegmento(pedido("PATCH", `/api/segmentos/${id}`, { nome: "X" }), comId(id))).status).toBe(403);
    expect((await removerSegmento(pedido("DELETE", `/api/segmentos/${id}`), comId(id))).status).toBe(403);
  });

  test("tipo que nao existe responde 404", async () => {
    entrarComo(e.admin);
    const id = randomUUID();
    expect((await editarSegmento(pedido("PATCH", `/api/segmentos/${id}`, { nome: "X" }), comId(id))).status).toBe(404);
    expect((await removerSegmento(pedido("DELETE", `/api/segmentos/${id}`), comId(id))).status).toBe(404);
  });

  test("renomeia o tipo de veiculo", async () => {
    const s = await novoSegmento("Pickup");
    entrarComo(e.admin);
    const resposta = await editarSegmento(pedido("PATCH", `/api/segmentos/${s.id}`, { nome: "Picape pequena" }), comId(s.id));
    expect(await resposta.json()).toMatchObject({ nome: "Picape pequena" });
  });

  test("renomear para um nome que ja existe responde 409", async () => {
    const s = await novoSegmento("Camionete");
    entrarComo(e.admin);
    const resposta = await editarSegmento(pedido("PATCH", `/api/segmentos/${s.id}`, { nome: "Sedan" }), comId(s.id));
    expect(resposta.status).toBe(409);
  });

  test("edicao invalida responde 400", async () => {
    entrarComo(e.admin);
    const id = e.segmento.id;
    expect((await editarSegmento(pedido("PATCH", `/api/segmentos/${id}`, "x"), comId(id))).status).toBe(400);
    expect((await editarSegmento(pedido("PATCH", `/api/segmentos/${id}`, { ordem: -1 }), comId(id))).status).toBe(400);
  });

  test("tipo sem nada apontando e apagado, junto com os precos", async () => {
    const s = await novoSegmento("Triciclo");
    await banco((tx) =>
      tx.precoServico.create({ data: { tenantId: e.tenant.id, servicoId: e.servico.id, segmentoId: s.id, valor: 10 } })
    );
    entrarComo(e.admin);
    expect(await (await removerSegmento(pedido("DELETE", `/api/segmentos/${s.id}`), comId(s.id))).json()).toEqual({
      removido: "apagado",
    });
    expect(await banco((tx) => tx.precoServico.count({ where: { segmentoId: s.id } }))).toBe(0);
  });

  test("tipo com carro cadastrado e so desativado", async () => {
    const s = await novoSegmento("Conversivel");
    await banco((tx) =>
      tx.veiculo.create({
        data: {
          tenantId: e.tenant.id,
          usuarioId: e.cliente.id,
          marca: "Mazda",
          modelo: "MX-5",
          placa: "CNV1A23",
          ano: 2018,
          cor: "Vermelho",
          segmentoId: s.id,
        },
      })
    );
    entrarComo(e.admin);
    expect(await (await removerSegmento(pedido("DELETE", `/api/segmentos/${s.id}`), comId(s.id))).json()).toEqual({
      removido: "aposentado",
    });
    expect((await banco((tx) => tx.segmento.findUnique({ where: { id: s.id } })))!.ativo).toBe(false);
  });

  test("tipo com agendamento futuro nao pode ser removido", async () => {
    await banco((tx) =>
      tx.agendamento.create({
        data: {
          tenantId: e.tenant.id,
          usuarioId: e.cliente.id,
          veiculoId: e.veiculo.id,
          servicoId: e.servico.id,
          dataHora: daqui(72),
          formaPagamento: "LOCAL",
          valor: 80,
        },
      })
    );
    entrarComo(e.admin);
    const id = e.segmento.id;
    const resposta = await removerSegmento(pedido("DELETE", `/api/segmentos/${id}`), comId(id));
    expect(resposta.status).toBe(409);
    expect((await resposta.json()).error).toContain("agendamento futuro");
  });
});
