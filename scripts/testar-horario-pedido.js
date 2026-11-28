const fs = require("fs");

const pedidos = fs.readFileSync("js/pedidos.js", "utf8");
const filtros = fs.readFileSync("js/pedidos-filtros.js", "utf8");

const verificacoes = [
  [
    filtros.includes('id="p-horario-chegada" type="time"') &&
      filtros.includes('id="p-horario-chegada" type="time" class="border p-2 rounded w-full" required'),
    "O horário deve estar marcado como obrigatório no novo pedido."
  ],
  [
    filtros.includes('if (!previsaoHorarioChegada) return alert("Informe o horário do carregamento.");'),
    "O envio deve ser bloqueado quando o horário não for informado."
  ],
  [
    !pedidos.includes('id="horario-aprovacao"'),
    "A aprovação não deve criar outro campo de horário."
  ],
  [
    pedidos.includes("const horarioEscolhido = horarioCarregamento;"),
    "A aprovação deve reutilizar o horário informado no pedido."
  ],
  [
    pedidos.includes("Este pedido antigo não possui horário de carregamento."),
    "Pedidos antigos sem horário devem orientar a edição antes da aprovação."
  ]
];

verificacoes.forEach(([condicao, mensagem]) => {
  if (!condicao) throw new Error(mensagem);
});

console.log("OK: horário obrigatório no pedido e aprovação sem modal duplicado.");
