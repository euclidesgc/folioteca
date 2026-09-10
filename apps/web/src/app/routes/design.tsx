import { useEffect, useState } from "react";
import { createListCollection } from "@ark-ui/react";
import { ATRIBUTO_DO_TEMA } from "@folioteca/tema";
import { AlternadorDeTema } from "@/shared/components/alternador-de-tema";
import { Button } from "@/shared/components/ui/button";
import { Dialog } from "@/shared/components/ui/dialog";
import { Menu } from "@/shared/components/ui/menu";
import { Select } from "@/shared/components/ui/select";
import { Switch } from "@/shared/components/ui/switch";
import { Tooltip } from "@/shared/components/ui/tooltip";
import { Field } from "@/shared/components/ui/field";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Card } from "@/shared/components/ui/card";
import { Avatar } from "@/shared/components/ui/avatar";
import { Toast } from "@/shared/components/ui/toast";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Pagination } from "@/shared/components/ui/pagination";
import { AccessBadge } from "@/shared/components/access/access-badge";
import { Badge } from "@/shared/components/ui/badge";
import {
  AccessSpine,
  accessSpineVariants,
} from "@/shared/components/access/access-spine";
import { cn } from "@/shared/lib/cn";

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

const ORIGENS_ACESSO = createListCollection({
  items: [
    { label: "Canal", value: "canal" },
    { label: "Pessoa", value: "pessoa" },
    { label: "Privado", value: "privado" },
  ],
});

const ORIGENS = ["canal", "pessoa", "privado"] as const;

const NOMES_DE_ORIGEM: Record<(typeof ORIGENS)[number], string> = {
  canal: "Documento de acesso por canal",
  pessoa: "Documento de acesso por pessoa",
  privado: "Documento de acesso privado",
};

const LINHAS_DA_LISTA = [
  { origem: "canal", titulo: "Política de reembolso" },
  { origem: "pessoa", titulo: "Ata da diretoria" },
  { origem: "privado", titulo: "Rascunho pessoal" },
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
    observador.observe(raiz, { attributeFilter: [ATRIBUTO_DO_TEMA] });
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
    <span data-token={nome} className="font-mono text-xs">
      <span className="text-tinta">{nome}</span>
      {valor ? <span className="text-grafite"> {valor}</span> : null}
    </span>
  );
}

