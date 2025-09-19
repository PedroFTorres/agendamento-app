// ==================== CONFIGURAÇÃO FIREBASE ====================
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};

// Inicializa Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ==================== LOGIN E AUTENTICAÇÃO ====================
const loginScreen = document.getElementById("login-screen");
const appScreen = document.getElementById("app-screen");
const userEmail = document.getElementById("user-email");

document.getElementById("login-btn").addEventListener("click", () => {
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  auth.signInWithEmailAndPassword(email, password)
    .then(() => console.log("Login realizado"))
    .catch(err => alert("Erro no login: " + err.message));
});

document.getElementById("register-btn").addEventListener("click", () => {
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  auth.createUserWithEmailAndPassword(email, password)
    .then(() => console.log("Usuário registrado"))
    .catch(err => alert("Erro ao registrar: " + err.message));
});

document.getElementById("logout-btn").addEventListener("click", () => {
  auth.signOut();
});

auth.onAuthStateChanged(user => {
  if (user) {
    loginScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");
    userEmail.textContent = user.email;
  } else {
    loginScreen.classList.remove("hidden");
    appScreen.classList.add("hidden");
    userEmail.textContent = "-";
  }
});

// ==================== NAVEGAÇÃO ENTRE SEÇÕES ====================
function showSection(sectionId) {
  document.querySelectorAll("main section").forEach(sec => sec.classList.add("hidden"));
  document.getElementById(sectionId).classList.remove("hidden");
}

// ==================== CRUD CLIENTES ====================
const clientesRef = db.collection("clientes");
const clientesContent = document.getElementById("clientes-content");

function loadClientes() {
  clientesRef.onSnapshot(snapshot => {
    clientesContent.innerHTML = `
      <input id="cliente-nome" placeholder="Nome" class="border p-2 mr-2">
      <input id="cliente-whatsapp" placeholder="WhatsApp" class="border p-2 mr-2">
      <button onclick="salvarCliente()" class="bg-blue-500 text-white px-3 py-1 rounded">Salvar</button>
      <div class="mt-4"></div>
    `;
    snapshot.forEach(doc => {
      const cliente = doc.data();
      clientesContent.innerHTML += `
        <div class="flex justify-between items-center border-b py-2">
          <span>${cliente.nome} - ${cliente.whatsapp}</span>
          <div>
            <button onclick="editarCliente('${doc.id}','${cliente.nome}','${cliente.whatsapp}')" class="bg-yellow-500 text-white px-2 py-1 rounded mr-2">Editar</button>
            <button onclick="excluirCliente('${doc.id}')" class="bg-red-500 text-white px-2 py-1 rounded">Excluir</button>
          </div>
        </div>
      `;
    });
  });
}

function salvarCliente() {
  const nome = document.getElementById("cliente-nome").value;
  const whatsapp = document.getElementById("cliente-whatsapp").value;
  if (!nome || !whatsapp) return alert("Preencha todos os campos!");

  clientesRef.add({ nome, whatsapp })
    .then(() => {
      document.getElementById("cliente-nome").value = "";
      document.getElementById("cliente-whatsapp").value = "";
    })
    .catch(err => alert("Erro salvar cliente: " + err.message));
}

function excluirCliente(id) {
  clientesRef.doc(id).delete().catch(err => alert("Erro excluir cliente: " + err.message));
}

function editarCliente(id, nome, whatsapp) {
  document.getElementById("cliente-nome").value = nome;
  document.getElementById("cliente-whatsapp").value = whatsapp;

  const btn = document.createElement("button");
  btn.textContent = "Atualizar";
  btn.className = "bg-green-500 text-white px-3 py-1 rounded ml-2";
  btn.onclick = () => {
    clientesRef.doc(id).update({
      nome: document.getElementById("cliente-nome").value,
      whatsapp: document.getElementById("cliente-whatsapp").value
    }).then(() => {
      btn.remove();
    }).catch(err => alert("Erro atualizar: " + err.message));
  };
  clientesContent.appendChild(btn);
}

// ==================== RELATÓRIOS EM PDF ====================
document.getElementById("gerar-pdf").addEventListener("click", async () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.text("Relatório de Clientes", 10, 10);

  const snapshot = await clientesRef.get();
  const data = [];
  snapshot.forEach(docSnap => {
    const c = docSnap.data();
    data.push([c.nome, c.whatsapp]);
  });

  doc.autoTable({
    head: [["Nome", "WhatsApp"]],
    body: data,
    startY: 20
  });

  doc.save("relatorio-clientes.pdf");
});

// ==================== INICIALIZAÇÃO ====================
loadClientes();
showSection("dashboard");
