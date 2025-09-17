// Importando Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Configuração do Firebase (substituir se usar outro projeto)
const firebaseConfig = {
  apiKey: "AIzaSyAza98u8-NVn9hNbuLwcsaCZX2hXbtVaHk",
  authDomain: "meu-app-de-login.firebaseapp.com",
  projectId: "meu-app-de-login",
  storageBucket: "meu-app-de-login.appspot.com",
  messagingSenderId: "61119567504",
  appId: "1:61119567504:web:556bb893c9eba6c4e12a15",
  measurementId: "G-YY6QTZX57K"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Referências no HTML
const loginForm = document.getElementById("login-form");
const loginContainer = document.getElementById("login-form-container");
const authContent = document.getElementById("auth-content");

const clientForm = document.getElementById("client-form");
const clientList = document.getElementById("client-list");

const repForm = document.getElementById("rep-form");
const repList = document.getElementById("rep-list");

const productForm = document.getElementById("product-form");
const productList = document.getElementById("product-list");

// ---------------------- AUTENTICAÇÃO ----------------------
document.getElementById("login-button").addEventListener("click", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    alert("Erro no login: " + error.message);
  }
});

document.getElementById("signup-button").addEventListener("click", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  try {
    await createUserWithEmailAndPassword(auth, email, password);
    alert("Conta criada com sucesso!");
  } catch (error) {
    alert("Erro no cadastro: " + error.message);
  }
});

document.getElementById("logout-button").addEventListener("click", async () => {
  await signOut(auth);
});

// Alteração de estado do usuário
onAuthStateChanged(auth, (user) => {
  if (user) {
    loginContainer.classList.add("hidden");
    authContent.classList.remove("hidden");
    carregarDados(); // Carrega CRUD ao logar
  } else {
    loginContainer.classList.remove("hidden");
    authContent.classList.add("hidden");
  }
});

// ---------------------- CRUD CLIENTES ----------------------
clientForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("client-name").value;
  const whatsapp = document.getElementById("client-whatsapp").value;

  try {
    await addDoc(collection(db, "clientes"), { name, whatsapp });
    clientForm.reset();
    carregarClientes();
  } catch (error) {
    alert("Erro ao salvar cliente: " + error.message);
  }
});

async function carregarClientes() {
  clientList.innerHTML = "";
  const querySnapshot = await getDocs(collection(db, "clientes"));
  querySnapshot.forEach((docSnap) => {
    const li = document.createElement("li");
    li.className = "flex justify-between items-center bg-gray-100 p-2 rounded";
    li.textContent = `${docSnap.data().name} - ${docSnap.data().whatsapp}`;

    const delBtn = document.createElement("button");
    delBtn.textContent = "Excluir";
    delBtn.className = "bg-red-500 text-white px-2 py-1 rounded ml-2";
    delBtn.addEventListener("click", async () => {
      await deleteDoc(doc(db, "clientes", docSnap.id));
      carregarClientes();
    });

    li.appendChild(delBtn);
    clientList.appendChild(li);
  });
}

// ---------------------- CRUD REPRESENTANTES ----------------------
repForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("rep-name").value;

  try {
    await addDoc(collection(db, "representantes"), { name });
    repForm.reset();
    carregarRepresentantes();
  } catch (error) {
    alert("Erro ao salvar representante: " + error.message);
  }
});

async function carregarRepresentantes() {
  repList.innerHTML = "";
  const querySnapshot = await getDocs(collection(db, "representantes"));
  querySnapshot.forEach((docSnap) => {
    const li = document.createElement("li");
    li.className = "flex justify-between items-center bg-gray-100 p-2 rounded";
    li.textContent = `${docSnap.data().name}`;

    const delBtn = document.createElement("button");
    delBtn.textContent = "Excluir";
    delBtn.className = "bg-red-500 text-white px-2 py-1 rounded ml-2";
    delBtn.addEventListener("click", async () => {
      await deleteDoc(doc(db, "representantes", docSnap.id));
      carregarRepresentantes();
    });

    li.appendChild(delBtn);
    repList.appendChild(li);
  });
}

// ---------------------- CRUD PRODUTOS ----------------------
productForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("product-name").value;
  const category = document.getElementById("product-category").value;
  const price = document.getElementById("product-price").value;
  const image = document.getElementById("product-image-url").value;

  try {
    await addDoc(collection(db, "produtos"), { name, category, price, image });
    productForm.reset();
    carregarProdutos();
  } catch (error) {
    alert("Erro ao salvar produto: " + error.message);
  }
});

async function carregarProdutos() {
  productList.innerHTML = "";
  const querySnapshot = await getDocs(collection(db, "produtos"));
  querySnapshot.forEach((docSnap) => {
    const li = document.createElement("li");
    li.className = "flex justify-between items-center bg-gray-100 p-2 rounded";
    li.textContent = `${docSnap.data().name} - R$${docSnap.data().price}`;

    const delBtn = document.createElement("button");
    delBtn.textContent = "Excluir";
    delBtn.className = "bg-red-500 text-white px-2 py-1 rounded ml-2";
    delBtn.addEventListener("click", async () => {
      await deleteDoc(doc(db, "produtos", docSnap.id));
      carregarProdutos();
    });

    li.appendChild(delBtn);
    productList.appendChild(li);
  });
}

// ---------------------- FUNÇÃO GERAL ----------------------
async function carregarDados() {
  await carregarClientes();
  await carregarRepresentantes();
  await carregarProdutos();
}
