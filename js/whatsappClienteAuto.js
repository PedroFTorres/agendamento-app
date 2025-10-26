// whatsappClienteAuto.js
// 🔄 Integração automática: adiciona WhatsApp do cliente nos agendamentos após salvar

document.addEventListener("DOMContentLoaded", async () => {
  console.log("📲 whatsappClienteAuto.js carregado com sucesso");

  // Função auxiliar para esperar o login do usuário
  async function waitForAuth() {
    return new Promise((resolve) => {
      const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
        if (user) {
          unsubscribe();
          resolve(user);
        }
      });
    });
  }

  // 🔍 Escuta novos agendamentos sem WhatsApp
  const user = await waitForAuth();
  db.collection("agendamentos")
    .where("userId", "==", user.uid)
    .onSnapshot(async (snapshot) => {
      for (const docChange of snapshot.docChanges()) {
        if (docChange.type === "added") {
          const agendamento = docChange.doc.data();

          // Se já tiver WhatsApp, pula
          if (agendamento.whatsapp) continue;

          const nomeCliente = agendamento.clienteNome;
          console.log(`🧠 Verificando WhatsApp do cliente: ${nomeCliente}`);

          // Busca o cliente correspondente
          const clienteSnap = await db
            .collection("clientes")
            .where("userId", "==", user.uid)
            .where("nome", "==", nomeCliente)
            .get();

          if (!clienteSnap.empty) {
            const clienteData = clienteSnap.docs[0].data();
            const whatsapp = clienteData.whatsapp || "";

            if (whatsapp) {
              // Atualiza o agendamento com o WhatsApp encontrado
              await docChange.doc.ref.update({ whatsapp });
              console.log(`✅ WhatsApp adicionado para ${nomeCliente}: ${whatsapp}`);
            } else {
              console.warn(`⚠️ Cliente ${nomeCliente} sem número cadastrado.`);
            }
          } else {
            console.warn(`⚠️ Cliente ${nomeCliente} não encontrado no cadastro.`);
          }
        }
      }
    });
});
