"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut, MessageCircle } from "lucide-react";
import { itemAtivo, itensCliente } from "@/components/ui/bottom-nav";

// Barra lateral do cliente no desktop (telas 04, 06, 08, 09, 10, 11 e 13 do
// mockup). Espelha a BottomNav do celular: mesma lista de itens, forma
// diferente. Ela so existe a partir de lg — abaixo disso o menu continua
// sendo a pilula flutuante do rodape.
//
// Client component por causa do usePathname, que marca o item ativo.
export function ClienteSidebar({
  slug,
  usuarioNome,
  usuarioEmail,
  suporteWhatsapp,
}: {
  slug: string;
  usuarioNome: string;
  usuarioEmail: string;
  suporteWhatsapp: string | null;
}) {
  const pathname = usePathname();
  const itens = itensCliente(slug);

  return (
    // Mesmo gradiente da lateral do admin: um azul mais claro so no topo,
    // junto da marca, escurecendo rapido ate quase preto. O claro e um brilho
    // localizado, nao um degrade que percorre a lateral inteira.
    <aside className="hidden w-[248px] shrink-0 flex-col bg-[linear-gradient(180deg,#1e2d4a_0%,#0b1220_28%,#05070f_100%)] lg:flex">
      <div className="px-5 pt-6">
        <Image
          src="/logo-astro-branco.png"
          alt="Astro"
          width={712}
          height={219}
          priority
          className="h-5 w-auto"
        />
      </div>

      <nav className="mt-8 flex-1 px-4">
        <p className="astro-label px-3 pb-2">Menu</p>
        <ul className="space-y-1">
          {itens.map((item) => {
            const ativo = itemAtivo(pathname, item);
            const Icone = item.icone;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={ativo ? "page" : undefined}
                  // Item ativo: azul solido com halo neon ao redor, como no
                  // mockup. O brilho e uma sombra sem deslocamento e com
                  // spread negativo — ela vaza para fora da pilula em vez de
                  // cair embaixo dela, que e o que faz parecer luz e nao sombra.
                  className={
                    ativo
                      ? "flex items-center gap-3 rounded-xl bg-astro-blue px-3 py-2.5 text-sm font-semibold text-white shadow-[0_0_24px_-2px_rgba(37,99,235,0.85)]"
                      : "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-astro-muted transition hover:bg-white/5 hover:text-white"
                  }
                >
                  <Icone className="h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {ativo && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Suporte — so aparece se a estetica cadastrou um WhatsApp nas
          Configuracoes (UC13). Sem numero, o botao nao teria para onde ir. */}
      {suporteWhatsapp && (
        <div className="mx-4 mb-3 rounded-xl bg-white/5 px-4 py-4">
          <p className="astro-label">Suporte</p>
          <p className="mt-1 text-sm font-semibold text-white">Precisa de ajuda?</p>
          <a
            href={`https://wa.me/55${suporteWhatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 transition hover:bg-white/90"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Fale conosco
          </a>
        </div>
      )}

      {/* Usuario logado */}
      <div className="mx-4 mb-5 flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-astro-blue text-xs font-semibold text-white">
          {usuarioNome[0]?.toUpperCase() ?? "U"}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-semibold text-white">{usuarioNome}</p>
          <p className="truncate text-[0.65rem] text-astro-muted">{usuarioEmail}</p>
        </div>
        {/* signOut() em vez de um link para /api/auth/signout: o link abre a
            pagina generica do NextAuth (pede confirmacao) e, ao final, joga o
            usuario na raiz do dominio — que nao pertence a nenhuma estetica.
            Com callbackUrl ele sai num clique e volta para o login DESTA
            estetica, que e de onde ele entrou (RN09). */}
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: `/${slug}/login` })}
          aria-label="Sair"
          className="shrink-0 text-astro-muted transition hover:text-white"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
