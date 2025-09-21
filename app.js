// ==================== CONFIG FIREBASE ====================
const firebaseConfig = {
  apiKey: "AIzaSyAza98u8-NVn9hNbuLwcsaCZX2hXbtVaHk",
  authDomain: "meu-app-de-login.firebaseapp.com",
  projectId: "meu-app-de-login",
  storageBucket: "meu-app-de-login.firebasestorage.app",
  messagingSenderId: "61119567504",
  appId: "1:61119567504:web:556bb893c9eba6c4e12a15",
  measurementId: "G-YY6QTZX57K"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ==================== LOGIN ====================
const loginSection = document.getElementById("login-section");
const appSection = document.getElementById("app-section");
const usuarioLogado = document.getElementById("usuario-logado");

document.getElementById("login-btn").addEventListener("click", async () => {
  const email = document.getElementById("login-email").value;
  const senha = document.getElementById("login-senha").value;
  try {
    await auth.signInWithEmailAndPassword(email, senha);
  } catch (e) {
    alert("Erro no login: " + e.message);
  }
});

document.getElementById("register-btn").addEventListener("click", async () => {
  const email = document.getElementById("login-email").value;
  const senha = document.getElementById("login-senha").value;
  try {
    await auth.createUserWithEmailAndPassword(email, senha);
    alert("Conta criada com sucesso!");
  } catch (e) {
    alert("Erro ao registrar: " + e.message);
  }
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  await auth.signOut();
});

// Estado de autenticação
auth.onAuthStateChanged(user => {
  if (user) {
    loginSection.classList.add("hidden");
    appSection.classList.remove("hidden");
    usuarioLogado.textContent = user.email;
  } else {
    loginSection.classList.remove("hidden");
    appSection.classList.add("hidden");
    usuarioLogado.textContent = "-";
  }
});

// ==================== CRUD CLIENTES ====================
const clienteNome = document.getElementById("cliente-nome");
const clienteWhats = document.getElementById("cliente-whatsapp");
const salvarClienteBtn = document.getElementById("salvar-cliente");
const listaClientes = document.getElementById("lista-clientes");

salvarClienteBtn.addEventListener("click", async () => {
  try {
    await db.collection("clientes").add({
      nome: clienteNome.value,
      whatsapp: clienteWhats.value
    });
    clienteNome.value = "";
    clienteWhats.value = "";
  } catch (e) {
    alert("Erro salvar cliente: " + e.message);
  }
});

function carregarClientes() {
  db.collection("clientes").onSnapshot(snapshot => {
    listaClientes.innerHTML = "";
    snapshot.forEach(doc => {
      const li = document.createElement("li");
      li.className = "flex justify-between items-center p-2 border-b";
      li.innerHTML = `
        ${doc.data().nome} - ${doc.data().whatsapp}
        <div>
          <button onclick="editarCliente('${doc.id}','${doc.data().nome}','${doc.data().whatsapp}')" class="bg-yellow-500 text-white px-2 py-1 rounded">Editar</button>
          <button onclick="excluirCliente('${doc.id}')" class="bg-red-500 text-white px-2 py-1 rounded">Excluir</button>
        </div>`;
      listaClientes.appendChild(li);
    });
  });
}
carregarClientes();

async function excluirCliente(id) {
  await db.collection("clientes").doc(id).delete();
}

async function editarCliente(id, nome, whatsapp) {
  const novoNome = prompt("Novo nome:", nome);
  const novoWhats = prompt("Novo WhatsApp:", whatsapp);
  if (novoNome && novoWhats) {
    await db.collection("clientes").doc(id).update({ nome: novoNome, whatsapp: novoWhats });
  }
}

// ==================== IMPORTAR CLIENTES VIA XLSX ====================
document.getElementById("importar-clientes").addEventListener("click", () => {
  const fileInput = document.getElementById("upload-excel");
  const file = fileInput.files[0];
  if (!file) return alert("Selecione um arquivo Excel");

  const reader = new FileReader();
  reader.onload = (e) => {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    rows.forEach(async row => {
      if (row.Nome && row.WhatsApp) {
        await db.collection("clientes").add({
          nome: row.Nome,
          whatsapp: row.WhatsApp
        });
      }
    });
    alert("Clientes importados com sucesso!");
  };
  reader.readAsArrayBuffer(file);
});
