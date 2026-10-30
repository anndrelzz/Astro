import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { GET as exportarFinanceiro } from "@/app/api/financeiro/exportar/route";
import { PUT as salvarHorarios } from "@/app/api/tenant/horarios/route";
import { POST as enviarLogo } from "@/app/api/tenant/logo/route";
import { GET as baixarLogo } from "@/app/api/tenant/logo/[tenantId]/route";
import { PATCH as configurarEstetica } from "@/app/api/tenant/route";
import { prisma } from "@/back/prisma";
import { withTenant } from "@/back/tenant-db";
import { criarEstetica, daqui, entrarComo, pedido, removerEstetica, type Estetica } from "./ajudantes";

// UC09, UC11 a UC14, RF12, RF13, RF17, RF18 — o que o Admin configura na
// propria estetica e o relatorio financeiro.

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));

let e: Estetica;

beforeAll(async () => {
  e = await criarEstetica("estetica");
});

afterAll(async () => {
  await removerEstetica(e.tenant.slug);
  await prisma.$disconnect();
});

const tenantNoBanco = () => prisma.tenant.findUniqueOrThrow({ where: { id: e.tenant.id } });

describe("PATCH /api/tenant", () => {
  test("so o Admin configura a estetica", async () => {
    entrarComo(e.cliente);
    expect((await configurarEstetica(pedido("PATCH", "/api/tenant", { nome: "X" }))).status).toBe(403);
  });

  test("dados invalidos respondem 400 com a mensagem do campo", async () => {
    entrarComo(e.admin);
    expect((await configurarEstetica(pedido("PATCH", "/api/tenant", "x"))).status).toBe(400);
    const resposta = await configurarEstetica(pedido("PATCH", "/api/tenant", { corPrimaria: "azul" }));
    expect(await resposta.json()).toEqual({ error: "Cor inválida: use o formato #RRGGBB" });
  });

  test("salva so os campos enviados e mantem a chave PIX", async () => {
    entrarComo(e.admin);
    const resposta = await configurarEstetica(
      pedido("PATCH", "/api/tenant", { whatsapp: "(47) 99888-7766", capacidadeSimultanea: 2 })
    );
    expect(resposta.status).toBe(200);
    const salvo = await tenantNoBanco();
    expect(salvo).toMatchObject({ whatsapp: "47998887766", capacidadeSimultanea: 2 });
    expect(salvo.pixChaveCopiaCola).toBe(e.tenant.pixChaveCopiaCola);
  });

  test("chave PIX vazia desliga o PIX (RN10)", async () => {
    entrarComo(e.admin);
    await configurarEstetica(pedido("PATCH", "/api/tenant", { pixChaveCopiaCola: "" }));
    expect((await tenantNoBanco()).pixChaveCopiaCola).toBeNull();

    await configurarEstetica(pedido("PATCH", "/api/tenant", { pixChaveCopiaCola: "codigo-pix-novo" }));
    expect((await tenantNoBanco()).pixChaveCopiaCola).toBe("codigo-pix-novo");
  });

  test("o endereco do link (slug) nao muda (RN09)", async () => {
    entrarComo(e.admin);
    await configurarEstetica(pedido("PATCH", "/api/tenant", { nome: "Novo nome", slug: "outro-slug" }));
    expect(await tenantNoBanco()).toMatchObject({ nome: "Novo nome", slug: e.tenant.slug });
  });
});

describe("PUT /api/tenant/horarios", () => {
  const semana = (abertos: number[]) =>
    Array.from({ length: 7 }, (_, diaSemana) => ({
      diaSemana,
      ativo: abertos.includes(diaSemana),
      horaInicio: "09:00",
      horaFim: "17:30",
    }));

  test("so o Admin define os horarios", async () => {
    entrarComo(e.cliente);
    expect((await salvarHorarios(pedido("PUT", "/api/tenant/horarios", semana([1])))).status).toBe(403);
  });

  test("grade invalida responde 400", async () => {
    entrarComo(e.admin);
    expect((await salvarHorarios(pedido("PUT", "/api/tenant/horarios", "x"))).status).toBe(400);
    expect((await salvarHorarios(pedido("PUT", "/api/tenant/horarios", semana([1]).slice(0, 6)))).status).toBe(400);
  });

  test("dias abertos guardam o horario em minutos e dias fechados somem", async () => {
    entrarComo(e.admin);
    const resposta = await salvarHorarios(pedido("PUT", "/api/tenant/horarios", semana([1, 2, 3, 4, 5])));
    expect(await resposta.json()).toEqual({ ok: true });

    const grade = await withTenant(e.tenant.id, (tx) =>
      tx.horarioFuncionamento.findMany({ where: { tenantId: e.tenant.id }, orderBy: { diaSemana: "asc" } })
    );
    expect(grade.map((d) => d.diaSemana)).toEqual([1, 2, 3, 4, 5]);
    expect(grade[0]).toMatchObject({ horaInicioMin: 540, horaFimMin: 1050 });
  });
});

