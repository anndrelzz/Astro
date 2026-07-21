import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

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

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
        tenantSlug: { label: "Estetica", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password || !credentials.tenantSlug) {
          return null;
        }

        const tenant = await prisma.tenant.findUnique({
          where: { slug: credentials.tenantSlug },
        });
        if (!tenant) return null;

        // RN02/RN03 — acesso aos servicos exige autenticacao dentro do tenant correto.
        // E-mail e tratado sem diferenciar maiusculas/minusculas.
        const usuario = await prisma.usuario.findUnique({
          where: {
            tenantId_email: {
              tenantId: tenant.id,
              email: credentials.email.toLowerCase(),
            },
          },
        });
        if (!usuario) return null;

        const senhaValida = await bcrypt.compare(credentials.password, usuario.senhaHash);
        if (!senhaValida) return null;

        return {
          id: usuario.id,
          tenantId: usuario.tenantId,
          role: usuario.role,
          name: usuario.nome,
          email: usuario.email,
        };
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
