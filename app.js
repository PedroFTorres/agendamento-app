// ==================== Firebase Config ====================
const firebaseConfig = {
  apiKey: "AIzaSyAza98u8-NVn9hNbuLwcsaCZX2hXbtVaHk",
  authDomain: "meu-app-de-login.firebaseapp.com",
  projectId: "meu-app-de-login",
  storageBucket: "meu-app-de-login.appspot.com",
  messagingSenderId: "61119567504",
  appId: "1:61119567504:web:556bb893c9eba6c4e12a15",
  measurementId: "G-YY6QTZX57K"
};

// Inicializa Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ==================== Autenticação ====================
const loginPage = document.getElementById("loginPage");
const appPage = document.getElementById("app");
const userEmailDisplay = document.getElementById("userEmail");

document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;
  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (error) {
    alert("Erro no login: " + error.message);
  }
});

document.getElementById("registerBtn").addEventListener("click", async () => {
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;
  try {
    await auth.createUserWithEmailAndPassword(email, password);
    alert("Conta criada com sucesso!");
  } catch (error) {
    alert("Erro no cadastro: " + error.message);
  }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await auth.signOut();
});

auth.onAuthStateChanged((user) => {
  if (user) {
    loginPage.classList.add("hidden");
    appPage.classList.remove("hidden");
    userEmailDisplay.textContent = user.email;
    loadDashboard();
    loadClientsUI();
    loadRepresentantesUI();
    loadProdutosUI();
  } else {
    loginPage.classList.remove("hidden");
    appPage.classList.add("hidden");
    userEmailDisplay.textContent = "-";
  }
});

// ==================== Navegação ====================
const pages = {
  dashboard: document.getElementById("dashboardPage"),
  clientes: document.getElementById("clientesPage"),
  representantes: document.getElementById("representantesPage"),
  produtos: document.getElementById("produtosPage"),
  relatorios: document.getElementById("relatoriosPage")
};

document.querySelectorAll("aside button[data-page]").forEach((btn) => {
  btn.addEventListener("click", () => {
    Object.values(pages).forEach((p) => p.classList.add("hidden"));
    pages[btn.dataset.page].classList.remove("hidden");
  });
});

// ==================== CRUD Clientes ====================
const clientForm = document.getElementById("clientForm");
const clientList = document.getElementById("clientList");

clientForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("clientName").value;
  const whatsapp = document.getElementById("clientWhatsapp").value;
  try {
    await db.collection("clientes").add({ name, whatsapp });
    clientForm.reset();
    loadClientsUI();
  } catch (error) {
    alert("Erro salvar cliente");
  }
});

async function loadClientsUI() {
  clientList.innerHTML = "";
  const snapshot = await db.collection("clientes").get();
  snapshot.forEach((doc) => {
    const li = document.createElement("li");
    li.className = "bg-gray-100 p-2 flex justify-between items-center";
    li.innerHTML = `
      <span>${doc.data().name} - ${doc.data().whatsapp}</span>
      <div>
        <button class="bg-yellow-500 text-white px-2 py-1 rounded mr-2" onclick="editClient('${doc.id}', '${doc.data().name}', '${doc.data().whatsapp}')">Editar</button>
        <button class="bg-red-500 text-white px-2 py-1 rounded" onclick="deleteClient('${doc.id}')">Excluir</button>
      </div>
    `;
    clientList.appendChild(li);
  });
}

async function deleteClient(id) {
  await db.collection("clientes").doc(id).delete();
  loadClientsUI();
}

async function editClient(id, name, whatsapp) {
  const newName = prompt("Editar nome:", name);
  const newWhatsapp = prompt("Editar WhatsApp:", whatsapp);
  if (newName && newWhatsapp) {
    await db.collection("clientes").doc(id).update({ name: newName, whatsapp: newWhatsapp });
    loadClientsUI();
  }
}

// ==================== CRUD Representantes ====================
const repForm = document.getElementById("repForm");
const repList = document.getElementById("repList");

repForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("repName").value;
  await db.collection("representantes").add({ name });
  repForm.reset();
  loadRepresentantesUI();
});

async function loadRepresentantesUI() {
  repList.innerHTML = "";
  const snapshot = await db.collection("representantes").get();
  snapshot.forEach((doc) => {
    const li = document.createElement("li");
    li.className = "bg-gray-100 p-2 flex justify-between items-center";
    li.innerHTML = `
      <span>${doc.data().name}</span>
      <div>
        <button class="bg-yellow-500 text-white px-2 py-1 rounded mr-2" onclick="editRep('${doc.id}', '${doc.data().name}')">Editar</button>
        <button class="bg-red-500 text-white px-2 py-1 rounded" onclick="deleteRep('${doc.id}')">Excluir</button>
      </div>
    `;
    repList.appendChild(li);
  });
}