function Cores() {
  const valores = useValoresDeToken(CORES);

  return (
    <ul className="grid grid-cols-2 gap-4 desde-tablet:grid-cols-3">
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
        <li
          key={passo}
          className="grid grid-cols-[10rem_1fr] items-center gap-4"
        >
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

function AmostrasDeVarianteETamanho() {
  return (
    <ul className="flex flex-wrap items-end gap-6">
      <li className="flex flex-col items-start gap-2">
        <Button variant="primary">Primário</Button>
        <Token nome="bg-verdete" />
      </li>
      <li className="flex flex-col items-start gap-2">
        <Button variant="secondary">Secundário</Button>
        <Token nome="border-fio" />
      </li>
      <li className="flex flex-col items-start gap-2">
        <Button variant="ghost">Sutil</Button>
        <Token nome="hover:bg-fio" />
      </li>
      <li className="flex flex-col items-start gap-2">
        <Button variant="destructive">Perigo</Button>
        <Token nome="bg-carimbo" />
      </li>
      <li className="flex flex-col items-start gap-2">
        <Button size="sm">Pequeno</Button>
        <Token nome="h-8 · text-sm" />
      </li>
      <li className="flex flex-col items-start gap-2">
        <Button size="md">Médio</Button>
        <Token nome="h-10 · text-base" />
      </li>
      <li className="flex flex-col items-start gap-2">
        <Button size="lg">Grande</Button>
        <Token nome="h-12 · text-lg" />
      </li>
    </ul>
  );
}

function EstadosDoBotao() {
  return (
    <ul className="flex flex-wrap items-center gap-4">
      <li className="flex flex-col items-start gap-2">
        <Button>Repouso</Button>
        <Token nome="estado: repouso" />
      </li>
      <li className="flex flex-col items-start gap-2">
        <Button className="outline-2 outline-offset-2 outline-verdete">
          Foco
        </Button>
        <Token nome="estado: foco (outline-verdete)" />
      </li>
      <li className="flex flex-col items-start gap-2">
        <Button aria-busy="true" disabled>
          <span
            aria-hidden="true"
            className="size-3.5 animate-spin rounded-amplo border-2 border-papel border-t-transparent"
          />
          Carregando
        </Button>
        <Token nome="estado: carregando (aria-busy)" />
      </li>
      <li className="flex flex-col items-start gap-2">
        <Button disabled>Desabilitado</Button>
        <Token nome="estado: desabilitado" />
      </li>
      <li className="flex flex-col items-start gap-2">
        <Button className="ring-2 ring-carimbo ring-offset-2">Erro</Button>
        <Token nome="estado: erro (ring-carimbo)" />
      </li>
    </ul>
  );
}

function Botao() {
  return (
    <div className="flex flex-col gap-8">
      <AmostrasDeVarianteETamanho />
      <EstadosDoBotao />
      <div className="flex flex-col items-start gap-2">
        <Button className="px-6">Botão com classe de fora</Button>
        <Token nome="px-6 (fora) vence px-4 (padrão)" />
      </div>
    </div>
  );
}

function CampoDeExemplo() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex max-w-sm flex-col gap-2">
        <Field.Root>
          <Field.Label>Nome do documento</Field.Label>
          <Field.Control placeholder="Relatório mensal" />
          <Field.Hint>Aparece na lista como está aqui</Field.Hint>
        </Field.Root>
        <Token nome="border-fio (repouso)" />
      </div>

      <div className="flex max-w-sm flex-col gap-2">
        <Field.Root invalid>
          <Field.Label>E-mail</Field.Label>
          <Field.Control type="email" />
          <Field.Hint>Use o endereço da empresa</Field.Hint>
          <Field.Error>Informe um e-mail válido</Field.Error>
        </Field.Root>
        <Token nome="border-carimbo (erro de validação)" />
      </div>

      {/* motivo: campo de senha fora de <form> é acusado pelo Chrome no console
          a cada carga. O formulário não envia nada e o campo não guarda
          credencial — por isso `off`, e não um papel que o gerenciador de senhas
          tentaria preencher. Sem valor de exemplo: o detector de segredos do PR
          lê texto fixo em campo de senha como senha vazada e reprova. */}
      <form
        className="flex max-w-sm flex-col gap-2"
        onSubmit={(evento) => evento.preventDefault()}
      >
        <Field.Root>
          <Field.Label>Senha</Field.Label>
          <Field.Password autoComplete="off" />
          <Field.Hint>O olho ao lado revela o que foi digitado</Field.Hint>
        </Field.Root>
        <Token nome="pr-11 (vaga do gatilho dentro do campo)" />
      </form>

      <div className="flex max-w-sm flex-col gap-2">
        <Field.Root invalid hasHint={false}>
          <Field.Error>
            Não consegui salvar: a conexão caiu. Tente de novo.
          </Field.Error>
        </Field.Root>
        <Token nome="erro de conexão" />
      </div>
    </div>
  );
}

