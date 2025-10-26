// whatsappConfirmacao.js
console.log("✅ whatsappConfirmacao.js carregado com sucesso.");

// Função principal
async function enviarConfirmacaoWhatsApp() {
  try {
    const user = firebase.auth().currentUser;
    if (!user) {
      alert("Usuário não autenticado. Faça login novamente.");
      return;
    }

    // Obtém a data selecionada do input (formato yyyy-mm-dd)
    const inputData = document.getElementById("dataConfirmacao");
    if (!inputData || !inputData.value) {
      alert("Por favor, selecione uma data para confirmar os agendamentos.");
      return;
    }

    const dataSelecionada = inputData.value; // Ex: "2025-10-23"
    console.log("📅 Data selecionada:", dataSelecionada);

    // Busca agendamentos do usuário para a data
    const snap = await db.collection("agendamentos")
      .where("userId", "==", user.uid)
      .where("data", "==", dataSelecionada)
      .get();

    if (snap.empty) {
      alert("Nenhum agendamento encontrado nesta data.");
      console.warn("⚠️ Nenhum documento encontrado em agendamentos para:", dataSelecionada);
      return;
    }

    console.log(`📦 ${snap.size} agendamento(s) encontrado(s).`);

    // Loop pelos agendamentos encontrados
    for (const doc of snap.docs) {
      const agendamento = doc.data();

      const cliente = agendamento.clienteNome || "Cliente";
      const produto = agendamento.produtoNome || "Produto";
      const quantidade = agendamento.quantidade || "0";
      const observacao = agendamento.observacao || "";
      const data = agendamento.data;

      // Busca o número de WhatsApp do cliente
      const clienteSnap = await db.collection("clientes")
        .where("userId", "==", user.uid)
        .where("nome", "==", cliente)
        .limit(1)
        .get();

      if (clienteSnap.empty) {
        console.warn(`⚠️ Cliente ${cliente} não encontrado no banco.`);
        continue;
      }

      const dadosCliente = clienteSnap.docs[0].data();
      const numero = dadosCliente.whatsapp;

      if (!numero) {
        console.warn(`⚠️ Cliente ${cliente} não possui WhatsApp cadastrado.`);
        continue;
      }

      // Monta a mensagem de confirmação
      const mensagem = 
        `Olá ${cliente}! 👋%0A` +
        `Aqui é da *Cerâmica Fortes* 🧱.%0A` +
        `Seu agendamento está *confirmado* para o dia *${data}*.%0A` +
        `Produto: *${produto}*%0A` +
        `Quantidade: *${quantidade}* unidades.%0A` +
        (observacao ? `Observação: ${observacao}%0A` : "") +
        `%0A✅ Qualquer dúvida, estamos à disposição!`;

      const linkWhatsApp = `https://wa.me/${numero.replace(/\D/g, "")}?text=${mensagem}`;
      console.log(`💬 Enviando para ${cliente}: ${linkWhatsApp}`);

      // Abre o link em uma nova aba (envio manual)
      window.open(linkWhatsApp, "_blank");
    }

    alert("Mensagens de confirmação prontas para envio ✅");

  } catch (error) {
    console.error("❌ Erro ao enviar confirmações:", error);
    alert("Ocorreu um erro ao enviar as confirmações. Veja o console para detalhes.");
  }
}

// Ativar botão na página
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("btnConfirmarWhatsApp");
  if (btn) {
    btn.addEventListener("click", enviarConfirmacaoWhatsApp);
    console.log("🚀 Botão de confirmação WhatsApp conectado.");
  } else {
    console.warn("⚠️ Botão #btnConfirmarWhatsApp não encontrado no HTML.");
  }
});
