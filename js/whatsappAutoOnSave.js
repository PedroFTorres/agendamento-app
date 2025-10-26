// whatsappAutoOnSave.js
console.log("⚙️ whatsappAutoOnSave.js carregado.");

function ativarIntegracaoWhatsApp() {
  const form = document.querySelector("form button.bg-blue-600")?.closest("form");
  if (!form) {
    console.warn("⏳ Aguardando renderização do formulário de agendamento...");
    setTimeout(ativarIntegracaoWhatsApp, 1500);
    return;
  }

  console.log("✅ Formulário de agendamento encontrado.");

  form.addEventListener("submit", async () => {
    setTimeout(async () => {
      try {
        const user = firebase.auth().currentUser;
        if (!user) return;

        // Busca o último agendamento criado
        const snap = await db.collection("agendamentos")
          .where("userId", "==", user.uid)
          .orderBy("createdAt", "desc")
          .limit(1)
          .get();

        if (snap.empty) return;

        const ref = snap.docs[0].ref;
        const data = snap.docs[0].data();

        if (data.whatsapp) return;

        // Busca WhatsApp do cliente
        const clienteSnap = await db.collection("clientes")
          .where("userId", "==", user.uid)
          .where("nome", "==", data.clienteNome)
          .limit(1)
          .get();

        if (!clienteSnap.empty) {
          const cliente = clienteSnap.docs[0].data();
          if (cliente.whatsapp) {
            await ref.update({ whatsapp: cliente.whatsapp });
            console.log(`✅ WhatsApp adicionado automaticamente: ${cliente.whatsapp}`);
          } else {
            console.warn(`⚠️ Cliente ${data.clienteNome} sem número cadastrado.`);
          }
        } else {
          console.warn(`⚠️ Cliente ${data.clienteNome} não encontrado no banco.`);
        }
      } catch (err) {
        console.error("❌ Erro ao sincronizar WhatsApp:", err);
      }
    }, 1500);
  });
}

// Ativa apenas quando a página de Agendamentos for aberta
const observer = new MutationObserver(() => {
  const titulo = document.querySelector("h2");
  if (titulo && titulo.textContent.includes("Agendamentos")) {
    ativarIntegracaoWhatsApp();
  }
});

observer.observe(document.body, { childList: true, subtree: true });
