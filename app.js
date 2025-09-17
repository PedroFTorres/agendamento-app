// Importando Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  getFirestore, collection, addDoc, getDocs, deleteDoc, 
  doc, updateDoc 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Biblioteca para Excel (SheetJS)
import * as XLSX from "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm";

// Configuração do Firebase
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

onAuthStateChanged(auth, (user) => {
  if (user) {
    document.getElementById("login-form-container").classList.add("hidden");
    document.getElementById("auth-content").classList.remove("hidden");
    carregarDados();
  } else {
    document.getElementById("login-form-container").classList.remove("hidden");
    document.getElementById("auth-content").classList.add("hidden");
  }
});

// ---------------------- FUNÇÃO GERAL ----------------------
async function carregarDados() {
  await carregarClientes();
  await carregarRepresentantes();
  await carregarProdutos();
}

// ---------------------- CLIENTES ----------------------
let editClientId = null;

document.getElementById("client-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("client-name").value;
  const whatsapp = document.getElementById("client-whatsapp").value;

  try {
    if (editClientId) {
      await updateDoc(doc(db, "clientes", editClientId), { name, whatsapp });
      editClientId = null;
    } else {
      await addDoc(collection(db, "clientes"), { name, whatsapp });
    }
    document.getElementById("client-form").reset();
    carregarClientes();
  } catch (error) {
    alert("Erro ao salvar cliente: " + error.message);
  }
});

async function carregarClientes() {
  const clientList = document.getElementById("client-list");
  clientList.innerHTML = "";
  const querySnapshot = await getDocs(collection(db, "clientes"));
  querySnapshot.forEach((docSnap) => {
    const li = document.createElement("li");
    li.className = "flex justify-between items-center bg-gray-100 p-2 rounded";
    li.textContent = `${docSnap.data().name} - ${docSnap.data().whatsapp}`;

    const editBtn = document.createElement("button");
    editBtn.textContent = "Editar";
    editBtn.className = "bg-yellow-500 text-white px-2 py-1 rounded ml-2";
    editBtn.addEventListener("click", () => {
      document.getElementById("client-name").value = docSnap.data().name;
      document.getElementById("client-whatsapp").value = docSnap.data().whatsapp;
      editClientId = docSnap.id;
    });

    const delBtn = document.createElement("button");
    delBtn.textContent = "Excluir";
    delBtn.className = "bg-red-500 text-white px-2 py-1 rounded ml-2";
    delBtn.addEventListener("click", async () => {
      await deleteDoc(doc(db, "clientes", docSnap.id));
      carregarClientes();
    });

    li.appendChild(editBtn);
    li.appendChild(delBtn);
    clientList.appendChild(li);
  });
}

// Importar Excel de Clientes
document.getElementById("client-file")?.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (evt) => {
    const data = new Uint8Array(evt.target.result);
    const workbook = XLSX.read(data, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    for (const row of rows) {
      if (row.Nome && row.WhatsApp) {
        await addDoc(collection(db, "clientes"), {
          name: row.Nome,
          whatsapp: row.WhatsApp
        });
      }
    }
    carregarClientes();
    alert("Importação concluída!");
  };
  reader.readAsArrayBuffer(file);
});

// ---------------------- REPRESENTANTES ----------------------
let editRepId = null;

document.getElementById("rep-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("rep-name").value;

  try {
    if (editRepId) {
      await updateDoc(doc(db, "representantes", editRepId), { name });
      editRepId = null;
    } else {
      await addDoc(collection(db, "representantes"), { name });
    }
    document.getElementById("rep-form").reset();
    carregarRepresentantes();
  } catch (error) {
    alert("Erro ao salvar representante: " + error.message);
  }
});

async function carregarRepresentantes() {
  const repList = document.getElementById("rep-list");
  repList.innerHTML = "";
  const querySnapshot = await getDocs(collection(db, "representantes"));
  querySnapshot.forEach((docSnap) => {
    const li = document.createElement("li");
    li.className = "flex justify-between items-center bg-gray-100 p-2 rounded";
    li.textContent = `${docSnap.data().name}`;

    const editBtn = document.createElement("button");
    editBtn.textContent = "Editar";
    editBtn.className = "bg-yellow-500 text-white px-2 py-1 rounded ml-2";
    editBtn.addEventListener("click", () => {
      document.getElementById("rep-name").value = docSnap.data().name;
      editRepId = docSnap.id;
    });

    const delBtn = document.createElement("button");
    delBtn.textContent = "Excluir";
    delBtn.className = "bg-red-500 text-white px-2 py-1 rounded ml-2";
    delBtn.addEventListener("click", async () => {
      await deleteDoc(doc(db, "representantes", docSnap.id));
      carregarRepresentantes();
    });

    li.appendChild(editBtn);
    li.appendChild(delBtn);
    repList.appendChild(li);
  });
}

// ---------------------- PRODUTOS ----------------------
let editProductId = null;

document.getElementById("product-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("product-name").value;
  const category = document.getElementById("product-category").value;
  const price = document.getElementById("product-price").value;
  const image = document.getElementById("product-image-url").value;

  try {
    if (editProductId) {
      await updateDoc(doc(db, "produtos", editProductId), { name, category, price, image });
      editProductId = null;
    } else {
      await addDoc(collection(db, "produtos"), { name, category, price, image });
    }
    document.getElementById("product-form").reset();
    carregarProdutos();
  } catch (error) {
    alert("Erro ao salvar produto: " + error.message);
  }
});

async function carregarProdutos() {
  const productList = document.getElementById("product-list");
  productList.innerHTML = "";
  const querySnapshot = await getDocs(collection(db, "produtos"));
  querySnapshot.forEach((docSnap) => {
    const li = document.createElement("li");
    li.className = "flex justify-between items-center bg-gray-100 p-2 rounded";
    li.textContent = `${docSnap.data().name} - R$${docSnap.data().price}`;

    const editBtn = document.createElement("button");
    editBtn.textContent = "Editar";
    editBtn.className = "bg-yellow-500 text-white px-2 py-1 rounded ml-2";
    editBtn.addEventListener("click", () => {
      document.getElementById("product-name").value = docSnap.data().name;
      document.getElementById("product-category").value = docSnap.data().category;
      document.getElementById("product-price").value = docSnap.data().price;
      document.getElementById("product-image-url").value = docSnap.data().image;
      editProductId = docSnap.id;
    });

    const delBtn = document.createElement("button");
    delBtn.textContent = "Excluir";
    delBtn.className = "bg-red-500 text-white px-2 py-1 rounded ml-2";
    delBtn.addEventListener("click", async () => {
      await deleteDoc(doc(db, "produtos", docSnap.id));
      carregarProdutos();
    });

    li.appendChild(editBtn);
    li.appendChild(delBtn);
    productList.appendChild(li);
  });
}