async function deleteRep(id) {
  await db.collection("representantes").doc(id).delete();
  loadRepresentantesUI();
}

async function editRep(id, name) {
  const newName = prompt("Editar nome:", name);
  if (newName) {
    await db.collection("representantes").doc(id).update({ name: newName });
    loadRepresentantesUI();
  }
}

// ==================== CRUD Produtos ====================
const productForm = document.getElementById("productForm");
const productList = document.getElementById("productList");

productForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("productName").value;
  const category = document.getElementById("productCategory").value;
  const price = parseFloat(document.getElementById("productPrice").value);
  await db.collection("produtos").add({ name, category, price });
  productForm.reset();
  loadProdutosUI();
});

async function loadProdutosUI() {
  productList.innerHTML = "";
  const snapshot = await db.collection("produtos").get();
  snapshot.forEach((doc) => {
    const li = document.createElement("li");
    li.className = "bg-gray-100 p-2 flex justify-between items-center";
    li.innerHTML = `
      <span>${doc.data().name} - ${doc.data().category} - R$ ${doc.data().price.toFixed(2)}</span>
      <div>
        <button class="bg-yellow-500 text-white px-2 py-1 rounded mr-2" onclick="editProduct('${doc.id}', '${doc.data().name}', '${doc.data().category}', ${doc.data().price})">Editar</button>
        <button class="bg-red-500 text-white px-2 py-1 rounded" onclick="deleteProduct('${doc.id}')">Excluir</button>
      </div>
    `;
    productList.appendChild(li);
  });
}

async function deleteProduct(id) {
  await db.collection("produtos").doc(id).delete();
  loadProdutosUI();
}

async function editProduct(id, name, category, price) {
  const newName = prompt("Editar nome:", name);
  const newCategory = prompt("Editar categoria:", category);
  const newPrice = parseFloat(prompt("Editar preço:", price));
  if (newName && newCategory && !isNaN(newPrice)) {
    await db.collection("produtos").doc(id).update({ name: newName, category: newCategory, price: newPrice });
    loadProdutosUI();
  }
}

// ==================== Dashboard ====================
async function loadDashboard() {
  const clientes = await db.collection("clientes").get();
  document.getElementById("countClientes").textContent = clientes.size;

  const produtos = await db.collection("produtos").get();
  document.getElementById("countProdutos").textContent = produtos.size;

  const representantes = await db.collection("representantes").get();
  document.getElementById("countRepresentantes").textContent = representantes.size;

  const agendamentos = await db.collection("agendamentos").get();
  document.getElementById("countAgendamentos").textContent = agendamentos.size;

  loadCharts();
}

// ==================== Relatórios ====================
document.getElementById("generateReport").addEventListener("click", async () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.text("Relatório de Cadastros", 14, 16);

  // Clientes
  const clientesSnapshot = await db.collection("clientes").get();
  const clientes = [];
  clientesSnapshot.forEach((d) => clientes.push([d.data().name, d.data().whatsapp]));
  doc.autoTable({ head: [["Nome", "WhatsApp"]], body: clientes, startY: 20 });

  // Produtos
  const produtosSnapshot = await db.collection("produtos").get();
  const produtos = [];
  produtosSnapshot.forEach((d) => produtos.push([d.data().name, d.data().category, d.data().price]));
  doc.autoTable({ head: [["Nome", "Categoria", "Preço"]], body: produtos, startY: doc.lastAutoTable.finalY + 10 });

  doc.save("relatorio.pdf");
});

// ==================== Gráficos ====================
async function loadCharts() {
  const repsSnapshot = await db.collection("representantes").get();
  const reps = [];
  repsSnapshot.forEach((doc) => reps.push(doc.data().name));

  new Chart(document.getElementById("chartRepresentantes"), {
    type: "bar",
    data: {
      labels: reps,
      datasets: [{ label: "Vendas", data: reps.map(() => Math.floor(Math.random() * 100)), backgroundColor: "blue" }]
    }
  });

  const clientsSnapshot = await db.collection("clientes").get();
  const clients = [];
  clientsSnapshot.forEach((doc) => clients.push(doc.data().name));

  new Chart(document.getElementById("chartClientes"), {
    type: "bar",
    data: {
      labels: clients,
      datasets: [{ label: "Compras", data: clients.map(() => Math.floor(Math.random() * 100)), backgroundColor: "green" }]
    }
  });
}
