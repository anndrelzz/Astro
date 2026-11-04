import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { POST as cadastrar } from "@/app/api/auth/cadastro/route";
import { GET as confirmar } from "@/app/api/auth/confirmar-email/route";
import { POST as reenviar } from "@/app/api/perfil/reenviar-confirmacao/route";
import { enviarEmail } from "@/back/notificacoes/email";
import { prisma } from "@/back/prisma";
import { withTenant } from "@/back/tenant-db";
import { criarEstetica, entrarComo, pedido, removerEstetica, type Estetica } from "./ajudantes";

// Confirmacao do e-mail (decisoes de 29/10 e 04/11): o cadastro manda um link,
// e so quem confirmou recebe os e-mails de agendamento. O link vale 7 dias e
// uma vez so; o Perfil reenvia, no maximo 3 por hora.

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/back/notificacoes/email", () => ({
  enviarEmail: vi.fn(async () => ({ enviado: true, modo: "log" })),
}));

let e: Estetica;

beforeAll(async () => {
  e = await criarEstetica("confirmacao");
});

afterAll(async () => {
  await removerEstetica(e.tenant.slug);
  await prisma.$disconnect();
});

beforeEach(() => {
  vi.mocked(enviarEmail).mockClear();
});

let contador = 0;
async function novaConta() {
  contador += 1;
  const email = `nova-${contador}@teste.local`;
  const resposta = await cadastrar(
    pedido("POST", "/api/auth/cadastro", {
      tenantSlug: e.tenant.slug,
      nome: "Maria Nova",
      email,
      telefone: "47999990000",
      senha: "Senha123",
    })
  );
  expect(resposta.status).toBe(201);
  const usuario = await withTenant(e.tenant.id, (tx) =>
    tx.usuario.findUniqueOrThrow({ where: { tenantId_email: { tenantId: e.tenant.id, email } } })
  );
  return usuario;
}

// O link vai so no e-mail; aqui ele e lido de la.
function linkDoUltimoEmail() {
  const texto = vi.mocked(enviarEmail).mock.calls.at(-1)?.[2] ?? "";
  const link = texto.match(/https:\/\/useastro\.app\.br\/api\/auth\/confirmar-email\?[^\s]+/)?.[0] ?? "";
  return new URL(link);
}

const abrir = (link: URL) => confirmar(pedido("GET", `${link.pathname}${link.search}`));

const confirmado = (id: string) =>
  withTenant(e.tenant.id, (tx) => tx.usuario.findUniqueOrThrow({ where: { id } })).then((u) => u.emailConfirmadoEm);

describe("cadastro", () => {
  test("a conta nasce sem confirmacao e recebe o e-mail com o link", async () => {
    const usuario = await novaConta();

    expect(usuario.emailConfirmadoEm).toBeNull();
    const [destinatario, assunto, , html] = vi.mocked(enviarEmail).mock.calls.at(-1)!;
    expect(destinatario).toBe(usuario.email);
    expect(assunto).toBe("Confirme seu e-mail");
    expect(html).toContain(e.tenant.nome);
    expect(linkDoUltimoEmail().searchParams.get("slug")).toBe(e.tenant.slug);
  });
});

describe("GET /api/auth/confirmar-email", () => {
  test("com o link valido, confirma e leva ao Perfil com o aviso de sucesso", async () => {
    const usuario = await novaConta();

    const resposta = await abrir(linkDoUltimoEmail());

    expect(resposta.status).toBe(307);
    expect(resposta.headers.get("location")).toMatch(new RegExp(`/${e.tenant.slug}/perfil\\?email=confirmado$`));
    expect(await confirmado(usuario.id)).not.toBeNull();
  });

  test("o link funciona uma vez so", async () => {
    await novaConta();
    const link = linkDoUltimoEmail();
    await abrir(link);

    const deNovo = await abrir(link);
    expect(deNovo.headers.get("location")).toMatch(/\/perfil\?email=link-invalido$/);
  });

  test("link vencido nao confirma", async () => {
    const usuario = await novaConta();
    const link = linkDoUltimoEmail();
    await withTenant(e.tenant.id, (tx) =>
      tx.tokenEmail.updateMany({ where: { usuarioId: usuario.id }, data: { expiraEm: new Date(Date.now() - 1000) } })
    );

    const resposta = await abrir(link);
    expect(resposta.headers.get("location")).toMatch(/\/perfil\?email=link-invalido$/);
    expect(await confirmado(usuario.id)).toBeNull();
  });

  test("o link de uma estetica nao vale no endereco de outra", async () => {
    const usuario = await novaConta();
    const link = linkDoUltimoEmail();
    link.searchParams.set("slug", "outra-estetica-qualquer");

    await abrir(link);
    expect(await confirmado(usuario.id)).toBeNull();
  });
});

describe("POST /api/perfil/reenviar-confirmacao", () => {
  const pedirDeNovo = () => reenviar();

  test("sem login responde 401", async () => {
    entrarComo(null);
    expect((await pedirDeNovo()).status).toBe(401);
  });

  test("manda um link novo para quem ainda nao confirmou", async () => {
    const usuario = await novaConta();
    entrarComo({ ...usuario, role: "CLIENTE" });
    vi.mocked(enviarEmail).mockClear();

    expect((await pedirDeNovo()).status).toBe(200);
    expect(enviarEmail).toHaveBeenCalledTimes(1);
    expect(vi.mocked(enviarEmail).mock.calls[0][0]).toBe(usuario.email);
  });

  test("quem ja confirmou nao recebe outro link", async () => {
    const usuario = await novaConta();
    await abrir(linkDoUltimoEmail());
    entrarComo({ ...usuario, role: "CLIENTE" });
    vi.mocked(enviarEmail).mockClear();

    expect((await pedirDeNovo()).status).toBe(409);
    expect(enviarEmail).not.toHaveBeenCalled();
  });

  test("no maximo 3 links por hora, contando o do cadastro", async () => {
    const usuario = await novaConta();
    entrarComo({ ...usuario, role: "CLIENTE" });

    expect((await pedirDeNovo()).status).toBe(200);
    expect((await pedirDeNovo()).status).toBe(200);
    expect((await pedirDeNovo()).status).toBe(429);
  });
});
