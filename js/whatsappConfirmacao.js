// whatsappConfirmacao.js
console.log("⚙️ whatsappConfirmacao.js carregado.");

// Função principal de confirmação de agendamentos
async function confirmarAgendamentosDoDia() {
  if (!window.dataSelecionada) {
    alert("Selecione um dia no calendário para confirmar os agendamentos.");
    return;
  }

  const dataSelecionadaISO = window.dataSelecionada;
  console.log("📅 Data selecionada:", dataSelecionadaISO);

  const agendamentos = window.agendamentos || [];
  if (!Array.isArray(agendamentos) || agendamentos.length === 0) {
    alert("Nenhum agendamento carregado ainda.");
    return;
  }

  // 🔍 Filtra os agendamentos do dia selecionado
  const agendamentosDoDia = agendamentos.filter(a => {
    const dataAg = (a.data || "").replace(/\//g, "-");
    const partes = dataAg.split("-");
    if (partes.length === 3) {
      const [dia, mes, ano] = partes;
      const iso = `${ano}-${mes}-${dia}`;
      return iso === dataSelecionadaISO;
    }
    return false;
  });

  console.log("📋 Agendamentos do dia encontrados:", agendamentosDoDia.length);

  if (agendamentosDoDia.length === 0) {
    alert("Nenhum agendamento encontrado nesta data.");
    return;
  }

  // 🔗 Configuração UltraMsg
  const INSTANCE_ID = "xxxxxx"; // substitua pelo seu ID UltraMsg
  const TOKEN = "xxxxxx";       // substitua pelo seu token UltraMsg

  for (const ag of agendamentosDoDia) {
    if (!ag.whatsapp) {
      console.warn(`⚠️ ${ag.clienteNome} sem telefone — ignorado.`);
      continue;
    }

    const numero = ag.whatsapp.replace(/\D/g, "");
    const mensagem = `Olá *${ag.clienteNome}*, no dia *${ag.data}* está agendado *${ag.produtoNome}* (${ag.quantidade}). Podemos confirmar?`;

    try {
      const resposta = await fetch(
        `https://api.ultramsg.com/${INSTANCE_ID}/messages/chat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            token: TOKEN,
            to: `55${numero}`,
            body: mensagem,
          }),
        }
      );

      const resultado = await resposta.json();
      console.log("✅ Mensagem enviada:", resultado);
    } catch (err) {
      console.error("❌ Erro ao enviar mensagem:", err);
    }
  }

  alert("Mensagens de confirmação enviadas!");
}

// 🧠 Observa o carregamento do calendário e insere o botão automaticamente
const observer = new MutationObserver(() => {
  const calendario = document.querySelector("#calendar");

  if (calendario && !document.getElementById("botaoConfirmarAgendamentos")) {
    const botao = document.createElement("button");
    botao.id = "botaoConfirmarAgendamentos";
    botao.textContent = "📢 Confirmar Agendamentos do Dia";
    botao.className = "bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow";
    botao.style.display = "block";
    botao.style.margin = "10px auto";
    botao.style.maxWidth = "400px";
    botao.style.width = "100%";
    botao.onclick = confirmarAgendamentosDoDia;

    // Insere o botão logo acima do calendário
    calendario.parentElement.insertBefore(botao, calendario);
    console.log("✅ Botão 'Confirmar Agendamentos do Dia' adicionado.");
  }
});

observer.observe(document.body, { childList: true, subtree: true });

