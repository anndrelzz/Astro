import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { POST as cadastrar } from "@/app/api/auth/cadastro/route";
import { POST as rodarLembretes } from "@/app/api/cron/lembretes/route";
import { PATCH as editarPerfil } from "@/app/api/perfil/route";
import { POST as vincularTelegram } from "@/app/api/telegram/vincular/route";
import { POST as webhookTelegram } from "@/app/api/telegram/webhook/route";
import { authOptions } from "@/lib/auth";
import { verificarEEnviarLembretes } from "@/lib/notificacoes/lembretes";
import { enviarTelegram } from "@/lib/notificacoes/telegram";
import { prisma } from "@/lib/prisma";
import { getTenantPorSlug } from "@/lib/tenant";
import { withTenant } from "@/lib/tenant-db";
import { criarEstetica, entrarComo, pedido, removerEstetica, SENHA, type Estetica } from "./ajudantes";

// UC01, UC15, RN02, RN03, RN12 — conta do cliente: cadastro, login, perfil e
// vinculo com o Telegram. Tambem a rota chamada pelo agendador de lembretes.

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/notificacoes/telegram", () => ({
  enviarTelegram: vi.fn(async () => ({ enviado: true, modo: "log" })),
}));
// A rota do cron varre todas as esteticas do banco; aqui so interessa a
// protecao dela, entao a varredura e substituida.
vi.mock("@/lib/notificacoes/lembretes", () => ({
  verificarEEnviarLembretes: vi.fn(async () => ({ lembretes24h: 1, lembretes2h: 0, verificados: 3 })),
}));

let e: Estetica;

beforeAll(async () => {
  e = await criarEstetica("conta");
});

