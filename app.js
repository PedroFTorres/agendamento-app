// ==================== Firebase Config ====================
const firebaseConfig = {
  apiKey: "AIzaSyAza98u8-NVn9hNbuLwcsaCZX2hXbtVaHk",
  authDomain: "meu-app-de-login.firebaseapp.com",
  projectId: "meu-app-de-login",
  storageBucket: "meu-app-de-login.firebasestorage.app",
  messagingSenderId: "61119567504",
  appId: "1:61119567504:web:556bb893c9eba6c4e12a15",
  measurementId: "G-YY6QTZX57K"
};

// Inicialização
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ==================== LOGIN / LOGOUT ====================
auth.onAuthStateChanged((user) => {
  if (user) {
    document.getElementById("user-email").textContent = user.email;
  } else {
    window.location.href = "login.html"; // redireciona caso não logado
  }
});

const logoutBtn = document.getElementById("logout-btn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await auth.signOut();
      window.location.href = "login.html";
    } catch (error) {
      alert("Erro ao sair: " + error.message);
    }
  });
}

// ==================== DASHBOARD ====================
async function atualizarDashboard() {
  const clientes = await db.collection("clientes").get();
  const representantes = await db.collection("representantes").get();
  const produtos = await db.collection("produtos").get();
  const agendamentos = await db.collection("agendamentos").get();

  document.getElementById("resumo-clientes").textContent = clientes.size;
  document.getElementById("resumo-representantes").textContent = representantes.size;
  document.getElementById("resumo-produtos").textContent = produtos.size;
  document.getElementById("resumo-agendamentos").textContent = agendamentos.size;

  desenharGraficos(agendamentos);
}
atualizarDashboard();

function desenharGraficos(agendamentos) {
  const reps = {};
  const clientes = {};

  agendamentos.forEach((doc) => {
    const data = doc.data();
    reps[data.representante] = (reps[data.representante] || 0) + data.quantidade;
    clientes[data.cliente] = (clientes[data.cliente] || 0) + data.quantidade;
  });

  new Chart(document.getElementById("grafico-representantes"), {
    type: "bar",
    data: {
      labels: Object.keys(reps),
      datasets: [{ label: "Quantidade", data: Object.values(reps), backgroundColor: "lightblue" }]
    }
  });

  new Chart(document.getElementById("grafico-clientes"), {
    type: "bar",
    data: {
      labels: Object.keys(clientes),
      datasets: [{ label: "Quantidade", data: Object.values(clientes), backgroundColor: "lightblue" }]
    }
  });
}

// ==================== CRUD CLIENTES ====================
const formClientes = document.getElementById("form-clientes");
if (formClientes) {
  formClientes.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nome = document.getElementById("cliente-nome").value;
    const whatsapp = document.getElementById("cliente-whatsapp").value;
    try {
      await db.collection("clientes").add({ nome, whatsapp });
      formClientes.reset();
      carregarClientes();
    } catch (err) {
      alert("Erro ao salvar cliente: " + err.message);
    }
  });
}

async function carregarClientes() {
  const lista = document.getElementById("lista-clientes");
  lista.innerHTML = "";
  const snap = await db.collection("clientes").get();
  snap.forEach((doc) => {
    const data = doc.data();
    lista.innerHTML += `<div class="flex justify-between p-2 bg-gray-200">
      <span>${data.nome} - ${data.whatsapp}</span>
    </div>`;
  });
}
carregarClientes();

// Importar clientes por planilha
const importClientes = document.getElementById("import-clientes");
if (importClientes) {
  importClientes.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const clientes = XLSX.utils.sheet_to_json(sheet);
    for (let c of clientes) {
      await db.collection("clientes").add({ nome: c.Nome, whatsapp: c.WhatsApp });
    }
    carregarClientes();
  });
}

// ==================== CRUD REPRESENTANTES ====================
const formRepresentantes = document.getElementById("form-representantes");
if (formRepresentantes) {
  formRepresentantes.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nome = document.getElementById("representante-nome").value;
    try {
      await db.collection("representantes").add({ nome });
      formRepresentantes.reset();
      carregarRepresentantes();
    } catch (err) {
      alert("Erro ao salvar representante: " + err.message);
    }
  });
}

async function carregarRepresentantes() {
  const lista = document.getElementById("lista-representantes");
  lista.innerHTML = "";
  const snap = await db.collection("representantes").get();
  snap.forEach((doc) => {
    const data = doc.data();
    lista.innerHTML += `<div class="flex justify-between p-2 bg-gray-200">
      <span>${data.nome}</span>
    </div>`;
  });
}
carregarRepresentantes();

// ==================== CRUD PRODUTOS ====================
const formProdutos = document.getElementById("form-produtos");
if (formProdutos) {
  formProdutos.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nome = document.getElementById("produto-nome").value;
    const preco = document.getElementById("produto-preco").value;
    try {
      await db.collection("produtos").add({ nome, preco });
      formProdutos.reset();
      carregarProdutos();
    } catch (err) {
      alert("Erro ao salvar produto: " + err.message);
    }
  });
}

async function carregarProdutos() {
  const lista = document.getElementById("lista-produtos");
  lista.innerHTML = "";
  const snap = await db.collection("produtos").get();
  snap.forEach((doc) => {
    const data = doc.data();
    lista.innerHTML += `<div class="flex justify-between p-2 bg-gray-200">
      <span>${data.nome} - R$ ${data.preco}</span>
    </div>`;
  });
}
carregarProdutos();

// ==================== CRUD AGENDAMENTOS ====================
const formAgendamentos = document.getElementById("form-agendamentos");
if (formAgendamentos) {
  formAgendamentos.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = document.getElementById("agendamento-data").value;
    const cliente = document.getElementById("agendamento-cliente").value;
    const produto = document.getElementById("agendamento-produto").value;
    const quantidade = parseInt(document.getElementById("agendamento-quantidade").value);
    try {
      await db.collection("agendamentos").add({ data, cliente, produto, quantidade });
      formAgendamentos.reset();
      carregarAgendamentos();
    } catch (err) {
      alert("Erro ao salvar agendamento: " + err.message);
    }
  });
}

async function carregarAgendamentos() {
  const lista = document.getElementById("lista-agendamentos");
  lista.innerHTML = "";
  const snap = await db.collection("agendamentos").get();
  snap.forEach((doc) => {
    const data = doc.data();
    lista.innerHTML += `<div class="flex justify-between p-2 bg-gray-200">
      <span>${data.data} - ${data.cliente} - ${data.produto} (${data.quantidade})</span>
    </div>`;
  });
}
carregarAgendamentos();
