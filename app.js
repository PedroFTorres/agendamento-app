// ==============================
// Import Firebase SDKs
// ==============================
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  doc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ==============================
// Configuração Firebase
// ==============================
const firebaseConfig = {
  apiKey: "AIzaSyAza98u8-NVn9hNbuLwcsaCZX2hXbtVaHk",
  authDomain: "meu-app-de-login.firebaseapp.com",
  projectId: "meu-app-de-login",
  storageBucket: "meu-app-de-login.firebasestorage.app",
  messagingSenderId: "61119567504",
  appId: "1:61119567504:web:556bb893c9eba6c4e12a15",
  measurementId: "G-YY6QTZX57K"
};

// ==============================
// Inicializações
// ==============================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ==============================
// LOGIN
// ==============================
const loginBtn = document.getElementById("login-button");
if (loginBtn) {
  loginBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value.trim();
    const senha = document.getElementById("password").value.trim();

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, senha);
      console.log("Usuário logado:", userCredential.user);

      document.getElementById("login-form-container").classList.add("hidden");
      document.getElementById("auth-content").classList.remove("hidden");

      document.getElementById("user-id").textContent = userCredential.user.uid;
    } catch (error) {
      console.error("Erro no login:", error);
      alert("Falha no login: " + error.message);
    }
  });
}

// ==============================
// CRIAR CONTA
// ==============================
const signupBtn = document.getElementById("signup-button");
if (signupBtn) {
  signupBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value.trim();
    const senha = document.getElementById("password").value.trim();

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
      console.log("Conta criada:", userCredential.user);
      alert("Conta criada com sucesso!");
    } catch (error) {
      console.error("Erro ao criar conta:", error);
      alert("Erro: " + error.message);
    }
  });
}

// ==============================
// LOGOUT (corrigido)
// ==============================
const logoutBtn = document.getElementById("logout-button");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
      window.location.href = "index.html"; // volta para login
    } catch (error) {
      console.error("Erro ao sair:", error);
      alert("Erro ao sair, tente novamente.");
    }
  });
}

// ==============================
// Monitorar login
// ==============================
onAuthStateChanged(auth, (user) => {
  const userIdDisplay = document.getElementById("userIdDisplay");
  if (user) {
    console.log("Usuário logado:", user.email);
    if (userIdDisplay) userIdDisplay.textContent = user.uid;
  } else {
    console.log("Nenhum usuário logado");
    if (userIdDisplay) userIdDisplay.textContent = "Desconectado";
  }
});

// ==============================
// Função Auxiliar - Listagem CRUD
// ==============================
async function carregarLista(colecao, listaId, campos = [], editarFunc, excluirFunc) {
  const listaEl = document.getElementById(listaId);
  if (!listaEl) return;

  listaEl.innerHTML = "";

  try {
    const q = query(collection(db, colecao), orderBy("nome", "asc"));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      listaEl.innerHTML = "<li class='text-gray-500'>Nenhum registro encontrado.</li>";
      return;
    }

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const li = document.createElement("li");
      li.className = "p-2 bg-gray-100 rounded-md flex justify-between items-center";
      li.innerHTML = `
        <span>${campos.map(c => data[c] || "").join(" - ")}</span>
        <div class="space-x-2">
          <button class="px-2 py-1 bg-yellow-400 rounded" onclick="${editarFunc}('${docSnap.id}')">Editar</button>
          <button class="px-2 py-1 bg-red-500 text-white rounded" onclick="${excluirFunc}('${docSnap.id}')">Excluir</button>
        </div>
      `;
      listaEl.appendChild(li);
    });
  } catch (error) {
    console.error("Erro ao carregar lista:", error);
  }
}

