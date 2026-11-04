import bcrypt from "bcryptjs";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { POST as pedirLink } from "@/app/api/auth/esqueci-senha/route";
import { POST as redefinir } from "@/app/api/auth/redefinir-senha/route";
import { obterCoringa } from "@/back/coringa";
import { enviarEmail } from "@/back/notificacoes/email";
import { prisma } from "@/back/prisma";
import { withTenant } from "@/back/tenant-db";
import { criarEstetica, pedido, removerEstetica, type Estetica } from "./ajudantes";

// RFC 6.2 — "esqueci minha senha", com as regras combinadas em 04/11:
// resposta sempre igual (nao revela quem tem conta), link de 1 hora e de uso
// unico, no maximo 3 pedidos por hora, funciona sem o e-mail confirmado e
// usar o link confirma o e-mail.

vi.mock("@/back/notificacoes/email", () => ({
  enviarEmail: vi.fn(async () => ({ enviado: true, modo: "log" })),
}));

let e: Estetica;
let outra: Estetica;

beforeAll(async () => {
  e = await criarEstetica("senha");
  outra = await criarEstetica("senha-outra");
});

afterAll(async () => {
  await removerEstetica(e.tenant.slug);
  await removerEstetica(outra.tenant.slug);
  await prisma.$disconnect();
});

beforeEach(async () => {
  vi.mocked(enviarEmail).mockClear();
  await withTenant(e.tenant.id, (tx) => tx.tokenEmail.deleteMany({ where: { tenantId: e.tenant.id } }));
});

const pedir = (email: string, tenantSlug = e.tenant.slug) =>
  pedirLink(pedido("POST", "/api/auth/esqueci-senha", { tenantSlug, email }));

// O token so existe no link do e-mail: no banco fica o hash dele.
function tokenDoUltimoEmail() {
  const texto = vi.mocked(enviarEmail).mock.calls.at(-1)?.[2] ?? "";
  return texto.match(/redefinir-senha\?token=([\w-]+)/)?.[1] ?? "";
}

const trocar = (token: string, senha = "NovaSenha1", tenantSlug = e.tenant.slug) =>
  redefinir(pedido("POST", "/api/auth/redefinir-senha", { tenantSlug, token, senha }));

const cliente = () => withTenant(e.tenant.id, (tx) => tx.usuario.findUnique({ where: { id: e.cliente.id } }));

describe("POST /api/auth/esqueci-senha", () => {
  test("manda o link para o e-mail da conta, na estetica do endereco", async () => {
    const resposta = await pedir(e.cliente.email);

    expect(resposta.status).toBe(200);
    expect(enviarEmail).toHaveBeenCalledTimes(1);
    const [destinatario, assunto, texto, html] = vi.mocked(enviarEmail).mock.calls[0];
    expect(destinatario).toBe(e.cliente.email);
    expect(assunto).toBe("Redefinir sua senha");
    expect(texto).toContain(`https://useastro.app.br/${e.tenant.slug}/redefinir-senha?token=`);
    expect(html).toContain(e.tenant.nome);
  });

  test("no banco fica so o hash do token, nunca o token do link", async () => {
    await pedir(e.cliente.email);
    const token = tokenDoUltimoEmail();

    const salvos = await withTenant(e.tenant.id, (tx) => tx.tokenEmail.findMany({ where: { usuarioId: e.cliente.id } }));
    expect(salvos).toHaveLength(1);
    expect(salvos[0].tipo).toBe("REDEFINIR_SENHA");
    expect(salvos[0].tokenHash).not.toContain(token);
    // Vale por 1 hora.
    const minutos = (salvos[0].expiraEm.getTime() - salvos[0].criadoEm.getTime()) / 60000;
    expect(Math.round(minutos)).toBe(60);
  });

  test("e-mail sem conta recebe a mesma resposta, e nada e enviado", async () => {
    const comConta = await (await pedir(e.cliente.email)).json();
    vi.mocked(enviarEmail).mockClear();

    const semConta = await pedir("ninguem@teste.local");
    expect(semConta.status).toBe(200);
    expect(await semConta.json()).toEqual(comConta);
    expect(enviarEmail).not.toHaveBeenCalled();
  });

  test("conta de outra estetica nao recebe o link por este endereco", async () => {
    await pedir(outra.cliente.email);
    expect(enviarEmail).not.toHaveBeenCalled();
  });

  test("no maximo 3 pedidos por hora: o quarto responde igual, mas nao envia", async () => {
    for (let i = 0; i < 3; i++) await pedir(e.cliente.email);
    expect(enviarEmail).toHaveBeenCalledTimes(3);

    const quarto = await pedir(e.cliente.email);
    expect(quarto.status).toBe(200);
    expect(enviarEmail).toHaveBeenCalledTimes(3);
  });

  test("o coringa nao recupera senha: ninguem entra com ele", async () => {
    const coringa = await withTenant(e.tenant.id, (tx) => obterCoringa(tx, e.tenant.id));
    await pedir(coringa.email);
    expect(enviarEmail).not.toHaveBeenCalled();
  });

  test("e-mail em formato errado responde 400 apontando o campo", async () => {
    const resposta = await pedir("maria@");
    expect(resposta.status).toBe(400);
    expect(await resposta.json()).toMatchObject({ campo: "email" });
  });
});

