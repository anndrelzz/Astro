import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { GET as listarVeiculos, POST as cadastrarVeiculo } from "@/app/api/veiculos/route";
import { DELETE as removerVeiculo } from "@/app/api/veiculos/[id]/route";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant-db";
import { comId, criarEstetica, daqui, entrarComo, pedido, removerEstetica, type Estetica } from "./ajudantes";

// UC02, RN04, RN15 — garagem do cliente: cadastrar, listar e remover carros.

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));

let e: Estetica;

beforeAll(async () => {
  e = await criarEstetica("veiculos");
});

afterAll(async () => {
  await removerEstetica(e.tenant.slug);
  await prisma.$disconnect();
});

const carro = (extra: Record<string, unknown> = {}) => ({
  marca: "Honda",
  modelo: "Civic",
  placa: "hnd-1234",
  ano: 2020,
  cor: "Azul",
  segmentoId: e.segmento.id,
  ...extra,
});

const veiculoNoBanco = (placa: string, ativo = true) =>
  withTenant(e.tenant.id, (tx) =>
    tx.veiculo.create({
      data: {
        tenantId: e.tenant.id,
        usuarioId: e.cliente.id,
        marca: "Fiat",
        modelo: "Uno",
        placa,
        ano: 2015,
        cor: "Branco",
        segmentoId: e.segmento.id,
        ativo,
      },
    })
  );

describe("POST /api/veiculos", () => {
  test("sem login responde 401", async () => {
    entrarComo(null);
    expect((await cadastrarVeiculo(pedido("POST", "/api/veiculos", carro()))).status).toBe(401);
  });

  test("corpo que nao e JSON responde 400", async () => {
    entrarComo(e.cliente);
    expect((await cadastrarVeiculo(pedido("POST", "/api/veiculos", "{"))).status).toBe(400);
  });

  test("placa invalida responde 400 com o detalhe do campo", async () => {
    entrarComo(e.cliente);
    const resposta = await cadastrarVeiculo(pedido("POST", "/api/veiculos", carro({ placa: "12345" })));
    expect(resposta.status).toBe(400);
    expect((await resposta.json()).detalhes.fieldErrors.placa).toBeDefined();
  });

  test("cadastra o carro no nome do cliente logado, com a placa normalizada", async () => {
    entrarComo(e.cliente);
    const resposta = await cadastrarVeiculo(pedido("POST", "/api/veiculos", carro()));
    expect(resposta.status).toBe(201);
    expect(await resposta.json()).toMatchObject({
      placa: "HND1234",
      usuarioId: e.cliente.id,
      tenantId: e.tenant.id,
      ativo: true,
    });
  });

  test("o mesmo carro de novo responde 409, sem diferenciar maiusculas", async () => {
    entrarComo(e.cliente);
    const resposta = await cadastrarVeiculo(
      pedido("POST", "/api/veiculos", carro({ marca: "HONDA", modelo: "civic", cor: "azul" }))
    );
    expect(resposta.status).toBe(409);
    expect(await resposta.json()).toEqual({ error: "Voce ja tem esse veiculo cadastrado" });
  });

  test("tipo de veiculo inexistente ou desativado responde 409", async () => {
    const aposentado = await withTenant(e.tenant.id, (tx) =>
      tx.segmento.create({ data: { tenantId: e.tenant.id, nome: "Van antiga", ordem: 9, ativo: false } })
    );
    entrarComo(e.cliente);
    for (const segmentoId of [randomUUID(), aposentado.id]) {
      const resposta = await cadastrarVeiculo(
        pedido("POST", "/api/veiculos", carro({ placa: "NOV1A23", segmentoId }))
      );
      expect(resposta.status).toBe(409);
      expect(await resposta.json()).toEqual({ error: "Tipo de veiculo indisponivel" });
    }
  });
});

describe("GET /api/veiculos", () => {
  test("sem login responde 401", async () => {
    entrarComo(null);
    expect((await listarVeiculos()).status).toBe(401);
  });

  test("lista so os carros ativos do proprio cliente", async () => {
    await veiculoNoBanco("OLD1234", false);
    entrarComo(e.cliente);
    const placas = (await (await listarVeiculos()).json()).map((v: { placa: string }) => v.placa);
    expect(placas).toContain("ABC1D23");
    expect(placas).not.toContain("OLD1234");

    entrarComo(e.outroCliente);
    expect(await (await listarVeiculos()).json()).toEqual([]);
  });
});

describe("DELETE /api/veiculos/[id]", () => {
  const chamar = (id: string) => removerVeiculo(pedido("DELETE", `/api/veiculos/${id}`), comId(id));

  const agendar = (veiculoId: string, dataHora: Date, status: "PENDENTE_PAGAMENTO" | "CONCLUIDO") =>
    withTenant(e.tenant.id, (tx) =>
      tx.agendamento.create({
        data: {
          tenantId: e.tenant.id,
          usuarioId: e.cliente.id,
          veiculoId,
          servicoId: e.servico.id,
          dataHora,
          formaPagamento: "LOCAL",
          status,
          valor: 80,
        },
      })
    );

  test("sem login responde 401", async () => {
    entrarComo(null);
    expect((await chamar(randomUUID())).status).toBe(401);
  });

  test("carro sem nenhum agendamento e apagado de verdade", async () => {
    const v = await veiculoNoBanco("DEL1A11");
    entrarComo(e.cliente);
    expect(await (await chamar(v.id)).json()).toEqual({ removido: "apagado" });
    expect(await withTenant(e.tenant.id, (tx) => tx.veiculo.findUnique({ where: { id: v.id } }))).toBeNull();
  });

  test("carro com historico sai da garagem, mas continua no banco", async () => {
    const v = await veiculoNoBanco("HIS1A11");
    await agendar(v.id, daqui(-72), "CONCLUIDO");
    entrarComo(e.cliente);

    expect(await (await chamar(v.id)).json()).toEqual({ removido: "aposentado" });
    const gravado = await withTenant(e.tenant.id, (tx) => tx.veiculo.findUnique({ where: { id: v.id } }));
    expect(gravado!.ativo).toBe(false);
  });

  test("carro com agendamento futuro nao pode ser removido", async () => {
    const v = await veiculoNoBanco("FUT1A11");
    await agendar(v.id, daqui(72), "PENDENTE_PAGAMENTO");
    entrarComo(e.cliente);

    const resposta = await chamar(v.id);
    expect(resposta.status).toBe(409);
    expect((await resposta.json()).error).toBe(
      "Este veiculo tem um agendamento futuro. Cancele o agendamento antes de remove-lo."
    );
  });

  test("carro de outro cliente responde 404", async () => {
    entrarComo(e.outroCliente);
    expect((await chamar(e.veiculo.id)).status).toBe(404);
  });
});
