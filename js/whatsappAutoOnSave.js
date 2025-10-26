// whatsappAutoOnSave.js
// 🚀 Atualiza o WhatsApp automaticamente apenas quando um novo agendamento é criado

document.addEventListener("DOMContentLoaded", () => {
  console.log("⚙️ whatsappAutoOnSave.js carregado.");

  // Espera o envio do formulário de agendamento
  const agForm = document.getElementById("agendamento-form");
  if (!agForm) {
    console.warn("⚠️ Formulário de agendamento não encontrado.");
    return;
  }

  agForm.addEventListener("submit", async (e) => {
    setTimeout(async () => {
      try {
        const user = firebase.auth().currentUser;
        if (!user) return;

        // Buscar o último agendamento criado pelo usuário
        const snap = await db.collection("agendamentos")
          .where("userId", "==", user.uid)
          .orderBy("createdAt", "desc")
          .limit(1)
          .get();

        if (snap.empty) return;

        const docRef = snap.docs[0].ref;
        const agendamento = snap.docs[0].data();
        if (agendamento.whatsapp) return; // já tem, não faz nada

        // Buscar o WhatsApp do cliente correspondente
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
    }, 1500); // pequeno atraso para garantir que o Firestore já gravou o agendamento
  });
});