// ==============================
// CLIENTES
// ==============================
const clientForm = document.getElementById("client-form");
if (clientForm) {
  clientForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nome = document.getElementById("client-name").value.trim();
    const whatsapp = document.getElementById("client-whatsapp").value.trim();

    if (!nome || !whatsapp) {
      alert("Preencha os campos obrigatórios!");
      return;
    }

    try {
      await addDoc(collection(db, "clientes"), { nome, whatsapp, criadoEm: new Date() });
      alert("Cliente adicionado!");
      clientForm.reset();
      carregarClientes();
    } catch (error) {
      console.error("Erro ao salvar cliente:", error);
      alert("Erro ao salvar cliente.");
    }
  });

  window.carregarClientes = async () => {
    await carregarLista("clientes", "client-list", ["nome", "whatsapp"], "editarCliente", "excluirCliente");
  };

  window.excluirCliente = async (id) => {
    await deleteDoc(doc(db, "clientes", id));
    carregarClientes();
  };

  window.editarCliente = async (id) => {
    const ref = doc(db, "clientes", id);
    const novoNome = prompt("Novo nome:");
    const novoWhats = prompt("Novo WhatsApp:");
    if (novoNome && novoWhats) {
      await updateDoc(ref, { nome: novoNome, whatsapp: novoWhats });
      carregarClientes();
    }
  };

  carregarClientes();
}

// ==============================
// REPRESENTANTES
// ==============================
const repForm = document.getElementById("rep-form");
if (repForm) {
  repForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nome = document.getElementById("rep-name").value.trim();

    if (!nome) {
      alert("Informe o nome do representante!");
      return;
    }

    try {
      await addDoc(collection(db, "representantes"), { nome, criadoEm: new Date() });
      alert("Representante adicionado!");
      repForm.reset();
      carregarRepresentantes();
    } catch (error) {
      console.error("Erro ao salvar representante:", error);
      alert("Erro ao salvar representante.");
    }
  });

  window.carregarRepresentantes = async () => {
    await carregarLista("representantes", "rep-list", ["nome"], "editarRepresentante", "excluirRepresentante");
  };

  window.excluirRepresentante = async (id) => {
    await deleteDoc(doc(db, "representantes", id));
    carregarRepresentantes();
  };

  window.editarRepresentante = async (id) => {
    const ref = doc(db, "representantes", id);
    const novoNome = prompt("Novo nome:");
    if (novoNome) {
      await updateDoc(ref, { nome: novoNome });
      carregarRepresentantes();
    }
  };

  carregarRepresentantes();
}

// ==============================
// PRODUTOS
// ==============================
const productForm = document.getElementById("product-form");
if (productForm) {
  productForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nome = document.getElementById("product-name").value.trim();
    const categoria = document.getElementById("product-category").value.trim();
    const preco = parseFloat(document.getElementById("product-price").value);
    const imagem = document.getElementById("product-image-url").value.trim();

    if (!nome || !categoria || isNaN(preco)) {
      alert("Preencha todos os campos obrigatórios!");
      return;
    }

    try {
      await addDoc(collection(db, "produtos"), { nome, categoria, preco, imagem, criadoEm: new Date() });
      alert("Produto adicionado!");
      productForm.reset();
      carregarProdutos();
    } catch (error) {
      console.error("Erro ao salvar produto:", error);
      alert("Erro ao salvar produto.");
    }
  });

  window.carregarProdutos = async () => {
    await carregarLista("produtos", "product-list", ["nome", "categoria", "preco"], "editarProduto", "excluirProduto");
  };

  window.excluirProduto = async (id) => {
    await deleteDoc(doc(db, "produtos", id));
    carregarProdutos();
  };

  window.editarProduto = async (id) => {
    const ref = doc(db, "produtos", id);
    const novoNome = prompt("Novo nome:");
    const novaCategoria = prompt("Nova categoria:");
    const novoPreco = parseFloat(prompt("Novo preço:"));
    if (novoNome && novaCategoria && !isNaN(novoPreco)) {
      await updateDoc(ref, { nome: novoNome, categoria: novaCategoria, preco: novoPreco });
      carregarProdutos();
    }
  };

  carregarProdutos();
}
