const PADROES_PROIBIDOS = ["bg-[", "text-[", "p-[", "h-["];

const MARCA_JUSTIFICATIVA =
  /^\s*(\/\/|\/\*)\s*(motivo|por ?qu[êe]|decis[ãa]o|contorno|invariante|limita[çc][ãa]o|restri[çc][ãa]o):/i;

function trechoProibido(texto) {
  return PADROES_PROIBIDOS.find((padrao) => texto.includes(padrao));
}

function linhaAcimaJustificada(sourceCode, linha) {
  const anterior = sourceCode.lines[linha - 2];
  return typeof anterior === "string" && MARCA_JUSTIFICATIVA.test(anterior);
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "reprova sintaxe arbitrária do Tailwind (bg-[, text-[, p-[, h-[) em className sem marca de justificativa na linha acima",
    },
    schema: [],
    messages: {
      valorMagico:
        "valor mágico em className ('{{trecho}}'): use um token do tema ou justifique com uma marca (motivo:, por quê:, decisão:, contorno:, invariante:, limitação:, restrição:) na linha acima.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    function verificar(node, texto) {
      if (typeof texto !== "string") return;
      const trecho = trechoProibido(texto);
      if (!trecho) return;
      if (linhaAcimaJustificada(sourceCode, node.loc.start.line)) return;
      context.report({ node, messageId: "valorMagico", data: { trecho } });
    }

    // motivo: os seletores alcançam o literal em qualquer profundidade dentro do
    // atributo, e não só quando ele é o valor direto. A classe desta casa chega
    // por `className={cn("…", variante({…}), className)}` — os quinze primitivos
    // e toda tela que os componha escrevem assim —, e uma regra que só lesse o
    // valor direto ficaria verde exatamente onde a classe de verdade é escrita:
    // falsa segurança é pior que regra nenhuma, porque ninguém procura de novo.
    return {
      'JSXAttribute[name.name="className"] Literal'(node) {
        verificar(node, node.value);
      },
      'JSXAttribute[name.name="className"] TemplateLiteral'(node) {
        for (const quasi of node.quasis) {
          verificar(quasi, quasi.value.raw);
        }
      },
    };
  },
};
