// ==================== CONFIGURAÇÃO FIREBASE ====================
const firebaseConfig = {
  apiKey: "AIzaSyAza98u8-NVn9hNbuLwcsaCZX2hXbtVaHk",
  authDomain: "meu-app-de-login.firebaseapp.com",
  projectId: "meu-app-de-login",
  storageBucket: "meu-app-de-login.firebasestorage.app",
  messagingSenderId: "61119567504",
  appId: "1:61119567504:web:556bb893c9eba6c4e12a15",
  measurementId: "G-YY6QTZX57K"
};

// Inicializa Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ==================== LOGIN / LOGOUT ====================
const loginSection = document.getElementById("login-section");
const appSection = document.getElementById("app-section");

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
    document.getElementById("usuario-logado").textContent = user.email;
    carregarDashboard();
    loadClientsUI();
    loadRepsUI();
    loadProductsUI();
    loadAgendamentosUI();
  } else {
    loginSection.classList.remove("hidden");
    appSection.classList.add("hidden");
  }
});

// ==================== CLIENTES ====================
const clientesRef = db.collection("clientes");

document.getElementById("salvar-cliente").addEventListener("click", () => {
  const nome = document.getElementById("cliente-nome").value;
  const whatsapp = document.getElementById("cliente-whatsapp").value;
  if (!nome || !whatsapp) return alert("Preencha todos os campos");

  clientesRef.add({ nome, whatsapp })
    .then(() => {
      document.getElementById("cliente-nome").value = "";
      document.getElementById("cliente-whatsapp").value = "";
    })
    .catch(err => alert("Erro salvar cliente: " + err.message));
});

function loadClientsUI() {
  const lista = document.getElementById("lista-clientes");
  clientesRef.onSnapshot(snapshot => {
    lista.innerHTML = "";
    snapshot.forEach(doc => {
      const c = doc.data();
      const li = document.createElement("li");
      li.className = "flex justify-between items-center p-2 border-b";
      li.innerHTML = `
        ${c.nome} - ${c.whatsapp}
        <div>
          <button onclick="editarCliente('${doc.id}', '${c.nome}', '${c.whatsapp}')" class="bg-yellow-500 text-white px-2 py-1 rounded mr-2">Editar</button>
          <button onclick="excluirCliente('${doc.id}')" class="bg-red-500 text-white px-2 py-1 rounded">Excluir</button>
        </div>
      `;
      lista.appendChild(li);
    });
  });
}

function editarCliente(id, nome, whatsapp) {
  document.getElementById("cliente-nome").value = nome;
  document.getElementById("cliente-whatsapp").value = whatsapp;

  document.getElementById("salvar-cliente").onclick = () => {
    clientesRef.doc(id).update({
      nome: document.getElementById("cliente-nome").value,
      whatsapp: document.getElementById("cliente-whatsapp").value
    }).then(() => {
      document.getElementById("cliente-nome").value = "";
      document.getElementById("cliente-whatsapp").value = "";
      document.getElementById("salvar-cliente").onclick = salvarClienteOriginal;
    });
  };
}

function excluirCliente(id) {
  clientesRef.doc(id).delete();
}

const salvarClienteOriginal = document.getElementById("salvar-cliente").onclick;

// ==================== IMPORTAR CLIENTES (PLANILHA) ====================
function importarClientes() {
  const input = document.getElementById("upload-excel");
  if (!input.files.length) return alert("Selecione um arquivo .xlsx primeiro!");

  const reader = new FileReader();
  reader.onload = function(e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const clientes = XLSX.utils.sheet_to_json(sheet);

    let count = 0;
    clientes.forEach(c => {
      if (c.Nome && c.WhatsApp) {
        clientesRef.add({ nome: c.Nome, whatsapp: c.WhatsApp })
          .then(() => count++)
          .catch(err => console.error("Erro ao importar cliente:", err));
      }
    });

    alert("Importação concluída!");
  };
  reader.readAsArrayBuffer(input.files[0]);
}

// ==================== REPRESENTANTES ====================
const repsRef = db.collection("representantes");

function loadRepsUI() {
  // implementar como no clientes
}

// ==================== PRODUTOS ====================
const productsRef = db.collection("produtos");

function loadProductsUI() {
  // implementar como no clientes
}

// ==================== AGENDAMENTOS ====================
const agendamentosRef = db.collection("agendamentos");

function loadAgendamentosUI() {
  // implementar CRUD agendamentos
}

// ==================== DASHBOARD & RELATÓRIOS ====================
function carregarDashboard() {
  console.log("Dashboard carregado - aqui entram gráficos e resumos futuros");
}
