import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";

// Autocadastro (decisao do Andre, 06/11): a estetica nasce sem grade de
// horarios, e o dono configura no primeiro acesso. Enquanto a grade estiver
// vazia, o site dele nao oferece horario nenhum, entao o Dashboard avisa no
// topo, com o caminho para resolver.
export function AvisoGradeVazia({ slug }: { slug: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden />
        <div>
          <p className="font-semibold text-white">Configure sua grade de horários para começar a receber agendamentos</p>
          <p className="mt-0.5 text-sm text-astro-muted">
            Enquanto ela estiver vazia, seus clientes não encontram horário livre no seu site.
          </p>
        </div>
      </div>
      <Link
        href={`/${slug}/admin/horarios`}
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-astro-blue px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
      >
        Configurar horários
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </div>
  );
}
