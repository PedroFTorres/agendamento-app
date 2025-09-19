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

// ==================== TELAS ====================
const loginPage = document.getElementById("login-page");
const appPage = document.getElementById("app");
const userEmail = document.getElementById("user-email");

// ==================== AUTENTICAÇÃO ====================
document.getElementById("login-btn").addEventListener("click", () => {
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  auth.signInWithEmailAndPassword(email, password)
    .catch(err => alert("Erro no login: " + err.message));
});

document.getElementById("register-btn").addEventListener("click", () => {
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  auth.createUserWithEmailAndPassword(email, password)
    .catch(err => alert("Erro ao registrar: " + err.message));
});

document.getElementById("logout-btn").addEventListener("click", () => {
  auth.signOut();
});

auth.onAuthStateChanged(user => {
  if (user) {
    loginPage.classList.add("hidden");
    appPage.classList.remove("hidden");
    userEmail.textContent = user.email;
    carregarClientes();
  } else {
    loginPage.classList.remove("hidden");
    appPage.classList.add("hidden");
    userEmail.textContent = "-";
  }
});

// ==================== NAVEGAÇÃO ====================
function showPage(pageId) {
  document.querySelectorAll("main section").forEach(sec => sec.classList.add("hidden"));
  document.getElementById(pageId).classList.remove("hidden");
}

// ==================== CRUD CLIENTES ====================
const clientesRef = db.collection("clientes");
const listaClientes = document.getElementById("lista-clientes");

document.getElementById("salvar-cliente").addEventListener("click", () => {
  const nome = document.getElementById("cliente-nome").value;
  const whatsapp = document.getElementById("cliente-whatsapp").value;

  if (!nome || !whatsapp) return alert("Preencha todos os campos!");

  clientesRef.add({ nome, whatsapp })
    .then(() => {
      document.getElementById("cliente-nome").value = "";
      document.getElementById("cliente-whatsapp").value = "";
    })
    .catch(err => alert("Erro ao salvar cliente: " + err.message));
});

function carregarClientes() {
  clientesRef.onSnapshot(snapshot => {
    listaClientes.innerHTML = "";
    snapshot.forEach(doc => {
      const c = doc.data();
      const li = document.createElement("li");
      li.className = "flex justify-between items-center border-b py-2";
      li.innerHTML = `
        <span>${c.nome} - ${c.whatsapp}</span>
        <div>
          <button class="bg-yellow-500 text-white px-2 py-1 rounded mr-2"
            onclick="editarCliente('${doc.id}', '${c.nome}', '${c.whatsapp}')">Editar</button>
          <button class="bg-red-500 text-white px-2 py-1 rounded"
            onclick="excluirCliente('${doc.id}')">Excluir</button>
        </div>
      `;
      listaClientes.appendChild(li);
    });
  });
}

function excluirCliente(id) {
  clientesRef.doc(id).delete().catch(err => alert("Erro ao excluir: " + err.message));
}

function editarCliente(id, nome, whatsapp) {
  const novoNome = prompt("Novo nome:", nome);
  const novoWhatsapp = prompt("Novo WhatsApp:", whatsapp);

  if (novoNome && novoWhatsapp) {
    clientesRef.doc(id).update({ nome: novoNome, whatsapp: novoWhatsapp })
      .catch(err => alert("Erro ao atualizar: " + err.message));
  }
}

// ==================== RELATÓRIOS PDF ====================
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