function SelecaoDeExemplo() {
  return (
    <div className="flex flex-col items-start gap-2">
      <Select.Root collection={ORIGENS_ACESSO} className="w-64">
        <Select.Label>Origem do acesso</Select.Label>
        <Select.Control>
          <Select.Trigger>
            <Select.ValueText placeholder="Selecione" />
          </Select.Trigger>
        </Select.Control>
        <Select.Positioner>
          <Select.Content>
            {ORIGENS_ACESSO.items.map((item) => (
              <Select.Item key={item.value} item={item}>
                <Select.ItemText>{item.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Positioner>
        <Select.HiddenSelect />
      </Select.Root>
      <Token nome="role=combobox" />
    </div>
  );
}

function CaixaDeMarcacaoDeExemplo() {
  return (
    <div className="flex flex-col items-start gap-2">
      <Checkbox.Root>
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
        <Checkbox.Label>Aceito os termos</Checkbox.Label>
        <Checkbox.HiddenInput />
      </Checkbox.Root>
      <Token nome="data-[state=checked]:bg-verdete" />
    </div>
  );
}

function AlternadorDeExemplo() {
  return (
    <div className="flex flex-col items-start gap-2">
      <Switch.Root>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <Switch.Label>Mostrar arquivados</Switch.Label>
        <Switch.HiddenInput />
      </Switch.Root>
      <Token nome="data-[state=checked]:bg-verdete" />
    </div>
  );
}

function LegendaDoFilete() {
  return (
    <ul className="flex flex-col gap-2 desde-tablet:flex-row desde-tablet:flex-wrap desde-tablet:items-center desde-tablet:gap-6">
      {ORIGENS.map((origem) => (
        <li key={origem} className="flex items-center gap-2">
          <AccessSpine origin={origem} />
          <Token nome={`accessSpineVariants → ${origem}`} />
        </li>
      ))}
    </ul>
  );
}

function CartoesDeDocumento() {
  return (
    <ul className="grid grid-cols-1 gap-4 desde-tablet:grid-cols-3">
      {ORIGENS.map((origem) => (
        <li key={origem}>
          <Card
            as="article"
            aria-label={NOMES_DE_ORIGEM[origem]}
            className={cn(
              "flex flex-col gap-3",
              accessSpineVariants({ origin: origem }),
            )}
          >
            <AccessBadge origin={origem} />
            <p className="font-display text-base font-semibold">
              Plano de contas 2026
            </p>
          </Card>
        </li>
      ))}
    </ul>
  );
}

function CartaoDeExemplo() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex max-w-sm flex-col items-start gap-2">
        <Card className="w-full">
          <p className="font-display text-lg font-semibold">
            Relatório de operações
          </p>
          <p className="text-sm text-grafite">Atualizado agora há pouco.</p>
        </Card>
        <Token nome="shadow-repouso · rounded-padrao" />
      </div>
      <CartoesDeDocumento />
      <LegendaDoFilete />
    </div>
  );
}

function ListaDensaDeAcesso() {
  return (
    <ul
      aria-label="Lista densa de acesso"
      className="flex flex-col divide-y divide-fio rounded-padrao border border-fio"
    >
      {LINHAS_DA_LISTA.map((linha) => (
        <li
          key={linha.titulo}
          className="flex items-center justify-between gap-4 px-4 py-2"
        >
          <span className="text-sm text-tinta">{linha.titulo}</span>
          <AccessBadge origin={linha.origem} reduced />
        </li>
      ))}
    </ul>
  );
}

function EtiquetaDeExemplo() {
  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-wrap items-center gap-4">
        <li className="flex flex-col items-start gap-2">
          <AccessBadge origin="canal" />
          <Token nome="AccessBadge origin=canal (normal)" />
        </li>
        <li className="flex flex-col items-start gap-2">
          <AccessBadge origin="canal" reduced />
          <Token nome="AccessBadge origin=canal (reduzida)" />
        </li>
        <li className="flex flex-col items-start gap-2">
          <Badge tone="neutro">Rascunho</Badge>
          <Token nome="tone=neutro" />
        </li>
        <li className="flex flex-col items-start gap-2">
          <Badge tone="acao">Publicado</Badge>
          <Token nome="tone=acao" />
        </li>
      </ul>
      <ListaDensaDeAcesso />
    </div>
  );
}

function AvatarDeExemplo() {
  return (
    <ul className="flex flex-wrap items-end gap-6">
      <li className="flex flex-col items-center gap-2">
        <Avatar name="Maria Fontoura" size="sm" />
        <Token nome="size=sm" />
      </li>
      <li className="flex flex-col items-center gap-2">
        <Avatar name="Maria Fontoura" size="md" />
        <Token nome="size=md" />
      </li>
      <li className="flex flex-col items-center gap-2">
        <Avatar name="Maria Fontoura" size="lg" />
        <Token nome="size=lg" />
      </li>
    </ul>
  );
}

function MenuDeExemplo() {
  return (
    <div className="flex flex-col items-start gap-2">
      <Menu.Root>
        <Menu.Trigger>Abrir menu de exemplo</Menu.Trigger>
        <Menu.Positioner>
          <Menu.Content>
            <Menu.Item value="canal">
              <Menu.ItemText>Canal</Menu.ItemText>
            </Menu.Item>
            <Menu.Item value="pessoa">
              <Menu.ItemText>Pessoa</Menu.ItemText>
            </Menu.Item>
            <Menu.Item value="privado">
              <Menu.ItemText>Privado</Menu.ItemText>
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Menu.Root>
      <Token nome="rounded-amplo · shadow-eleva" />
    </div>
  );
}

function DialogoDeExemplo() {
  const [concedido, setConcedido] = useState(false);

  return (
    <div className="flex flex-col items-start gap-2">
      <Dialog.Root onOpenChange={() => setConcedido(false)}>
        <Dialog.Trigger>Abrir diálogo de exemplo</Dialog.Trigger>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Title>Conceder acesso</Dialog.Title>
            <label className="flex flex-col gap-1 text-sm text-tinta">
              Nome
              <input
                type="text"
                className="rounded-padrao border border-fio bg-papel px-3 py-2 text-tinta"
              />
            </label>
            <div className="flex justify-end gap-2">
              <Dialog.CloseTrigger>Cancelar</Dialog.CloseTrigger>
              <Button onClick={() => setConcedido(true)}>Conceder</Button>
            </div>
            {concedido ? <Toast tone="sucesso">Concedido</Toast> : null}
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
      <Token nome="--duracao-rapida · --curva-padrao" />
    </div>
  );
}

function AvisoTemporarioDeExemplo() {
  const [publicado, setPublicado] = useState(false);

  return (
    <div className="flex flex-col items-start gap-2">
      <Button onClick={() => setPublicado(true)}>Publicar</Button>
      {publicado ? <Toast tone="sucesso">Publicado</Toast> : null}
      <Token nome="role=status" />
    </div>
  );
}

function CampoComDica() {
  return (
    <div className="flex flex-col items-start gap-2">
      <Tooltip.Root openDelay={0} closeDelay={0}>
        <Tooltip.Trigger>Campo com dica</Tooltip.Trigger>
        <Tooltip.Positioner>
          <Tooltip.Content>Use o nome que aparece na lista</Tooltip.Content>
        </Tooltip.Positioner>
      </Tooltip.Root>
      <Token nome="--duracao-rapida" />
    </div>
  );
}

function EsqueletoDeExemplo() {
  return (
    <div
      data-testid="amostra-esqueleto"
      className="flex max-w-sm flex-col gap-3"
    >
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Token nome="animate-pulse · bg-fio" />
    </div>
  );
}

function EstadoVazioDeExemplo() {
  return (
    <div className="max-w-sm">
      <EmptyState
        title="Nenhum documento por aqui"
        description="Publique o primeiro para que ele apareça nesta lista."
        action={<Button size="sm">Publicar documento</Button>}
      />
      <div className="mt-2">
        <Token nome="border-dashed border-fio" />
      </div>
    </div>
  );
}

function PaginacaoDeExemplo() {
  const [pagina, setPagina] = useState(1);
  return (
    <div className="flex flex-col items-start gap-2">
      <Pagination page={pagina} total={5} onChange={setPagina} />
      <Token nome={`página ${pagina} de 5`} />
    </div>
  );
}

export function PaginaViva() {
  return (
    <div className="min-h-dvh bg-papel text-tinta">
      <div className="flex flex-col gap-16 px-6 py-16">
        {/* motivo: esta página abre sem sessão e fora do esqueleto, então não
            herda o menu de conta. Sem o alternador aqui, não há como medir os
            dois temas contra ela sem recarregar. */}
        <div className="flex justify-end">
          <AlternadorDeTema />
        </div>
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

        <Secao
          id="botao"
          titulo="Botão"
          resumo="Quatro variantes e três tamanhos, declarados em cva, mais os estados que o botão atravessa: repouso, foco, carregando, desabilitado e erro."
        >
          <Botao />
        </Secao>

        <Secao
          id="campo"
          titulo="Campo"
          resumo="O rótulo, a dica e o erro chegam ao controle por associação de id: aria-describedby alcança as duas, aria-invalid marca o erro, e a borda muda de cor sem depender só dela."
        >
          <CampoDeExemplo />
        </Secao>

        <Secao
          id="selecao"
          titulo="Seleção"
          resumo="Um combobox acessível: Enter abre, as setas navegam, Enter escolhe."
        >
          <SelecaoDeExemplo />
        </Secao>

        <Secao
          id="caixa-de-marcacao"
          titulo="Caixa de marcação"
          resumo="Sobre a mesma base headless do alternador, com papel e estado marcado no elemento nativo escondido."
        >
          <CaixaDeMarcacaoDeExemplo />
        </Secao>

        <Secao
          id="alternador"
          titulo="Alternador"
          resumo="Um switch com papel e estado marcado no elemento nativo escondido."
        >
          <AlternadorDeExemplo />
        </Secao>

        <Secao
          id="cartao"
          titulo="Cartão"
          resumo="A superfície de repouso da linguagem, e a base de onde o filete de acesso nasce: accessSpineVariants aplicado no próprio elemento do cartão, para que a borda esquerda computada seja o filete."
        >
          <CartaoDeExemplo />
        </Secao>

        <Secao
          id="etiqueta"
          titulo="Etiqueta"
          resumo="A mesma etiqueta em duas variantes: a normal e a reduzida, que perde tamanho, nunca informação — a marca e o rótulo continuam os dois presentes a doze pixels."
        >
          <EtiquetaDeExemplo />
        </Secao>

        <Secao
          id="avatar"
          titulo="Avatar"
          resumo="Iniciais como retorno sem imagem, em três tamanhos."
        >
          <AvatarDeExemplo />
        </Secao>

        <Secao
          id="dialogo"
          titulo="Diálogo"
          resumo="Foco preso enquanto aberto; Esc fecha e devolve o foco a quem abriu."
        >
          <DialogoDeExemplo />
        </Secao>

        <Secao
          id="menu"
          titulo="Menu"
          resumo="Um menu flutuante sobre a base headless, com foco e Esc geridos dentro do primitivo."
        >
          <MenuDeExemplo />
        </Secao>

        <Secao
          id="aviso-temporario"
          titulo="Aviso temporário"
          resumo="O mesmo verbo do botão que o dispara: publicar leva a publicado, nunca a enviado ou a sucesso."
        >
          <AvisoTemporarioDeExemplo />
        </Secao>

        <Secao
          id="dica"
          titulo="Dica"
          resumo="Abre no foco do teclado e no ponteiro, com o mesmo atraso — zero — para as duas entradas."
        >
          <CampoComDica />
        </Secao>

        <Secao
          id="esqueleto-de-carregamento"
          titulo="Esqueleto de carregamento"
          resumo="Ocupa o lugar do conteúdo enquanto ele carrega, com dimensão própria — e continua ocupando esse lugar sob movimento reduzido."
        >
          <EsqueletoDeExemplo />
        </Secao>

        <Secao
          id="estado-vazio"
          titulo="Estado vazio"
          resumo="Título, descrição e uma ação — nunca um vazio sem saída."
        >
          <EstadoVazioDeExemplo />
        </Secao>

        <Secao
          id="paginacao"
          titulo="Paginação"
          resumo="Uma página por vez, a atual marcada por aria-current."
        >
          <PaginacaoDeExemplo />
        </Secao>
      </div>
    </div>
  );
}
