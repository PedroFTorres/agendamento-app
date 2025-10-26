// whatsappConfirmacao.js
console.log("⚙️ whatsappConfirmacao.js carregado.");

// ================================
// FUNÇÃO PRINCIPAL DE CONFIRMAÇÃO
// ================================
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
  if (!a.data) return false;

  // Converte "26/10/2025" → "2025-10-26"
  const partes = a.data.split("/");
  if (partes.length !== 3) return false;

  const [dia, mes, ano] = partes;
  const dataFormatada = `${ano}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
  
  // Compara com window.dataSelecionada
  const igual = dataFormatada === dataSelecionadaISO;
  if (igual) {
    console.log(`✅ Agendamento encontrado: ${a.clienteNome} (${a.data})`);
  }
  return igual;
});
  
  console.log("📋 Agendamentos do dia:", agendamentosDoDia.length);

  if (agendamentosDoDia.length === 0) {
    alert("Nenhum agendamento encontrado nesta data.");
    return;
  }

  // 🔗 UltraMsg API
  const INSTANCE_ID = "xxxxxx"; // Seu Instance ID
  const TOKEN = "xxxxxx";       // Seu Token UltraMsg

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
      console.log("✅ Enviado:", resultado);
    } catch (err) {
      console.error("❌ Erro ao enviar mensagem:", err);
    }
  }

  alert("Mensagens de confirmação enviadas!");
}

// =====================================
// INSERIR O BOTÃO ACIMA DO CALENDÁRIO
// =====================================
function criarBotaoConfirmacao() {
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

    calendario.parentElement.insertBefore(botao, calendario);
    console.log("✅ Botão de confirmação inserido acima do calendário!");
  }
}

// ======================================
// MONITOR CONTÍNUO — GARANTE QUE SURJA
// ======================================
document.addEventListener("DOMContentLoaded", () => {
  console.log("🕒 Monitorando calendário para inserir botão...");
  setInterval(() => {
    criarBotaoConfirmacao();
  }, 2000); // checa a cada 2 segundos
});
