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

if (document.getElementById("logout-button")) {
  document.getElementById("logout-button").addEventListener("click", async () => {
    await auth.signOut();
    location.href = "login.html";
  });
}

// Verifica sessão
auth.onAuthStateChanged(user => {
const path = location.pathname.toLowerCase();
  const isLoginPage = path.endsWith("/login") || path.endsWith("/login.html");

  if (!user && !isLoginPage) {
    location.href = "login.html";
     return;
  }

  if (user && isLoginPage) {
    location.href = "index.html";
  }
});
