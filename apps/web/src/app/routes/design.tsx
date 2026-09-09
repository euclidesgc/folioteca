import { useEffect, useState } from "react";

const CORES = [
  "--color-papel",
  "--color-tinta",
  "--color-grafite",
  "--color-verdete",
  "--color-carimbo",
  "--color-fio",
] as const;

const ESPACOS = [1, 2, 3, 4, 6, 8, 12, 16] as const;

const RAIOS = ["--radius-sutil", "--radius-padrao", "--radius-amplo"] as const;

const SOMBRAS = ["--shadow-repouso", "--shadow-eleva"] as const;

const MOVIMENTO = [
  "--duracao-rapida",
  "--duracao-padrao",
  "--curva-padrao",
] as const;

const FACES = [
  {
    token: "--font-body",
    papel: "Corpo",
    classe: "font-body",
    para: "Parágrafo, rótulo, tabela — tudo que se lê por muito tempo.",
  },
  {
    token: "--font-display",
    papel: "Display",
    classe: "font-display",
    para: "Título e número grande. Aparece pouco, e por isso pode ter voz.",
  },
  {
    token: "--font-mono",
    papel: "Utilitária",
    classe: "font-mono",
    para: "Identificador, valor de token, código de canal.",
  },
] as const;

// motivo: a página lê o valor que o navegador resolveu, em vez de repetir o que o
// arquivo de tema já declara: não há segunda cópia da paleta para divergir da
// primeira. O observador existe porque a troca de tema é uma troca de classe no
// elemento raiz, e classe trocada não dispara renderização em React: sem ele a
// amostra continuaria anunciando o valor do tema anterior — a única forma de
// erro que esta página não pode ter, já que ela é a fonte que as outras leem.
function useValoresDeToken(nomes: readonly string[]) {
  const [valores, setValores] = useState<Record<string, string>>({});

  useEffect(() => {
    const raiz = document.documentElement;
    const ler = () => {
      const estilo = getComputedStyle(raiz);
      setValores(
        Object.fromEntries(
          nomes.map((nome) => [nome, estilo.getPropertyValue(nome).trim()]),
        ),
      );
    };

    ler();
    const observador = new MutationObserver(ler);
    observador.observe(raiz, { attributeFilter: ["class"] });
    return () => observador.disconnect();
  }, [nomes]);

  return valores;
}

