// ================================
// Firebase Config
// ================================
const firebaseConfig = {
  apiKey: "AIzaSyAza98u8-NVn9hNbuLwcsaCZX2hXbtVaHk",
  authDomain: "meu-app-de-login.firebaseapp.com",
  projectId: "meu-app-de-login",
  storageBucket: "meu-app-de-login.appspot.com",
  messagingSenderId: "61119567504",
  appId: "1:61119567504:web:556bb893c9eba6c4e12a15",
  measurementId: "G-YY6QTZX57K"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ================================
// Controle de autenticação
// ================================
auth.onAuthStateChanged(user => {
  if (user) {
    if (window.location.pathname.includes("login.html")) {
      window.location.href = "index.html";
    }
    const emailSpan = document.getElementById("user-email");
    if (emailSpan) emailSpan.textContent = user.email;
  } else {
    if (window.location.pathname.includes("index.html")) {
      window.location.href = "login.html";
    }
  }
});

// ================================
// Login
// ================================
const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", e => {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    auth.signInWithEmailAndPassword(email, password)
      .then(() => console.log("Login realizado"))
      .catch(err => alert("Erro: " + err.message));
  });
}

// ================================
// Cadastro de usuário
// ================================
const signupForm = document.getElementById("signup-form");
if (signupForm) {
  signupForm.addEventListener("submit", e => {
    e.preventDefault();
    const email = document.getElementById("signup-email").value;
    const password = document.getElementById("signup-password").value;
    auth.createUserWithEmailAndPassword(email, password)
      .then(() => console.log("Conta criada"))
      .catch(err => alert("Erro: " + err.message));
  });
}

// ================================
// Logout
// ================================
const logoutBtn = document.getElementById("logout-btn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    auth.signOut();
  });
}

// ================================
// Funções auxiliares de CRUD
// ================================
function createListItem(doc, collectionName, fields) {
  const li = document.createElement("li");
  li.className = "flex justify-between items-center p-2 border-b";

  const text = fields.map(f => doc.data()[f]).join(" | ");
  li.textContent = text;

  const btns = document.createElement("div");
  btns.className = "space-x-2 ml-4";

  const editBtn = document.createElement("button");
  editBtn.textContent = "Editar";
  editBtn.className = "bg-yellow-500 text-white px-2 py-1 rounded";
  editBtn.onclick = () => {
    const novosValores = prompt("Digite novos valores separados por vírgula", fields.map(f => doc.data()[f]).join(","));
    if (novosValores) {
      const valoresArray = novosValores.split(",");
      let updateObj = {};
      fields.forEach((f, i) => updateObj[f] = valoresArray[i]?.trim());
      db.collection(collectionName).doc(doc.id).update(updateObj);
    }
  };

  const delBtn = document.createElement("button");
  delBtn.textContent = "Excluir";
  delBtn.className = "bg-red-500 text-white px-2 py-1 rounded";
  delBtn.onclick = () => {
    if (confirm("Tem certeza que deseja excluir?")) {
      db.collection(collectionName).doc(doc.id).delete();
    }
  };

  btns.appendChild(editBtn);
  btns.appendChild(delBtn);
  li.appendChild(btns);

  return li;
}

// ================================
// CRUD Agendamentos
// ================================
const agForm = document.getElementById("agendamento-form");
if (agForm) {
  agForm.addEventListener("submit", async e => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const cliente = document.getElementById("ag-cliente").value;
    const representante = document.getElementById("ag-rep").value;
    const produto = document.getElementById("ag-prod").value;
    const quantidade = document.getElementById("ag-quantidade").value;
    const data = document.getElementById("ag-data").value;

    await db.collection("agendamentos").add({
      cliente,
      representante,
      produto,
      quantidade,
      data,
      userId: user.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    agForm.reset();
  });

  db.collection("agendamentos").onSnapshot(snapshot => {
    const list = document.getElementById("ag-list");
    if (!list) return;
    list.innerHTML = "";
    snapshot.forEach(doc => {
      if (auth.currentUser && doc.data().userId === auth.currentUser.uid) {
        list.appendChild(createListItem(doc, "agendamentos", ["cliente", "representante", "produto", "quantidade", "data"]));
      }
    });
  });
}

// ================================
// Relatórios + Gráficos
// ================================
async function gerarRelatorio(filtroInicio, filtroFim) {
  const user = auth.currentUser;
  if (!user) return;

  let query = db.collection("agendamentos").where("userId", "==", user.uid);
  if (filtroInicio) query = query.where("data", ">=", filtroInicio);
  if (filtroFim) query = query.where("data", "<=", filtroFim);

  const snapshot = await query.get();

  let totalPorProduto = {};
  let totalPorRep = {};
  let totalPorCliente = {};
  let totalGeral = 0;

  snapshot.forEach(doc => {
    const ag = doc.data();
    const qtd = parseInt(ag.quantidade) || 0;

    totalPorProduto[ag.produto] = (totalPorProduto[ag.produto] || 0) + qtd;
    totalPorRep[ag.representante] = (totalPorRep[ag.representante] || 0) + qtd;
    totalPorCliente[ag.cliente] = (totalPorCliente[ag.cliente] || 0) + qtd;
    totalGeral += qtd;
  });

  // Mostra no HTML
  const container = document.getElementById("reports-section");
  if (container) {
    container.innerHTML = `
      <h2 class="text-2xl font-bold mb-4">Relatório</h2>
      <p><strong>Total Geral:</strong> ${totalGeral}</p>
      <h3 class="font-semibold mt-4">Por Produto</h3>
      <pre>${JSON.stringify(totalPorProduto, null, 2)}</pre>
      <h3 class="font-semibold mt-4">Por Representante</h3>
      <canvas id="chartRep" width="400" height="200"></canvas>
      <h3 class="font-semibold mt-4">Por Cliente</h3>
      <canvas id="chartCliente" width="400" height="200"></canvas>
      <button id="btn-pdf" class="mt-4 bg-blue-600 text-white px-4 py-2 rounded">Exportar PDF</button>
    `;

    // Gráfico representantes
    const ctx1 = document.getElementById("chartRep");
    new Chart(ctx1, {
      type: "bar",
      data: {
        labels: Object.keys(totalPorRep),
        datasets: [{
          label: "Vendas por representante",
          data: Object.values(totalPorRep),
          backgroundColor: "rgba(255,99,132,0.6)"
        }]
      }
    });

    // Gráfico clientes
    const ctx2 = document.getElementById("chartCliente");
    new Chart(ctx2, {
      type: "bar",
      data: {
        labels: Object.keys(totalPorCliente),
        datasets: [{
          label: "Compras por cliente",
          data: Object.values(totalPorCliente),
          backgroundColor: "rgba(54,162,235,0.6)"
        }]
      }
    });

    // Exportar PDF
    document.getElementById("btn-pdf").addEventListener("click", () => {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF();
      pdf.text("Relatório de Agendamentos", 10, 10);
      pdf.text("Total Geral: " + totalGeral, 10, 20);
      pdf.text("Por Produto: " + JSON.stringify(totalPorProduto), 10, 30);
      pdf.text("Por Representante: " + JSON.stringify(totalPorRep), 10, 40);
      pdf.text("Por Cliente: " + JSON.stringify(totalPorCliente), 10, 50);
      pdf.save("relatorio.pdf");
    });
  }
}
