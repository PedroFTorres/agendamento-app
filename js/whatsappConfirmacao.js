// whatsappConfirmacao.js
// 🔄 Envio de confirmações de agendamento via UltraMsg (com FormData para 100% de compatibilidade)

const INSTANCE_ID = "instance147478";
const TOKEN = "c4j1m6wyghzhvhrd";

// Função para atrasar os envios (evita bloqueio de API)
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function confirmarAgendamentosDoDia() {
  console.log("📅 Data selecionada:", window.dataSelecionada);

  // Verifica se há agendamentos carregados
  if (!window.agendamentos || window.agendamentos.length === 0) {
    alert("Nenhum agendamento carregado no sistema.");
    return;
  }

  // Filtra os agendamentos do dia selecionado
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

  // Confirma antes de enviar
  if (!confirm(`Deseja enviar confirmação para ${agendamentosDoDia.length} clientes?`)) return;

  let enviados = 0;

  for (const ag of agendamentosDoDia) {
    const nome = ag.clienteNome || ag.nomeCliente || "Cliente";
    const telefone = (ag.whatsapp || ag.telefone || "").replace(/\D/g, "");

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
      const formData = new FormData();
      formData.append("token", TOKEN);
      formData.append("to", `55${telefone.replace(/^55/, "")}`); // garante o formato brasileiro
      formData.append("body", mensagem);

      const r = await fetch(`https://api.ultramsg.com/${INSTANCE_ID}/messages/chat`, {
        method: "POST",
        body: formData
      });

      const data = await r.json();
      console.log("📨 Resposta UltraMsg:", data);

      if (data.sent || data.message || data.id) {
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
// 🔘 Insere automaticamente o botão "Confirmar Agendamentos do Dia" apenas na aba de Agendamentos
document.addEventListener("DOMContentLoaded", () => {
  const observer = new MutationObserver(() => {
    const paginaAgendamentosAtiva = document.querySelector(".page[data-page='agendamentos']");
    const calendario = document.querySelector("#calendar");

    if (paginaAgendamentosAtiva && calendario && !document.getElementById("botaoConfirmarAgendamentos")) {
      const botao = document.createElement("button");
      botao.id = "botaoConfirmarAgendamentos";
      botao.textContent = "📢 Confirmar Agendamentos do Dia";
      botao.className = "bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow mb-4";
      botao.style.display = "block";
      botao.style.margin = "15px 0 20px auto";
      botao.style.width = "100%";
      botao.onclick = confirmarAgendamentosDoDia;

      // insere o botão logo acima do calendário
      calendario.parentElement.insertBefore(botao, calendario);
      console.log("✅ Botão reposicionado corretamente na aba de Agendamentos.");
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
});
