import Link from "next/link";

// Painel interno so para facilitar testes manuais durante o desenvolvimento
// (M1/M2). Nao faz parte do produto - remover antes da entrega final.
const links = [
  { href: "/", label: "Landing (placeholder)" },
  { href: "/estetica-teste", label: "Pagina do tenant de teste" },
  { href: "/estetica-teste/login", label: "Login do tenant de teste" },
  { href: "/estetica-teste/agendar", label: "Rota protegida (testa redirect p/ login)" },
  { href: "/estetica-teste/veiculos/novo", label: "Cadastrar veiculo (UC02)" },
  { href: "/qualquer-coisa", label: "Slug inexistente (testa 404)" },
];

export default function DevPage() {
  return (
    <div className="min-h-screen bg-zinc-50 p-8 dark:bg-black">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        Painel de testes (dev)
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        Login de teste: admin@teste.com / senha123
      </p>
      <div className="mt-6 flex flex-col gap-3 max-w-sm">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-lg border border-zinc-200 px-4 py-3 text-zinc-900 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-900"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