afterAll(async () => {
  await removerEstetica(e.tenant.slug);
  await prisma.$disconnect();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const usuario = (id: string) => withTenant(e.tenant.id, (tx) => tx.usuario.findUnique({ where: { id } }));

describe("POST /api/auth/cadastro", () => {
  const conta = (extra: Record<string, unknown> = {}) => ({
    tenantSlug: e.tenant.slug,
    nome: "Maria Souza",
    email: "Maria.Souza@Teste.Local",
    telefone: "(47) 98888-1234",
    senha: "Senha123",
    ...extra,
  });

  test("corpo que nao e JSON responde 400", async () => {
    expect((await cadastrar(pedido("POST", "/api/auth/cadastro", "x"))).status).toBe(400);
  });

  test.each([
    [{ senha: "senha123" }, "Senha deve conter ao menos 1 letra maiuscula"],
    [{ senha: "SenhaSemNumero" }, "Senha deve conter ao menos 1 numero"],
    [{ senha: "Se1" }, "Senha deve ter ao menos 8 caracteres"],
    [{ telefone: "1234" }, "Telefone invalido - informe DDD + numero (10 ou 11 digitos)"],
    [{ email: "maria@" }, "E-mail invalido"],
  ])("dado invalido %o responde 400 com a mensagem certa", async (extra, mensagem) => {
    const resposta = await cadastrar(pedido("POST", "/api/auth/cadastro", conta(extra)));
    expect(resposta.status).toBe(400);
    expect(await resposta.json()).toEqual({ error: mensagem });
  });

  test("estetica que nao existe responde 404", async () => {
    const resposta = await cadastrar(pedido("POST", "/api/auth/cadastro", conta({ tenantSlug: "nao-existe-xyz" })));
    expect(resposta.status).toBe(404);
  });

  test("cria a conta de cliente com e-mail em minusculas e senha protegida", async () => {
    const resposta = await cadastrar(pedido("POST", "/api/auth/cadastro", conta()));
    expect(resposta.status).toBe(201);

    const criado = await withTenant(e.tenant.id, (tx) =>
      tx.usuario.findUnique({
        where: { tenantId_email: { tenantId: e.tenant.id, email: "maria.souza@teste.local" } },
      })
    );
    expect(criado).toMatchObject({ role: "CLIENTE", telefone: "47988881234", nome: "Maria Souza" });
    expect(criado!.senhaHash).not.toBe("Senha123");
    expect(criado!.senhaHash).toMatch(/^\$2[aby]\$10\$/);
  });

  test("e-mail ja cadastrado na estetica responde 409", async () => {
    const resposta = await cadastrar(pedido("POST", "/api/auth/cadastro", conta({ email: "MARIA.SOUZA@teste.local" })));
    expect(resposta.status).toBe(409);
  });
});

describe("login (NextAuth)", () => {
  type Credenciais = { email: string; password: string; tenantSlug: string };
  const provedor = authOptions.providers[0] as unknown as {
    options: { authorize: (c: Partial<Credenciais> | undefined, req: unknown) => Promise<unknown> };
  };
  const entrar = (c: Partial<Credenciais> | undefined) => provedor.options.authorize(c, {});

  test("e-mail e senha certos devolvem o usuario com estetica e papel", async () => {
    const resultado = await entrar({ email: e.cliente.email, password: SENHA, tenantSlug: e.tenant.slug });
    expect(resultado).toEqual({
      id: e.cliente.id,
      tenantId: e.tenant.id,
      role: "CLIENTE",
      name: e.cliente.nome,
      email: e.cliente.email,
    });
  });

  test("e-mail com maiusculas tambem entra", async () => {
    const resultado = await entrar({ email: e.admin.email.toUpperCase(), password: SENHA, tenantSlug: e.tenant.slug });
    expect(resultado).toMatchObject({ id: e.admin.id, role: "ADMIN" });
  });

  test("senha errada, e-mail desconhecido ou estetica errada nao entram", async () => {
    expect(await entrar({ email: e.cliente.email, password: "Errada123", tenantSlug: e.tenant.slug })).toBeNull();
    expect(await entrar({ email: "ninguem@teste.local", password: SENHA, tenantSlug: e.tenant.slug })).toBeNull();
    expect(await entrar({ email: e.cliente.email, password: SENHA, tenantSlug: "outra-estetica-xyz" })).toBeNull();
  });

  test("campo faltando nao entra", async () => {
    expect(await entrar({ email: e.cliente.email, password: SENHA })).toBeNull();
    expect(await entrar(undefined)).toBeNull();
  });

  test("o token e a sessao carregam o id, a estetica e o papel (RFC 6.2)", async () => {
    const { jwt, session } = authOptions.callbacks!;
    const token = await jwt!({
      token: {},
      user: { id: e.admin.id, tenantId: e.tenant.id, role: "ADMIN" },
    } as Parameters<NonNullable<typeof jwt>>[0]);
    expect(token).toMatchObject({ userId: e.admin.id, tenantId: e.tenant.id, role: "ADMIN" });

    // Sem usuario (pedidos seguintes ao login), o token passa intacto.
    expect(await jwt!({ token } as Parameters<NonNullable<typeof jwt>>[0])).toBe(token);

    const sessao = await session!({ session: { user: {} }, token } as unknown as Parameters<NonNullable<typeof session>>[0]);
    expect(sessao.user).toMatchObject({ id: e.admin.id, tenantId: e.tenant.id, role: "ADMIN" });
  });
});

describe("getTenantPorSlug", () => {
  test("acha a estetica pelo endereco e devolve null quando nao existe", async () => {
    expect(await getTenantPorSlug(e.tenant.slug)).toMatchObject({ id: e.tenant.id });
    expect(await getTenantPorSlug("nao-existe-xyz")).toBeNull();
  });
});

describe("PATCH /api/perfil", () => {
  test("sem login responde 401", async () => {
    entrarComo(null);
    expect((await editarPerfil(pedido("PATCH", "/api/perfil", { nome: "X", telefone: "4799999999" }))).status).toBe(401);
  });

  test("dados invalidos respondem 400", async () => {
    entrarComo(e.outroCliente);
    expect((await editarPerfil(pedido("PATCH", "/api/perfil", "x"))).status).toBe(400);
    const resposta = await editarPerfil(pedido("PATCH", "/api/perfil", { nome: " ", telefone: "4799999999" }));
    expect(await resposta.json()).toEqual({ error: "Informe o nome completo" });
  });

  test("atualiza nome e telefone do proprio cliente", async () => {
    entrarComo(e.outroCliente);
    const resposta = await editarPerfil(pedido("PATCH", "/api/perfil", { nome: "  Joao Lima ", telefone: "(47) 3333-4444" }));
    expect(await resposta.json()).toEqual({ ok: true });
    expect(await usuario(e.outroCliente.id)).toMatchObject({ nome: "Joao Lima", telefone: "4733334444" });
  });
});

describe("vinculo com o Telegram", () => {
  test("gerar link sem login responde 401", async () => {
    entrarComo(null);
    expect((await vincularTelegram()).status).toBe(401);
  });

  test("gera o link do bot com um token guardado na conta", async () => {
    vi.stubEnv("TELEGRAM_BOT_USERNAME", "AstroTesteBot");
    entrarComo(e.cliente);
    const { link } = await (await vincularTelegram()).json();
    const token = (await usuario(e.cliente.id))!.telegramLinkToken;
    expect(token).toBeTruthy();
    expect(link).toBe(`https://t.me/AstroTesteBot?start=${token}`);
  });

  test("sem bot configurado, usa o nome padrao", async () => {
    vi.stubEnv("TELEGRAM_BOT_USERNAME", "");
    entrarComo(e.cliente);
    expect((await (await vincularTelegram()).json()).link).toMatch(/^https:\/\/t\.me\/AstroBot\?start=/);
  });

  test("o /start com o token vincula o chat e invalida o token", async () => {
    entrarComo(e.cliente);
    await vincularTelegram();
    const token = (await usuario(e.cliente.id))!.telegramLinkToken;

    const resposta = await webhookTelegram(
      pedido("POST", "/api/telegram/webhook", { message: { text: `/start ${token}`, chat: { id: 987654 } } })
    );
    expect(await resposta.json()).toEqual({ ok: true });
    expect(await usuario(e.cliente.id)).toMatchObject({ telegramChatId: "987654", telegramLinkToken: null });
    expect(enviarTelegram).toHaveBeenCalledWith("987654", "Conta vinculada com sucesso!");
  });

  test("mensagens que nao sao um /start valido sao ignoradas sem erro", async () => {
    vi.mocked(enviarTelegram).mockClear();
    const corpos = [
      "nao e json",
      { message: { text: "oi", chat: { id: 1 } } },
      { message: { text: "/start ", chat: { id: 1 } } },
      { message: { text: "/start   ", chat: { id: 1 } } },
      { message: { text: "/start token-que-nao-existe", chat: { id: 1 } } },
      { message: { text: "/start abc" } },
    ];
    for (const corpo of corpos) {
      const resposta = await webhookTelegram(pedido("POST", "/api/telegram/webhook", corpo));
      expect(await resposta.json()).toEqual({ ok: true });
    }
    expect(enviarTelegram).not.toHaveBeenCalled();
  });
});

describe("POST /api/cron/lembretes", () => {
  const chamar = (segredo?: string) =>
    rodarLembretes(
      new Request("http://localhost/api/cron/lembretes", {
        method: "POST",
        headers: segredo ? { "x-cron-secret": segredo } : undefined,
      })
    );

  test("sem CRON_SECRET no servidor, recusa tudo com 503", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await chamar("qualquer")).status).toBe(503);
    expect(verificarEEnviarLembretes).not.toHaveBeenCalled();
    erro.mockRestore();
  });

  test("segredo errado ou ausente responde 401", async () => {
    vi.stubEnv("CRON_SECRET", "segredo-certo");
    expect((await chamar("errado")).status).toBe(401);
    expect((await chamar()).status).toBe(401);
    expect(verificarEEnviarLembretes).not.toHaveBeenCalled();
  });

  test("com o segredo certo, roda os lembretes e devolve o resumo", async () => {
    vi.stubEnv("CRON_SECRET", "segredo-certo");
    const resposta = await chamar("segredo-certo");
    expect(await resposta.json()).toEqual({ lembretes24h: 1, lembretes2h: 0, verificados: 3 });
  });
});
