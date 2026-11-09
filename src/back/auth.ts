import "server-only";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/back/prisma";
import { withTenant } from "@/back/tenant-db";
import { segundosDeSessao } from "@/back/sessao";
import { registrarAcerto, registrarErro, reservarTentativa } from "@/back/limite-login";
import { LOGIN_BLOQUEADO, LOGIN_INDISPONIVEL } from "@/compartilhado/limite-login";

// RFC 6.2 — payload do JWT inclui tenant_id, user_id e role, permitindo
// que o middleware valide permissoes sem consulta adicional ao banco.
declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    tenantId: string;
    role: "ADMIN" | "CLIENTE";
  }
}

declare module "next-auth" {
  interface User {
    tenantId: string;
    role: "ADMIN" | "CLIENTE";
  }

  interface Session {
    user: {
      id: string;
      tenantId: string;
      role: "ADMIN" | "CLIENTE";
      name?: string | null;
      email?: string | null;
    };
  }
}

type Credenciais = Record<"email" | "password" | "tenantSlug", string> | undefined;

// O authorize de fato: confere a estetica, o limite de tentativas e a senha.
async function conferirCredenciais(credentials: Credenciais) {
  if (!credentials?.email || !credentials.password || !credentials.tenantSlug) {
    return null;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: credentials.tenantSlug },
  });
  if (!tenant) return null;

  // RN02/RN03 — acesso aos servicos exige autenticacao dentro do tenant correto.
  // E-mail e tratado sem diferenciar maiusculas/minusculas.
  // Issue #107 — no maximo 5 tentativas sem acertar; depois, 15 minutos
  // de bloqueio (ver back/limite-login.ts). A tentativa e reservada e
  // gravada antes de conferir a senha, numa transacao propria: o erro
  // de bloqueio e lancado fora dela, para nao desfazer a contagem.
  const agora = new Date();
  const reserva = await withTenant(tenant.id, async (tx) => {
    const encontrado = await tx.usuario.findUnique({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email: credentials.email.toLowerCase(),
        },
      },
    });
    if (!encontrado) return null;
    return { usuario: encontrado, numero: await reservarTentativa(tx, encontrado.id, agora) };
  });
  if (!reserva) return null;
  // O NextAuth repassa a mensagem do erro para a tela, que explica o bloqueio.
  if (reserva.numero === null) throw new Error(LOGIN_BLOQUEADO);
  const { usuario, numero } = reserva;

  const senhaValida = await bcrypt.compare(credentials.password, usuario.senhaHash);
  await withTenant(tenant.id, (tx) =>
    senhaValida ? registrarAcerto(tx, usuario.id) : registrarErro(tx, usuario.id, numero, agora)
  );
  if (!senhaValida) return null;

  return {
    id: usuario.id,
    tenantId: usuario.tenantId,
    role: usuario.role,
    name: usuario.nome,
    email: usuario.email,
  };
}

export const authOptions: NextAuthOptions = {
  // Issue #113 — 7 dias sem usar o site (ou SESSAO_DIAS). Ver back/sessao.ts.
  session: { strategy: "jwt", maxAge: segundosDeSessao(process.env.SESSAO_DIAS) },
  jwt: { maxAge: segundosDeSessao(process.env.SESSAO_DIAS) },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
        tenantSlug: { label: "Estetica", type: "text" },
      },
      // O NextAuth repassa a mensagem de qualquer erro lancado aqui para a
      // tela e para o endereco do erro. So os codigos conhecidos passam; uma
      // falha inesperada (banco fora do ar, por exemplo) vai para o log e sai
      // como LOGIN_INDISPONIVEL, sem a consulta nem os nomes das tabelas.
      async authorize(credentials) {
        try {
          return await conferirCredenciais(credentials);
        } catch (erro) {
          if (erro instanceof Error && erro.message === LOGIN_BLOQUEADO) throw erro;
          console.error("[login] falha inesperada ao conferir as credenciais", erro);
          throw new Error(LOGIN_INDISPONIVEL);
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.tenantId = user.tenantId;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId;
      session.user.tenantId = token.tenantId;
      session.user.role = token.role;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};
