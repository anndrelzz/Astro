import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { GET as buscar } from "@/app/api/esteticas/busca/route";
import { prisma } from "@/back/prisma";
import { PREFIXO, criarEstetica, pedido, removerEstetica, type Estetica } from "./ajudantes";

// Busca da estetica pelo nome, na landing ("Entrar" e "Ja tenho cadastro"):
// o dono digita parte do nome e vai para o login da estetica dele. A rota e
// publica, entao so devolve o que ja e publico (nome, endereco e logo).

let e: Estetica;
const EXTRAS = `${PREFIXO}-busca-extra`;

const consultar = async (q: string) => {
  const r = await buscar(pedido("GET", `/api/esteticas/busca?q=${encodeURIComponent(q)}`));
  return { status: r.status, corpo: await r.json() };
};

beforeAll(async () => {
  e = await criarEstetica("busca");
  await prisma.tenant.update({ where: { id: e.tenant.id }, data: { nome: "Estética Buscável Çapo" } });
  // Sete esteticas com o mesmo comeco de nome, para conferir o limite.
  await prisma.tenant.deleteMany({ where: { slug: { startsWith: EXTRAS } } });
  await prisma.tenant.createMany({
    data: Array.from({ length: 7 }, (_, i) => ({ nome: `Lava Rapido Zeta ${i}`, slug: `${EXTRAS}-${i}` })),
  });
});

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: { startsWith: EXTRAS } } });
  await removerEstetica(e.tenant.slug);
  await prisma.$disconnect();
});

describe("GET /api/esteticas/busca", () => {
  test("com menos de 3 letras responde 400 e nao busca", async () => {
    const { status, corpo } = await consultar("es");
    expect(status).toBe(400);
    expect(corpo.error).toMatch(/3 letras/);
  });

  test("acha por parte do nome, sem diferenca de maiuscula nem de acento", async () => {
    const { status, corpo } = await consultar("ESTETICA BUSCAVEL capo");
    expect(status).toBe(200);
    expect(corpo.esteticas).toEqual([
      { nome: "Estética Buscável Çapo", slug: e.tenant.slug, logoUrl: null },
    ]);
  });

  test("devolve so os dados publicos da estetica", async () => {
    await prisma.tenant.update({ where: { id: e.tenant.id }, data: { telefone: "47999990000", rua: "Rua Secreta" } });
    const { corpo } = await consultar("buscavel");
    expect(Object.keys(corpo.esteticas[0]).sort()).toEqual(["logoUrl", "nome", "slug"]);
  });

  test("devolve no maximo 6 esteticas", async () => {
    const { corpo } = await consultar("lava rapido zeta");
    expect(corpo.esteticas).toHaveLength(6);
  });

  test("% e _ valem como letra, e nao como curinga", async () => {
    expect((await consultar("%%%")).corpo.esteticas).toEqual([]);
    expect((await consultar("___")).corpo.esteticas).toEqual([]);
  });

  test("nome que nao existe devolve lista vazia", async () => {
    const { status, corpo } = await consultar("nenhuma estetica com este nome");
    expect(status).toBe(200);
    expect(corpo.esteticas).toEqual([]);
  });
});
