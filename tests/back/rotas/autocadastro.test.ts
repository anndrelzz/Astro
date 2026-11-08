import bcrypt from "bcryptjs";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { GET as consultarEndereco } from "@/app/api/esteticas/endereco/route";
import { POST as cadastrarEstetica } from "@/app/api/esteticas/route";
import { MAX_CADASTROS_POR_HORA, SEGMENTOS_INICIAIS } from "@/back/autocadastro";
import { prisma } from "@/back/prisma";
import { withTenant } from "@/back/tenant-db";
import { criarEstetica, removerEstetica, type Estetica } from "./ajudantes";

// Autocadastro da estetica (decisao do orientador, 30/10; detalhes do Andre,
// 06/11). O dono preenche a tela /start e a estetica nasce com o Admin dele e
// os tipos de veiculo iniciais. A grade de horarios fica vazia: ele configura
// no primeiro acesso.

// Os enderecos de teste comecam por "zzteste" (o "__test__" dos outros testes
// nao passa na regra do endereco) e sao apagados no fim.
const PREFIXO = "zztesteauto";
const criados = new Set<string>();

let existente: Estetica;

beforeAll(async () => {
  existente = await criarEstetica("autocadastro");
});

afterAll(async () => {
  for (const slug of criados) await removerEstetica(slug);
  await removerEstetica(existente.tenant.slug);
  await prisma.$disconnect();
});

let contador = 0;
// Cada teste vem de uma "conexao" diferente, para o limite por hora so
// aparecer no teste dele.
function cadastro(extra: Record<string, unknown> = {}, ip = `203.0.113.${++contador}`) {
  const endereco = `${PREFIXO}${contador}${Date.now() % 100000}`;
  criados.add(typeof extra.endereco === "string" ? extra.endereco : endereco);
  const corpo = {
    nomeEstetica: "Estética do João",
    endereco,
    nome: "João Pereira",
    email: "Joao@Exemplo.com",
    whatsapp: "(47) 99999-0000",
    senha: "Senha123",
    aceitouTermos: true,
    ...extra,
  };
  return new Request("http://localhost/api/esteticas", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(corpo),
  });
}

const buscar = (slug: string) => prisma.tenant.findUnique({ where: { slug } });