function Secao({
  id,
  titulo,
  resumo,
  children,
}: {
  id: string;
  titulo: string;
  resumo: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="border-l-4 border-verdete pl-6">
      <h2 id={id} className="font-display text-2xl font-semibold">
        {titulo}
      </h2>
      <p className="mt-1 max-w-prose text-grafite">{resumo}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Token({ nome, valor }: { nome: string; valor?: string }) {
  return (
    <span className="font-mono text-xs">
      <span className="text-tinta">{nome}</span>
      {valor ? <span className="text-grafite"> {valor}</span> : null}
    </span>
  );
}

function Cores() {
  const valores = useValoresDeToken(CORES);

  return (
    <ul className="grid grid-cols-2 gap-4 telefone:grid-cols-3">
      {CORES.map((nome) => (
        <li
          key={nome}
          className="overflow-hidden rounded-padrao border border-fio shadow-repouso"
        >
          <span
            aria-hidden="true"
            className="block h-20 w-full border-b border-fio"
            style={{ backgroundColor: `var(${nome})` }}
          />
          <span className="block p-3">
            <Token nome={nome} valor={valores[nome]} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function Tipografia() {
  return (
    <ul className="flex flex-col gap-8">
      {FACES.map((face) => (
        <li key={face.token} className="flex flex-col gap-2">
          <Token nome={face.token} />
          <p className={`${face.classe} text-3xl`}>
            {face.papel} — o acesso segue o trabalho
          </p>
          <p className={`${face.classe} text-base text-grafite`}>{face.para}</p>
        </li>
      ))}
    </ul>
  );
}

function Espaco() {
  return (
    <ul className="flex flex-col gap-3">
      {ESPACOS.map((passo) => (
        <li key={passo} className="grid grid-cols-[10rem_1fr] items-center gap-4">
          <Token nome={`--spacing × ${passo}`} />
          <span
            aria-hidden="true"
            className="h-3 rounded-sutil bg-verdete"
            style={{ width: `calc(var(--spacing) * ${passo})` }}
          />
        </li>
      ))}
    </ul>
  );
}

function Raios() {
  const valores = useValoresDeToken(RAIOS);

  return (
    <ul className="flex flex-wrap gap-6">
      {RAIOS.map((nome) => (
        <li key={nome} className="flex flex-col gap-2">
          <span
            aria-hidden="true"
            className="block size-24 border border-fio bg-fio"
            style={{ borderRadius: `var(${nome})` }}
          />
          <Token nome={nome} valor={valores[nome]} />
        </li>
      ))}
    </ul>
  );
}

function Sombras() {
  return (
    <ul className="flex flex-wrap gap-6">
      {SOMBRAS.map((nome) => (
        <li
          key={nome}
          className="flex flex-col gap-2 rounded-padrao border border-fio p-4"
          style={{ boxShadow: `var(${nome})` }}
        >
          <span aria-hidden="true" className="block size-24" />
          <Token nome={nome} />
        </li>
      ))}
    </ul>
  );
}

function Movimento() {
  const valores = useValoresDeToken(MOVIMENTO);

  return (
    <ul className="flex flex-col gap-3">
      {MOVIMENTO.map((nome) => (
        <li key={nome}>
          <Token nome={nome} valor={valores[nome]} />
        </li>
      ))}
    </ul>
  );
}

export function PaginaViva() {
  return (
    <div className="min-h-dvh bg-papel text-tinta">
      <main className="mx-auto flex max-w-4xl flex-col gap-16 px-6 py-16">
        <header className="border-l-4 border-carimbo pl-6">
          <p className="font-mono text-xs tracking-widest text-grafite uppercase">
            Folioteca · linguagem visual
          </p>
          <h1 className="mt-2 font-display text-5xl font-semibold text-balance">
            Página viva
          </h1>
          <p className="mt-4 max-w-prose text-lg text-grafite">
            Cada token desta linguagem aparece aqui na forma em que é usado. É
            contra esta página que a acessibilidade é medida, e é dela que sai a
            prova de que a face vem da própria origem.
          </p>
        </header>

        <Secao
          id="cor"
          titulo="Cor"
          resumo="Seis tokens. O verdete é a ação e a lombada de acesso por canal; o carimbo marca propriedade e concessão individual. O mesmo nome existe nos dois temas, com valores medidos para manter o contraste."
        >
          <Cores />
        </Secao>

        <Secao
          id="tipografia"
          titulo="Tipografia"
          resumo="Três faces auto-hospedadas, servidas pela própria origem. Nenhum componente as nomeia — a face chega pelo token."
        >
          <Tipografia />
        </Secao>

        <Secao
          id="espaco"
          titulo="Espaço"
          resumo="Uma unidade base, multiplicada. Todo afastamento nasce dela."
        >
          <Espaco />
        </Secao>

        <Secao
          id="raio"
          titulo="Raio"
          resumo="Três degraus: o fio quase reto, o padrão de cartão e o amplo de superfície flutuante."
        >
          <Raios />
        </Secao>

        <Secao
          id="sombra"
          titulo="Sombra"
          resumo="Duas alturas. A de repouso separa o cartão do papel; a de elevação anuncia o que flutua."
        >
          <Sombras />
        </Secao>

        <Secao
          id="movimento"
          titulo="Movimento"
          resumo="Duas durações e uma curva. Sob preferência por movimento reduzido, a animação some e o estado final permanece."
        >
          <Movimento />
        </Secao>
      </main>
    </div>
  );
}
