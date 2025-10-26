// whatsappAutoOnSave.js
// 🚀 Atualiza WhatsApp automaticamente apenas após o formulário estar carregado

console.log("⚙️ whatsappAutoOnSave.js carregado.");

function iniciarIntegracao() {
  const agForm = document.getElementById("agendamento-form");
  if (!agForm) {
    console.warn("⏳ Aguardando formulário de agendamento...");
    setTimeout(iniciarIntegracao, 1000); // tenta novamente em 1 segundo
    return;
  }

  console.log("✅ Formulário encontrado, integração ativada.");

  agForm.addEventListener("submit", async (e) => {
    setTimeout(async () => {
      try {
        const user = firebase.auth().currentUser;
        if (!user) return;

        // Buscar o último agendamento criado
        const snap = await db.collection("agendamentos")
          .where("userId", "==", user.uid)
          .orderBy("createdAt", "desc")
          .limit(1)
          .get();

        if (snap.empty) return;

        const docRef = snap.docs[0].ref;
        const agendamento = snap.docs[0].data();
        if (agendamento.whatsapp) return;

        // Buscar WhatsApp do cliente
        const clienteSnap = await db.collection("clientes")
          .where("userId", "==", user.uid)
          .where("nome", "==", agendamento.clienteNome)
          .limit(1)
          .get();

        if (!clienteSnap.empty) {
          const clienteData = clienteSnap.docs[0].data();
          const whatsapp = clienteData.whatsapp || "";

          if (whatsapp) {
            await docRef.update({ whatsapp });
            console.log(`✅ WhatsApp adicionado automaticamente: ${whatsapp}`);
          } else {
            console.warn(`⚠️ Cliente ${agendamento.clienteNome} sem número cadastrado.`);
          }
        } else {
          console.warn(`⚠️ Cliente ${agendamento.clienteNome} não encontrado.`);
        }
      } catch (err) {
        console.error("❌ Erro ao atualizar WhatsApp:", err);
      }
    }, 1500);
  });
}

// Aguarda o DOM carregar antes de rodar
document.addEventListener("DOMContentLoaded", iniciarIntegracao);
