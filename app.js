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
    let count = 0;
    snapshot.forEach(doc => {
      count++;
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
    document.getElementById("count-clientes").textContent = count;
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

// ==================== IMPORTAR CLIENTES VIA PLANILHA ====================
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
