import { Check } from "lucide-react";
import { Logo } from "@/components/ui/astro";

// Painel escuro de marca das telas 02 (login) e 03 (cadastro). No mockup ele
// ocupa um terco da tela: a esquerda no login, a direita no cadastro. So
// existe no desktop — no celular a tela inteira ja e escura e ele seria
// repeticao.
//
// O fundo tem duas camadas sobre o azul-escuro da marca: listras diagonais
// muito sutis (dao textura sem virar padrao chamativo) e um brilho radial
// azul deslocado do centro, que e o que da profundidade no desenho.
export function PainelMarca({ modo }: { modo: "login" | "cadastro" }) {
  const eLogin = modo === "login";

  return (
    <aside
      className={`relative hidden overflow-hidden bg-astro-bg lg:flex lg:flex-col lg:justify-between lg:p-10 ${
        eLogin ? "" : "lg:order-2"
      }`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(115deg, rgba(255,255,255,0.028) 0px, rgba(255,255,255,0.028) 2px, transparent 2px, transparent 20px)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(60% 45% at 78% 34%, rgba(37,99,235,0.42) 0%, rgba(37,99,235,0) 70%)",
        }}
      />

      {/* Topo */}
      <div className="relative flex items-center gap-3">
        <span className="astro-label rounded border border-white/10 bg-white/5 px-2 py-1 !text-white/50">
          Hero · 2026
        </span>
        {eLogin && <Logo className="text-lg text-white" />}
      </div>

      {/* Rodape */}
      <div className="relative">
        <p className="astro-label !text-white/40">
          {eLogin ? "Sua garagem digital" : "Por que Astro"}
        </p>

        {eLogin ? (
          <>
            <h2 className="mt-3 text-3xl font-bold leading-tight text-white">
              Bom ter você de{" "}
              <span className="italic text-astro-blue-bright">volta</span>.
            </h2>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-astro-muted">
              Entre para acompanhar seus agendamentos, veículos e histórico de
              serviços.
            </p>
          </>
        ) : (
          <>
            <h2 className="mt-3 text-3xl font-bold leading-tight text-white">
              Profissionais certificados, agendamento direto.
            </h2>
            <ul className="mt-6 space-y-3">
              {[
                "Sem ligações ou retornos lentos",
                "Receba lembretes automáticos",
                "Pagamento via PIX ou no local",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-white">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-astro-blue">
                    <Check className="h-3 w-3 text-white" strokeWidth={3} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </aside>
  );
}
