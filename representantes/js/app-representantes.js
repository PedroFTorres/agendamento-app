// ================== Representante logado (simulação) ==================
// Depois vamos trocar por Firebase Auth
const representanteLogado = { id: "sampaio", nome: "Sampaio" };

// ================== Banco de dados em memória (simulado) ==================
// Depois migramos para Firestore
let clientes = [
  { id: "c1", nome: "João", representanteId: "sampaio" },
  { id: "c2", nome: "Maria", representanteId: "outro" }
];
let pedidos = [];

// ================== Navegação ==================
function showPage(page) {
  if (page === "home") renderHome();
  else if (page === "clientes") renderClientes();
  else if (page === "novoPedido") renderNovoPedido();
  else if (page === "meusPedidos") renderMeusPedidos();
}

// ================== Tela Inicial ==================
function renderHome() {
  const html = `
    <div class="welcome">
      <h2>Bem-vindo, ${representanteLogado.nome}</h2>
      <p>Você está conectado ao aplicativo exclusivo de representantes da <b>Cerâmica Fortes</b>.</p>
      <p>Aqui você pode:</p>
      <ul style="text-align:left; max-width:400px; margin:auto;">
        <li>Consultar sua carteira de clientes</li>
        <li>Enviar pedidos de forma rápida</li>
        <li>Acompanhar o status de cada agendamento</li>
      </ul>
      <p style="margin-top:20px; font-size:0.9rem; color:#555;">Cerâmica Fortes © 2025</p>
    </div>
  `;
  document.getElementById("content").innerHTML = html;
}

// ================== Clientes ==================
function renderClientes() {
  const meusClientes = clientes.filter(c => c.representanteId === representanteLogado.id);
  let html = "<h3>Meus Clientes</h3>";
  meusClientes.forEach(c => {
    html += `<div class="card">${c.nome}</div>`;
  });

  // Formulário para cadastrar cliente novo
  html += `
    <h4>Cadastrar novo cliente</h4>
    <input type="text" id="novoClienteNome" placeholder="Nome do cliente">
    <button class="save" onclick="cadastrarCliente()">Cadastrar</button>
  `;

  document.getElementById("content").innerHTML = html;
}

function cadastrarCliente() {
  const nome = document.getElementById("novoClienteNome").value.trim();
  if (!nome) return alert("Digite o nome do cliente.");
  const id = "c" + (clientes.length + 1);
  clientes.push({ id, nome, representanteId: representanteLogado.id });
  alert("Cliente cadastrado!");
  renderClientes();
}

// ================== Novo Pedido ==================
function renderNovoPedido() {
  const meusClientes = clientes.filter(c => c.representanteId === representanteLogado.id);
  let html = `
    <h3>Novo Pedido</h3>
    <label>Cliente</label>
    <select id="pedidoCliente">
      ${meusClientes.map(c => `<option value="${c.id}">${c.nome}</option>`).join("")}
    </select>
    <label>Produto</label>
    <input type="text" id="pedidoProduto" placeholder="Ex: Telha Colonial">
    <label>Quantidade</label>
    <input type="number" id="pedidoQtd" placeholder="Ex: 2000">
    <button class="save" onclick="salvarPedido()">Enviar Pedido</button>
  `;
  document.getElementById("content").innerHTML = html;
}

function salvarPedido() {
  const clienteId = document.getElementById("pedidoCliente").value;
  const produto = document.getElementById("pedidoProduto").value.trim();
  const qtd = Number(document.getElementById("pedidoQtd").value);

  if (!clienteId || !produto || !qtd) return alert("Preencha todos os campos!");

  pedidos.push({
    id: "p" + (pedidos.length + 1),
    clienteId,
    representanteId: representanteLogado.id,
    produto,
    quantidade: qtd,
    status: "pendente",   // admin vai aprovar depois
    dataAgendada: null
  });

  alert("Pedido enviado! Aguarde aprovação.");
  renderMeusPedidos();
}

// ================== Meus Pedidos ==================
function renderMeusPedidos() {
  const meusPedidos = pedidos.filter(p => p.representanteId === representanteLogado.id);
  let html = "<h3>Meus Pedidos</h3>";
  if (meusPedidos.length === 0) {
    html += "<p>Você ainda não fez pedidos.</p>";
  } else {
    meusPedidos.forEach(p => {
      const cliente = clientes.find(c => c.id === p.clienteId);
      html += `
        <div class="card">
          <b>Cliente:</b> ${cliente.nome}<br>
          <b>Produto:</b> ${p.produto}<br>
          <b>Quantidade:</b> ${p.quantidade}<br>
          <b>Status:</b> ${p.status}<br>
          <b>Data:</b> ${p.dataAgendada || "Aguardando admin"}
        </div>
      `;
    });
  }
  document.getElementById("content").innerHTML = html;
}

// ================== Início ==================
window.onload = () => showPage("home");
