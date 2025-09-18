// ---------------------------
// Firebase Config
// ---------------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const { jsPDF } = window.jspdf;
const ChartLib = window.Chart;
const FullCalendar = window.FullCalendar;

// ---------------------------
// Firebase Init
// ---------------------------
const firebaseConfig = {
  apiKey: "AIzaSyAza98u8-NVn9hNbuLwcsaCZX2hXbtVaHk",
  authDomain: "meu-app-de-login.firebaseapp.com",
  projectId: "meu-app-de-login",
  storageBucket: "meu-app-de-login.appspot.com",
  messagingSenderId: "61119567504",
  appId: "1:61119567504:web:556bb893c9eba6c4e12a15",
  measurementId: "G-YY6QTZX57K"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ---------------------------
// Navegação
// ---------------------------
const pages = document.querySelectorAll(".page");
const navBtns = document.querySelectorAll(".nav-btn");

function showPage(id) {
  pages.forEach((p) => (p.id === id ? p.classList.remove("hidden") : p.classList.add("hidden")));
  document.getElementById("page-title").textContent = id.charAt(0).toUpperCase() + id.slice(1);
}
navBtns.forEach((b) => b.addEventListener("click", () => showPage(b.dataset.page)));

// ---------------------------
// Login / Logout
// ---------------------------
const loginForm = document.getElementById("login-form");
const signupBtn = document.getElementById("signup-btn");
const logoutBtn = document.getElementById("logout-button");

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      alert("Erro no login: " + err.message);
    }
  });
}

if (signupBtn) {
  signupBtn.addEventListener("click", async () => {
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      alert("Conta criada com sucesso!");
    } catch (err) {
      alert("Erro ao criar conta: " + err.message);
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
    } catch (err) {
      alert("Erro ao sair: " + err.message);
    }
  });
}

// ---------------------------
// Auth State Change
// ---------------------------
onAuthStateChanged(auth, async (user) => {
  if (user) {
    document.getElementById("loginPage").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");
    document.getElementById("user-email-display").textContent = user.email;
    await initData();
  } else {
    document.getElementById("loginPage").classList.remove("hidden");
    document.getElementById("app").classList.add("hidden");
    document.getElementById("user-email-display").textContent = "-";
  }
});

// ---------------------------
// Helpers Firestore
// ---------------------------
async function readCollection(name) {
  const snap = await getDocs(collection(db, name));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ---------------------------
// Clientes CRUD
// ---------------------------
let editClientId = null;
const clientForm = document.getElementById("client-form");

if (clientForm) {
  clientForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("client-name").value;
    const whatsapp = document.getElementById("client-whatsapp").value;
    if (!name) return;
    if (editClientId) {
      await updateDoc(doc(db, "clientes", editClientId), { name, whatsapp });
      editClientId = null;
    } else {
      await addDoc(collection(db, "clientes"), { name, whatsapp });
    }
    clientForm.reset();
    await loadClients();
  });
}

async function loadClients() {
  const list = document.getElementById("client-list");
  list.innerHTML = "";
  const data = await readCollection("clientes");
  data.forEach((c) => {
    const li = document.createElement("li");
    li.className = "p-2 bg-white rounded flex justify-between";
    li.innerHTML = `<span>${c.name} (${c.whatsapp || ""})</span>
      <div>
        <button class="edit px-2 bg-yellow-400 rounded" data-id="${c.id}">Editar</button>
        <button class="del px-2 bg-red-500 text-white rounded" data-id="${c.id}">Excluir</button>
      </div>`;
    list.appendChild(li);
  });
  list.querySelectorAll(".edit").forEach((b) =>
    b.addEventListener("click", async (e) => {
      const id = e.target.dataset.id;
      const all = await readCollection("clientes");
      const cli = all.find((c) => c.id === id);
      document.getElementById("client-name").value = cli.name;
      document.getElementById("client-whatsapp").value = cli.whatsapp || "";
      editClientId = id;
    })
  );
  list.querySelectorAll(".del").forEach((b) =>
    b.addEventListener("click", async (e) => {
      if (!confirm("Excluir cliente?")) return;
      await deleteDoc(doc(db, "clientes", e.target.dataset.id));
      await loadClients();
    })
  );
}