describe("POST /api/esteticas", () => {
  test("cria a estetica, o Admin e os tipos de veiculo iniciais, sem grade", async () => {
    const pedido = cadastro();
    const { endereco } = await pedido.clone().json();

    const res = await cadastrarEstetica(pedido);

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true, slug: endereco });

    const tenant = await buscar(endereco);
    expect(tenant).toMatchObject({ nome: "Estética do João", whatsapp: "47999990000" });

    const { admin, segmentos, horarios } = await withTenant(tenant!.id, async (tx) => ({
      admin: await tx.usuario.findFirst({ where: { tenantId: tenant!.id } }),
      segmentos: await tx.segmento.findMany({ where: { tenantId: tenant!.id }, orderBy: { ordem: "asc" } }),
      horarios: await tx.horarioFuncionamento.count({ where: { tenantId: tenant!.id } }),
    }));

    expect(admin).toMatchObject({
      nome: "João Pereira",
      email: "joao@exemplo.com",
      telefone: "47999990000",
      role: "ADMIN",
      coringa: false,
    });
    expect(await bcrypt.compare("Senha123", admin!.senhaHash)).toBe(true);
    expect(segmentos.map((s) => s.nome)).toEqual([...SEGMENTOS_INICIAIS]);
    expect(SEGMENTOS_INICIAIS).toEqual(["Hatch", "Sedan", "SUV", "Utilitário"]);
    expect(horarios).toBe(0);
  });

  test("o endereco digitado e normalizado antes de salvar", async () => {
    const endereco = `${PREFIXO}-Normal-${Date.now() % 100000}`;
    const res = await cadastrarEstetica(cadastro({ endereco: `  ${endereco}-- ` }));

    const esperado = endereco.toLowerCase();
    criados.add(esperado);
    expect(res.status).toBe(201);
    expect(await buscar(esperado)).not.toBeNull();
  });

  test("endereco ja usado por outra estetica: 409, sem criar nada", async () => {
    const primeiro = cadastro();
    const { endereco } = await primeiro.clone().json();
    expect((await cadastrarEstetica(primeiro)).status).toBe(201);

    const res = await cadastrarEstetica(cadastro({ endereco, nomeEstetica: "Outra estética" }));

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ campo: "endereco" });
    expect(await buscar(endereco)).toMatchObject({ nome: "Estética do João" });
  });

  test("endereco proibido ou invalido: 400 no campo do endereco", async () => {
    for (const endereco of ["admin", "start", "ab", "-"]) {
      const res = await cadastrarEstetica(cadastro({ endereco }));
      expect(res.status, endereco).toBe(400);
      expect((await res.json()).campo, endereco).toBe("endereco");
    }
    expect(await buscar("start")).toBeNull();
  });

  test("sem aceitar os termos, nao cadastra", async () => {
    const pedido = cadastro({ aceitouTermos: false });
    const { endereco } = await pedido.clone().json();

    const res = await cadastrarEstetica(pedido);

    expect(res.status).toBe(400);
    expect((await res.json()).campo).toBe("aceitouTermos");
    expect(await buscar(endereco)).toBeNull();
  });

  test("senha fraca e WhatsApp sem DDD sao recusados no campo certo", async () => {
    const fraca = await cadastrarEstetica(cadastro({ senha: "senhafraca" }));
    expect((await fraca.json()).campo).toBe("senha");

    const semDdd = await cadastrarEstetica(cadastro({ whatsapp: "99999-0000" }));
    expect((await semDdd.json()).campo).toBe("whatsapp");
  });

  test("corpo que nao e JSON: 400", async () => {
    const res = await cadastrarEstetica(
      new Request("http://localhost/api/esteticas", { method: "POST", body: "nao e json" })
    );
    expect(res.status).toBe(400);
  });

  test("robo que preenche o campo escondido recebe 201, mas nada e criado", async () => {
    const pedido = cadastro({ site: "http://spam.example" });
    const { endereco } = await pedido.clone().json();

    const res = await cadastrarEstetica(pedido);

    expect(res.status).toBe(201);
    expect(await buscar(endereco)).toBeNull();
  });

  test(`a mesma conexao cria no maximo ${MAX_CADASTROS_POR_HORA} esteticas por hora`, async () => {
    const ip = "198.51.100.77";
    for (let i = 0; i < MAX_CADASTROS_POR_HORA; i++) {
      expect((await cadastrarEstetica(cadastro({}, ip))).status).toBe(201);
    }

    const excedente = cadastro({}, ip);
    const { endereco } = await excedente.clone().json();
    const res = await cadastrarEstetica(excedente);

    expect(res.status).toBe(429);
    expect(await buscar(endereco)).toBeNull();
    // Outra conexao continua podendo.
    expect((await cadastrarEstetica(cadastro({}, "198.51.100.78"))).status).toBe(201);
  });

  test("a conexao e guardada so como resumo, nunca o IP", async () => {
    const pedido = cadastro({}, "192.0.2.10:51234");
    const { endereco } = await pedido.clone().json();
    await cadastrarEstetica(pedido);

    const tenant = await buscar(endereco);
    expect(tenant?.cadastroIpHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(tenant)).not.toContain("192.0.2.10");
  });
});

describe("GET /api/esteticas/endereco", () => {
  const consultar = async (valor: string) => {
    const res = await consultarEndereco(
      new Request(`http://localhost/api/esteticas/endereco?valor=${encodeURIComponent(valor)}`)
    );
    return { status: res.status, corpo: await res.json() };
  };

  test("endereco livre", async () => {
    expect(await consultar("Estética Nova Livre 123")).toEqual({
      status: 200,
      corpo: { endereco: "esteticanovalivre123", disponivel: true },
    });
  });

  test("endereco de uma estetica criada pelo autocadastro fica em uso", async () => {
    const pedido = cadastro();
    const { endereco } = await pedido.clone().json();
    await cadastrarEstetica(pedido);

    expect((await consultar(endereco)).corpo).toEqual({ endereco, disponivel: false, motivo: "em-uso" });
  });

  test("endereco proibido ou curto diz o motivo", async () => {
    expect((await consultar("admin")).corpo).toEqual({ endereco: "admin", disponivel: false, motivo: "proibido" });
    expect((await consultar("ab")).corpo).toMatchObject({ disponivel: false, motivo: "curto" });
  });
});
