import { getServerSession } from "next-auth";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { calcularPreco } from "@/lib/precificacao";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant-db";
import { ClienteShell } from "../../cliente-shell";
import { AgendarForm } from "./agendar-form";

// UC03, tela 09 — escolha de data/horario/veiculo. RN04: sem veiculo
// cadastrado, redireciona para o cadastro e retorna aqui depois.
export default async function AgendarPage({
  params,
}: {
  params: Promise<{ slug: string; servicoId: string }>;
}) {
  const { slug, servicoId } = await params;

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) notFound();

  const session = await getServerSession(authOptions);
  if (!session || session.user.tenantId !== tenant.id) {
    redirect(`/${slug}/login?callbackUrl=/${slug}/agendar/${servicoId}`);
  }

  const { servico, veiculos } = await withTenant(tenant.id, async (tx) => {
    // RN14 — servico pausado nao aparece nem pode ser agendado
    const servico = await tx.servico.findFirst({
      where: { id: servicoId, tenantId: tenant.id, ativo: true },
      include: { precos: true },
    });
    // RN15 — so os veiculos ativos entram na escolha.
    const veiculos = await tx.veiculo.findMany({
      where: { usuarioId: session.user.id, ativo: true },
      include: { segmento: true },
    });
    return { servico, veiculos };
  });
  if (!servico) notFound();

  // RN04 — precisa de ao menos um veiculo para agendar.
  if (veiculos.length === 0) {
    redirect(
      `/${slug}/veiculos/novo?callbackUrl=${encodeURIComponent(
        `/${slug}/agendar/${servicoId}`
      )}`
    );
  }

  // RN01 — carro cujo tipo ainda nao tem preco neste servico fica de fora da
  // escolha. Oferecer e deixar o POST recusar depois seria pior: o cliente
  // escolheria o carro e levaria o erro so no fim.
  //
  // Carro de um tipo que a estetica removeu do catalogo e diferente: ele
  // aparece, mas travado e com o motivo. O preco antigo continua guardado
  // (para o historico), entao sem esta conferencia ele seria agendado como se
  // o tipo ainda fosse atendido.
  const veiculosView = veiculos.flatMap((v) => {
    const dados = {
      id: v.id,
      marca: v.marca,
      modelo: v.modelo,
      placa: v.placa,
      ano: v.ano,
      segmento: v.segmento.nome,
    };
    if (!v.segmento.ativo) return [{ ...dados, preco: 0, atendido: false }];

    const preco = calcularPreco(servico.precos, v.segmentoId);
    if (preco === null) return [];
    return [{ ...dados, preco: Number(preco), atendido: true }];
  });

  if (veiculosView.length === 0) {
    redirect(`/${slug}`);
  }

  // Todos os carros do cliente sao de tipos removidos: nao ha o que agendar.
  // Em vez de devolver para a vitrine sem explicacao, diz o motivo e aponta o
  // WhatsApp da estetica para combinar por fora.
  if (!veiculosView.some((v) => v.atendido)) {
    const tipos = [...new Set(veiculosView.map((v) => v.segmento))].join(", ");
    return (
      <ClienteShell
        slug={slug}
        trilha={["Serviços", servico.nome, "Agendar"]}
        titulo="Agendar serviço"
      >
        <div className="mx-auto max-w-md px-5 py-10 lg:px-8">
          <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-zinc-900">
              Tipo de veículo não atendido
            </h2>
            <p className="mt-2 text-sm text-zinc-600">
              A estética não atende mais veículos do tipo {tipos}. Para combinar
              um atendimento, fale com a estética
              {tenant.whatsapp ? " pelo WhatsApp." : " diretamente."}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {tenant.whatsapp && (
                <a
                  href={`https://wa.me/55${tenant.whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-xl bg-astro-blue px-4 py-2.5 text-sm font-semibold text-white"
                >
                  <MessageCircle className="h-4 w-4" />
                  Falar no WhatsApp
                </a>
              )}
              <Link
                href={`/${slug}`}
                className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700"
              >
                Voltar aos serviços
              </Link>
            </div>
          </div>
        </div>
      </ClienteShell>
    );
  }

  return (
    <ClienteShell
      slug={slug}
      trilha={["Serviços", servico.nome, "Agendar"]}
      titulo="Agendar serviço"
    >
      <AgendarForm
        slug={slug}
        tenantId={tenant.id}
        servico={{
          id: servico.id,
          nome: servico.nome,
          duracaoMin: servico.duracaoMin,
        }}
        veiculos={veiculosView}
      />
    </ClienteShell>
  );
}