// ---------------------------
// Representantes CRUD
// ---------------------------
let editRepId = null;
const repForm = document.getElementById("rep-form");

if (repForm) {
  repForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("rep-name").value;
    if (!name) return;
    if (editRepId) {
      await updateDoc(doc(db, "representantes", editRepId), { name });
      editRepId = null;
    } else {
      await addDoc(collection(db, "representantes"), { name });
    }
    repForm.reset();
    await loadReps();
  });
}

async function loadReps() {
  const list = document.getElementById("rep-list");
  list.innerHTML = "";
  const data = await readCollection("representantes");
  data.forEach((r) => {
    const li = document.createElement("li");
    li.className = "p-2 bg-white rounded flex justify-between";
    li.innerHTML = `<span>${r.name}</span>
      <div>
        <button class="edit px-2 bg-yellow-400 rounded" data-id="${r.id}">Editar</button>
        <button class="del px-2 bg-red-500 text-white rounded" data-id="${r.id}">Excluir</button>
      </div>`;
    list.appendChild(li);
  });
  list.querySelectorAll(".edit").forEach((b) =>
    b.addEventListener("click", async (e) => {
      const id = e.target.dataset.id;
      const all = await readCollection("representantes");
      const rep = all.find((r) => r.id === id);
      document.getElementById("rep-name").value = rep.name;
      editRepId = id;
    })
  );
  list.querySelectorAll(".del").forEach((b) =>
    b.addEventListener("click", async (e) => {
      if (!confirm("Excluir representante?")) return;
      await deleteDoc(doc(db, "representantes", e.target.dataset.id));
      await loadReps();
    })
  );
}

// ---------------------------
// Produtos CRUD
// ---------------------------
let editProdId = null;
const productForm = document.getElementById("product-form");

if (productForm) {
  productForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("product-name").value;
    const category = document.getElementById("product-category").value;
    const price = parseFloat(document.getElementById("product-price").value);
    const image = document.getElementById("product-image-url").value;
    if (!name) return;
    if (editProdId) {
      await updateDoc(doc(db, "produtos", editProdId), { name, category, price, image });
      editProdId = null;
    } else {
      await addDoc(collection(db, "produtos"), { name, category, price, image });
    }
    productForm.reset();
    await loadProducts();
  });
}

async function loadProducts() {
  const list = document.getElementById("product-list");
  list.innerHTML = "";
  const data = await readCollection("produtos");
  data.forEach((p) => {
    const li = document.createElement("li");
    li.className = "p-2 bg-white rounded flex justify-between";
    li.innerHTML = `<span>${p.name} (R$${p.price || 0})</span>
      <div>
        <button class="edit px-2 bg-yellow-400 rounded" data-id="${p.id}">Editar</button>
        <button class="del px-2 bg-red-500 text-white rounded" data-id="${p.id}">Excluir</button>
      </div>`;
    list.appendChild(li);
  });
  list.querySelectorAll(".edit").forEach((b) =>
    b.addEventListener("click", async (e) => {
      const id = e.target.dataset.id;
      const all = await readCollection("produtos");
      const prod = all.find((p) => p.id === id);
      document.getElementById("product-name").value = prod.name;
      document.getElementById("product-category").value = prod.category || "";
      document.getElementById("product-price").value = prod.price || "";
      document.getElementById("product-image-url").value = prod.image || "";
      editProdId = id;
    })
  );
  list.querySelectorAll(".del").forEach((b) =>
    b.addEventListener("click", async (e) => {
      if (!confirm("Excluir produto?")) return;
      await deleteDoc(doc(db, "produtos", e.target.dataset.id));
      await loadProducts();
    })
  );
}

// ---------------------------
// Inicialização de dados
// ---------------------------
async function initData() {
  await loadClients();
  await loadReps();
  await loadProducts();
}
