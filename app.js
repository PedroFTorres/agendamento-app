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
  orderBy
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
const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim();
    const senha = document.getElementById("login-password").value.trim();

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, senha);
      console.log("Usuário logado:", userCredential.user);
      window.location.href = "index.html"; // redireciona para o painel principal
    } catch (error) {
      console.error("Erro no login:", error);
      alert("Falha no login: " + error.message);
    }
  });
}

// ==============================
// CRIAR CONTA
// ==============================
const signupForm = document.getElementById("signup-form");
if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("signup-email").value.trim();
    const senha = document.getElementById("signup-password").value.trim();

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
      console.log("Conta criada:", userCredential.user);
      alert("Conta criada com sucesso!");
      signupForm.reset();
    } catch (error) {
      console.error("Erro ao criar conta:", error);
      alert("Erro: " + error.message);
    }
  });
}

// ==============================
// LOGOUT
// ==============================
const logoutBtn = document.getElementById("logout-button");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
      window.location.href = "login.html"; // volta para tela de login
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
// Função Auxiliar - Listagem
// ==============================
async function carregarLista(colecao, listaId, campos = []) {
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

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const li = document.createElement("li");
      li.className = "p-2 bg-gray-100 rounded-md";
      li.textContent = campos.map(c => data[c] || "").join(" - ");
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
      await addDoc(collection(db, "clientes"), {
        nome,
        whatsapp,
        criadoEm: new Date()
      });
      alert("Cliente adicionado!");
      clientForm.reset();
      carregarLista("clientes", "client-list", ["nome", "whatsapp"]);
    } catch (error) {
      console.error("Erro ao salvar cliente:", error);
      alert("Erro ao salvar cliente.");
    }
  });

  carregarLista("clientes", "client-list", ["nome", "whatsapp"]);
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
      await addDoc(collection(db, "representantes"), {
        nome,
        criadoEm: new Date()
      });
      alert("Representante adicionado!");
      repForm.reset();
      carregarLista("representantes", "rep-list", ["nome"]);
    } catch (error) {
      console.error("Erro ao salvar representante:", error);
      alert("Erro ao salvar representante.");
    }
  });

  carregarLista("representantes", "rep-list", ["nome"]);
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
      await addDoc(collection(db, "produtos"), {
        nome,
        categoria,
        preco,
        imagem,
        criadoEm: new Date()
      });
      alert("Produto adicionado!");
      productForm.reset();
      carregarLista("produtos", "product-list", ["nome", "categoria", "preco"]);
    } catch (error) {
      console.error("Erro ao salvar produto:", error);
      alert("Erro ao salvar produto.");
    }
  });

  carregarLista("produtos", "product-list", ["nome", "categoria", "preco"]);
}
