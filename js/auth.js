// Controle de autenticação
if (document.getElementById("login-form")) {
  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const pass = document.getElementById("login-password").value;
    try {
      await auth.signInWithEmailAndPassword(email, pass);
      location.href = "index.html";
    } catch (err) {
      alert("Erro no login: " + err.message);
    }
  });
}

if (document.getElementById("signup-form")) {
  document.getElementById("signup-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("signup-email").value;
    const pass = document.getElementById("signup-password").value;
    try {
      await auth.createUserWithEmailAndPassword(email, pass);
      location.href = "index.html";
    } catch (err) {
      alert("Erro no cadastro: " + err.message);
    }
  });
}

if (document.getElementById("logout-button")) {
  document.getElementById("logout-button").addEventListener("click", async () => {
    await auth.signOut();
    location.href = "login.html";
  });
}

// Verifica sessão
auth.onAuthStateChanged(user => {
  if (!user && location.pathname.includes("index.html")) {
    location.href = "login.html";
  }
});