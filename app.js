// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, signInWithEmailAndPassword, onAuthStateChanged, 
    signOut, createUserWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, doc, setDoc, setLogLevel, 
    collection, addDoc, getDocs 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Ativa logs para debug
setLogLevel('debug');

// 🔧 Configuração Firebase (a sua config real)
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
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// UI Elements
const messageBox = document.getElementById('message-box');
const loadingSpinner = document.getElementById('loading-spinner');
const loginFormContainer = document.getElementById('login-form-container');
const loginButton = document.getElementById('login-button');
const signupButton = document.getElementById('signup-button');
const logoutButton = document.getElementById('logout-button');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const authContent = document.getElementById('auth-content');
const userIdElem = document.getElementById('user-id');
const fallbackMessage = document.getElementById('fallback-message');

// Função para mostrar mensagens
function showMessage(message, type = 'info') {
    messageBox.textContent = message;
    messageBox.className = `p-4 rounded-md text-sm ${
        type === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
    }`;
    messageBox.classList.remove('hidden');
}

// Listener login/logout
onAuthStateChanged(auth, async (user) => {
    loadingSpinner.classList.add('hidden');
    if (user) {
        loginFormContainer.classList.add('hidden');
        authContent.classList.remove('hidden');
        userIdElem.textContent = user.uid;
        showMessage('Login bem-sucedido!', 'success');

        // Salva perfil do usuário
        const userDocRef = doc(db, `users/${user.uid}`);
        await setDoc(userDocRef, { 
            lastLogin: new Date().toISOString(),
            email: user.email
        }, { merge: true });
    } else {
        loginFormContainer.classList.remove('hidden');
        authContent.classList.add('hidden');
        userIdElem.textContent = '';
        showMessage('Faça login ou crie uma conta para continuar.', 'info');
    }
});

// Eventos Login / Cadastro / Logout
loginButton?.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    if (!email || !password) {
        showMessage('Preencha todos os campos.', 'error');
        return;
    }
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        console.error("Erro login:", error);
        showMessage('Erro no login.', 'error');
    }
});

signupButton?.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    if (!email || !password) {
        showMessage('Preencha todos os campos.', 'error');
        return;
    }
    try {
        await createUserWithEmailAndPassword(auth, email, password);
        showMessage('Conta criada com sucesso!', 'success');
    } catch (error) {
        console.error("Erro cadastro:", error);
        showMessage('Erro ao criar conta.', 'error');
    }
});

logoutButton?.addEventListener('click', async () => {
    try {
        await signOut(auth);
        showMessage('Saiu com sucesso.', 'success');
    } catch (error) {
        console.error("Erro logout:", error);
        showMessage('Erro ao sair.', 'error');
    }
});

// =========================
// 🔹 CADASTRO CLIENTES
// =========================
const clientForm = document.getElementById("client-form");
const clientList = document.getElementById("client-list");

clientForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("client-name").value;
    const whatsapp = document.getElementById("client-whatsapp").value;
    const rep = document.getElementById("client-rep").value;

    try {
        await addDoc(collection(db, "clientes"), { name, whatsapp, rep, createdAt: new Date() });
        showMessage("Cliente adicionado!", "success");
        clientForm.reset();
        loadClients();
    } catch (error) {
        console.error("Erro salvar cliente:", error);
        showMessage("Erro ao salvar cliente.", "error");
    }
});

async function loadClients() {
    clientList.innerHTML = "";
    const snapshot = await getDocs(collection(db, "clientes"));
    snapshot.forEach(docSnap => {
        const li = document.createElement("li");
        li.textContent = `${docSnap.data().name} - ${docSnap.data().whatsapp}`;
        clientList.appendChild(li);
    });
}

// =========================
// 🔹 CADASTRO REPRESENTANTES
// =========================
const repForm = document.getElementById("rep-form");
const repList = document.getElementById("rep-list");

repForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("rep-name").value;
    try {
        await addDoc(collection(db, "representantes"), { name, createdAt: new Date() });
        showMessage("Representante adicionado!", "success");
        repForm.reset();
        loadReps();
    } catch (error) {
        console.error("Erro salvar representante:", error);
        showMessage("Erro ao salvar representante.", "error");
    }
});

async function loadReps() {
    repList.innerHTML = "";
    const snapshot = await getDocs(collection(db, "representantes"));
    snapshot.forEach(docSnap => {
        const li = document.createElement("li");
        li.textContent = docSnap.data().name;
        repList.appendChild(li);
    });
}

// =========================
// 🔹 CADASTRO PRODUTOS
// =========================
const productForm = document.getElementById("product-form");
const productList = document.getElementById("product-list");

productForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("product-name").value;
    const category = document.getElementById("product-category").value;
    const price = parseFloat(document.getElementById("product-price").value);
    const imageUrl = document.getElementById("product-image-url").value;

    try {
        await addDoc(collection(db, "produtos"), { name, category, price, imageUrl, createdAt: new Date() });
        showMessage("Produto adicionado!", "success");
        productForm.reset();
        loadProducts();
    } catch (error) {
        console.error("Erro salvar produto:", error);
        showMessage("Erro ao salvar produto.", "error");
    }
});

async function loadProducts() {
    productList.innerHTML = "";
    const snapshot = await getDocs(collection(db, "produtos"));
    snapshot.forEach(docSnap => {
        const li = document.createElement("li");
        li.textContent = `${docSnap.data().name} - R$${docSnap.data().price}`;
        productList.appendChild(li);
    });
}