describe("POST /api/auth/redefinir-senha", () => {
  test("com o link valido, troca a senha, confirma o e-mail e devolve o e-mail para entrar", async () => {
    await withTenant(e.tenant.id, (tx) =>
      tx.usuario.update({ where: { id: e.cliente.id }, data: { emailConfirmadoEm: null } })
    );
    await pedir(e.cliente.email);

    const resposta = await trocar(tokenDoUltimoEmail());

    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toEqual({ email: e.cliente.email });
    const depois = await cliente();
    expect(await bcrypt.compare("NovaSenha1", depois!.senhaHash)).toBe(true);
    expect(depois!.emailConfirmadoEm).not.toBeNull();
  });

  test("o link funciona uma vez so", async () => {
    await pedir(e.cliente.email);
    const token = tokenDoUltimoEmail();

    expect((await trocar(token)).status).toBe(200);
    const deNovo = await trocar(token, "OutraSenha2");
    expect(deNovo.status).toBe(400);
    expect(await deNovo.json()).toMatchObject({ error: "Este link expirou ou já foi usado. Peça um novo." });
  });

  test("usar um link invalida os outros que ainda estavam abertos", async () => {
    await pedir(e.cliente.email);
    const primeiro = tokenDoUltimoEmail();
    await pedir(e.cliente.email);
    const segundo = tokenDoUltimoEmail();

    expect((await trocar(segundo)).status).toBe(200);
    expect((await trocar(primeiro)).status).toBe(400);
  });

  test("link vencido (mais de 1 hora) nao troca a senha", async () => {
    await pedir(e.cliente.email);
    const token = tokenDoUltimoEmail();
    await withTenant(e.tenant.id, (tx) =>
      tx.tokenEmail.updateMany({ where: { usuarioId: e.cliente.id }, data: { expiraEm: new Date(Date.now() - 1000) } })
    );

    expect((await trocar(token)).status).toBe(400);
  });

  test("o link de uma estetica nao vale no endereco de outra", async () => {
    await pedir(e.cliente.email);
    expect((await trocar(tokenDoUltimoEmail(), "NovaSenha1", outra.tenant.slug)).status).toBe(400);
  });

  test("senha fraca e recusada com a mesma regra do cadastro, e o link continua valendo", async () => {
    await pedir(e.cliente.email);
    const token = tokenDoUltimoEmail();

    const fraca = await trocar(token, "senha123");
    expect(fraca.status).toBe(400);
    expect(await fraca.json()).toMatchObject({ error: "Senha deve conter ao menos 1 letra maiuscula", campo: "senha" });
    expect((await trocar(token)).status).toBe(200);
  });
});