describe("logo da estetica", () => {
  // Os primeiros bytes de um PNG, o bastante para reconhecer o formato.
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);

  const envio = (arquivo?: Blob) => {
    const form = new FormData();
    if (arquivo) form.append("logo", arquivo, "logo.png");
    return new Request("http://localhost/api/tenant/logo", { method: "POST", body: form });
  };

  test("so o Admin envia o logo", async () => {
    entrarComo(e.cliente);
    expect((await enviarLogo(envio(new Blob([PNG])))).status).toBe(403);
  });

  test("pedido sem arquivo responde 400", async () => {
    entrarComo(e.admin);
    expect((await enviarLogo(envio())).status).toBe(400);
    const semFormulario = new Request("http://localhost/api/tenant/logo", { method: "POST", body: "x" });
    expect((await enviarLogo(semFormulario)).status).toBe(400);
  });

  test("arquivo acima de 2 MB responde 400", async () => {
    entrarComo(e.admin);
    const grande = new Blob([PNG, new Uint8Array(2 * 1024 * 1024)]);
    expect(await (await enviarLogo(envio(grande))).json()).toEqual({ error: "Arquivo muito grande - maximo de 2MB" });
  });

  test("formato que nao e PNG, JPG ou WEBP responde 400", async () => {
    entrarComo(e.admin);
    const svg = new Blob(['<svg onload="alert(1)"></svg>']);
    expect(await (await enviarLogo(envio(svg))).json()).toEqual({ error: "Formato invalido - use PNG, JPG ou WEBP" });
  });

  test("logo enviado fica salvo e e entregue com o tipo certo", async () => {
    entrarComo(e.admin);
    const { logoUrl } = await (await enviarLogo(envio(new Blob([PNG])))).json();
    expect(logoUrl).toMatch(new RegExp(`^/api/tenant/logo/${e.tenant.id}\\?v=`));
    expect((await tenantNoBanco()).logoUrl).toBe(logoUrl);

    const resposta = await baixarLogo(pedido("GET", logoUrl), { params: Promise.resolve({ tenantId: e.tenant.id }) });
    expect(resposta.headers.get("Content-Type")).toBe("image/png");
    expect(new Uint8Array(await resposta.arrayBuffer())).toEqual(PNG);
  });

  test("estetica sem logo responde 404", async () => {
    const resposta = await baixarLogo(pedido("GET", "/api/tenant/logo/x"), {
      params: Promise.resolve({ tenantId: randomUUID() }),
    });
    expect(resposta.status).toBe(404);
  });
});

describe("GET /api/financeiro/exportar", () => {
  test("so o Admin exporta o financeiro", async () => {
    entrarComo(e.cliente);
    expect((await exportarFinanceiro(pedido("GET", "/api/financeiro/exportar"))).status).toBe(403);
  });

  test("CSV para o Excel com os agendamentos do periodo, sem os cancelados", async () => {
    const agendar = (horasAtras: number, status: "CONFIRMADO" | "CANCELADO" | "PIX_PENDENTE", acrescimo: number | null) =>
      withTenant(e.tenant.id, (tx) =>
        tx.agendamento.create({
          data: {
            tenantId: e.tenant.id,
            usuarioId: e.cliente.id,
            veiculoId: e.veiculo.id,
            servicoId: e.servico.id,
            dataHora: daqui(-horasAtras),
            formaPagamento: status === "PIX_PENDENTE" ? "PIX" : "LOCAL",
            status,
            valor: 80,
            acrescimoAplicado: acrescimo,
          },
        })
      );
    await agendar(48, "CONFIRMADO", 20);
    await agendar(72, "PIX_PENDENTE", null);
    await agendar(96, "CANCELADO", null);

    entrarComo(e.admin);
    const resposta = await exportarFinanceiro(pedido("GET", "/api/financeiro/exportar?periodo=7dias"));
    expect(resposta.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(resposta.headers.get("Content-Disposition")).toMatch(/^attachment; filename="financeiro-.+\.csv"$/);

    const bytes = new Uint8Array(await resposta.arrayBuffer());
    // BOM no inicio, para o Excel abrir os acentos certos.
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const linhas = new TextDecoder().decode(bytes).split("\r\n");
    expect(linhas[0]).toBe(
      "Data;Hora;Cliente;Serviço;Forma de pagamento;Situação;Valor;Acréscimo;Total;Recebido"
    );
    expect(linhas).toHaveLength(3);
    // Mais antigo primeiro: o PIX pendente, depois o pago com acrescimo.
    expect(linhas[1]).toContain(";PIX;PIX pendente;80,00;0,00;80,00;Não");
    expect(linhas[2]).toContain(";No local;Pago;80,00;20,00;100,00;Sim");
  });

  test("texto que comeca com = vira texto na planilha, nao formula", async () => {
    await withTenant(e.tenant.id, (tx) =>
      tx.usuario.update({ where: { id: e.cliente.id }, data: { nome: "=HYPERLINK(\"x\")" } })
    );
    entrarComo(e.admin);
    const csv = await (await exportarFinanceiro(pedido("GET", "/api/financeiro/exportar?periodo=7dias"))).text();
    expect(csv).toContain(`;"'=HYPERLINK(""x"")";`);
  });
});
