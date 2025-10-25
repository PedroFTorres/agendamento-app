// whatsappConfirmacao.js
// 🔄 Função para confirmar agendamentos do dia e enviar via WhatsApp (UltraMsg)

const INSTANCE_ID = "instance147478";
const TOKEN = "c4j1m6wyghzhvhrd";

// Pequeno atraso entre os envios para não sobrecarregar a API
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function confirmarAgendamentosDoDia() {
  console.log("📅 Data selecionada:", window.dataSelecionada);

  // Verifica se há agendamentos carregados no sistema
  if (!window.agendamentos || window.agendamentos.length === 0) {
    alert("Nenhum agendamento carregado no sistema.");
    return;
  }

  // Filtra os agendamentos para a data selecionada (no formato YYYY-MM-DD)
  const agendamentosDoDia = (window.agendamentos || []).filter(a => {
    const dataAg = a.data?.includes("/") 
      ? a.data.split("/").reverse().join("-") 
      : a.data;
    return dataAg === window.dataSelecionada;
  });

  console.log("📋 AGENDAMENTOS DISPONÍVEIS:");
  agendamentosDoDia.forEach((a, i) => {
    console.log(`#${i + 1}`, a.data, a.clienteNome || a.nomeCliente);
  });

  if (agendamentosDoDia.length === 0) {
    alert(`Nenhum agendamento encontrado para ${window.dataSelecionada}.`);
    return;
  }

  // Confirma com o usuário antes de enviar
  if (!confirm(`Enviar confirmação para ${agendamentosDoDia.length} clientes em ${window.dataSelecionada}?`)) {
    return;
  }

  let enviados = 0;

  for (const ag of agendamentosDoDia) {
    const nome = ag.clienteNome || ag.nomeCliente || "Cliente";
    const telefone = (ag.whatsapp || ag.telefone || "").replace(/\D/g, "");

    // Verifica se há telefone cadastrado
    if (!telefone) {
      console.warn(`⚠️ ${nome} sem telefone — ignorado.`);
      continue;
    }

    const mensagem = 
`Olá ${nome}! 👋
Confirmando o seu agendamento na *Cerâmica Fortes* para o dia ${ag.data}.
Qualquer dúvida, estamos à disposição!
📞 (86) 98812-5673`;

    try {
      const r = await fetch(`https://api.ultramsg.com/${INSTANCE_ID}/messages/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          token: TOKEN,
          to: `55${telefone.replace(/^55/, "")}`, // garante o DDI Brasil
          body: mensagem
        })
      });

      const data = await r.json();
      console.log("📨 Resposta UltraMsg:", data);

      if (data.sent) {
        enviados++;
      } else {
        console.warn(`⚠️ Falha ao enviar para ${nome}:`, data);
      }

      await delay(800);
    } catch (err) {
      console.error(`❌ Erro ao enviar para ${nome}:`, err);
    }
  }

  alert(`✅ Mensagens enviadas com sucesso para ${enviados} clientes.`);
}
