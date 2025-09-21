// ================= CONFIG FIREBASE =================
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_AUTH_DOMAIN",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_STORAGE_BUCKET",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ================= ELEMENTOS =================
const loginSection = document.getElementById("login-section");
const appSection = document.getElementById("app-section");
const usuarioLogado = document.getElementById("usuario-logado");

// ================= LOGIN =================
document.getElementById("login-btn").addEventListener("click", () => {
  const email = document.getElementById("login-email").value;
  const senha = document.getElementById("login-senha").value;
  auth.signInWithEmailAndPassword(email, senha)
    .catch(err => alert("Erro no login: " + err.message));
});

document.getElementById("register-btn").addEventListener("click", () => {
  const email = document.getElementById("login-email").value;
  const senha = document.getElementById("login-senha").value;
  auth.createUserWithEmailAndPassword(email, senha)
    .catch(err => alert("Erro ao registrar: " + err.message));
});

document.getElementById("logout-btn").addEventListener("click", () => {
  auth.signOut();
});

auth.onAuthStateChanged(user => {
  if (user) {
    loginSection.classList.add("hidden");
    appSection.classList.remove("hidden");
    usuarioLogado.textContent = user.email;
    showSectionSafe("dashboard");
    atualizarDashboard();
  } else {
    loginSection.classList.remove("hidden");
    appSection.classList.add("hidden");
  }
});

// ================= FUNÇÃO SEÇÕES =================
function showSectionSafe(id) {
  document.querySelectorAll("main section").forEach(sec => sec.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");

  if (id === "clientes") loadClientesUI();
  if (id === "representantes") loadRepresentantesUI();
  if (id === "produtos") loadProdutosUI();
  if (id === "agendamentos") loadAgendamentosUI();
  if (id === "relatorios") aplicarFiltros();
}

// ================= CLIENTES =================
document.getElementById("salvar-cliente").addEventListener("click", async () => {
  const nome = document.getElementById("cliente-nome").value;
  const whatsapp = document.getElementById("cliente-whatsapp").value;
  if (!nome) return;
  await db.collection("clientes").add({ nome, whatsapp });
  document.getElementById("cliente-nome").value = "";
  document.getElementById("cliente-whatsapp").value = "";
  loadClientesUI();
});

async function loadClientesUI() {
  const lista = document.getElementById("lista-clientes");
  lista.innerHTML = "";
  const snapshot = await db.collection("clientes").get();
  snapshot.forEach(doc => {
    const li = document.createElement("li");
    li.textContent = `${doc.data().nome} - ${doc.data().whatsapp}`;
    lista.appendChild(li);
  });
  atualizarDashboard();
}

// ================= REPRESENTANTES =================
document.getElementById("salvar-rep").addEventListener("click", async () => {
  const nome = document.getElementById("rep-nome").value;
  if (!nome) return;
  await db.collection("representantes").add({ nome });
  document.getElementById("rep-nome").value = "";
  loadRepresentantesUI();
});

async function loadRepresentantesUI() {
  const lista = document.getElementById("lista-rep");
  lista.innerHTML = "";
  const snapshot = await db.collection("representantes").get();
  snapshot.forEach(doc => {
    const li = document.createElement("li");
    li.textContent = doc.data().nome;
    lista.appendChild(li);
  });
  atualizarDashboard();
}

// ================= PRODUTOS =================
document.getElementById("salvar-produto").addEventListener("click", async () => {
  const nome = document.getElementById("produto-nome").value;
  const preco = document.getElementById("produto-preco").value;
  if (!nome) return;
  await db.collection("produtos").add({ nome, preco: Number(preco) });
  document.getElementById("produto-nome").value = "";
  document.getElementById("produto-preco").value = "";
  loadProdutosUI();
});

async function loadProdutosUI() {
  const lista = document.getElementById("lista-produtos");
  lista.innerHTML = "";
  const snapshot = await db.collection("produtos").get();
  snapshot.forEach(doc => {
    const li = document.createElement("li");
    li.textContent = `${doc.data().nome} - R$ ${doc.data().preco}`;
    lista.appendChild(li);
  });
  atualizarDashboard();
}

// ================= AGENDAMENTOS =================
document.getElementById("salvar-agenda").addEventListener("click", async () => {
  const data = document.getElementById("agenda-data").value;
  const cliente = document.getElementById("agenda-cliente").value;
  const representante = document.getElementById("agenda-rep").value;
  const produto = document.getElementById("agenda-produto").value;
  const quantidade = Number(document.getElementById("agenda-quantidade").value);
  if (!data || !cliente || !representante || !produto || !quantidade) return;
  await db.collection("agendamentos").add({ data, cliente, representante, produto, quantidade });
  document.getElementById("agenda-data").value = "";
  document.getElementById("agenda-cliente").value = "";
  document.getElementById("agenda-rep").value = "";
  document.getElementById("agenda-produto").value = "";
  document.getElementById("agenda-quantidade").value = "";
  loadAgendamentosUI();
});

async function loadAgendamentosUI() {
  const lista = document.getElementById("lista-agenda");
  lista.innerHTML = "";
  const snapshot = await db.collection("agendamentos").get();
  snapshot.forEach(doc => {
    const a = doc.data();
    const li = document.createElement("li");
    li.textContent = `${a.data} | ${a.cliente} | ${a.produto} | ${a.quantidade} un | Rep: ${a.representante}`;
    lista.appendChild(li);
  });
  atualizarDashboard();
}

// ================= DASHBOARD =================
async function atualizarDashboard() {
  const countClientes = (await db.collection("clientes").get()).size;
  const countRep = (await db.collection("representantes").get()).size;
  const countProdutos = (await db.collection("produtos").get()).size;
  const countAgenda = (await db.collection("agendamentos").get()).size;

  document.getElementById("count-clientes").textContent = countClientes;
  document.getElementById("count-rep").textContent = countRep;
  document.getElementById("count-produtos").textContent = countProdutos;
  document.getElementById("count-agenda").textContent = countAgenda;
}
