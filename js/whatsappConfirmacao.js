// ==========================================
// MÓDULO DE CONFIRMAÇÃO DE AGENDAMENTOS (UltraMsg)
// ==========================================
// Funciona de forma independente, sem modificar o crud.js.
// Adiciona o botão 📢 e envia mensagens de confirmação via WhatsApp.
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  // Observa mudanças no DOM (quando o calendário é renderizado)
  const observer = new MutationObserver(() => {
    const calendarContainer = document.getElementById("calendar");
    if (calendarContainer && !document.getElementById("btnConfirmarAgendamentos")) {
      inserirBotaoConfirmar(calendarContainer);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
});

function inserirBotaoConfirmar(container) {
  // Cria o cabeçalho com botão de confirmação
  const cabecalho = document.createElement("div");
  cabecalho.className = "flex justify-between items-center mb-4";
  cabecalho.innerHTML = `
    <h2 class="text-2xl font-bold">Agendamentos</h2>
    <button 
      id="btnConfirmarAgendamentos"
      class="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 flex items-center gap-2">
      📢 Confirmar Agendamentos
    </button>
  `;
  container.prepend(cabecalho);

  // Ativa o clique do botão
  document.getElementById("btnConfirmarAgendamentos").addEventListener("click", confirmarAgendamentosDoDia);
}

async function confirmarAgendamentosDoDia() {
  const dataSelecionada = window.dataSelecionada;

  if (!dataSelecionada) {
    alert("Selecione uma data no calendário primeiro!");
    return;
  }

  const INSTANCE_ID = "instance147478"; // sua instância UltraMsg
  const TOKEN = "c4j1m6wyghzhvhrd";     // seu token UltraMsg

  // 🔹 Ajusta formato da data
  const dataSelecionadaLimpa = (dataSelecionada || "").substring(0, 10);
  const dataBR = formatarDataBR(dataSelecionadaLimpa);

  // 🔹 Filtra os agendamentos do dia (corrigido para formato BR)
  const agendamentosDoDia = (window.agendamentos || []).filter(a => {
    if (!a.data) return false;

    // Converte "26/10/2025" → "2025-10-26"
    const [dia, mes, ano] = a.data.split("/");
    const iso = `${ano}-${mes}-${dia}`;

    // Log para depuração
    console.log("Comparando", iso, "com", dataSelecionadaLimpa);

    // Faz comparação limpa
    return iso === dataSelecionadaLimpa;
  });

  if (agendamentosDoDia.length === 0) {
    alert(`Nenhum agendamento encontrado para ${dataBR}.`);
    return;
  }

  if (!confirm(`Deseja enviar mensagens de confirmação para ${agendamentosDoDia.length} agendamento(s) do dia ${dataBR}?`)) return;

  let enviados = 0;

  for (const ag of agendamentosDoDia) {
    const nome = ag.cliente || "Cliente";
    const produto = ag.produto || "produto";
    const quantidade = ag.quantidade || "";
    const telefone = (ag.telefone || "").replace(/\D/g, "");

    if (!telefone) {
      console.warn(`⚠️ ${nome} sem telefone — ignorado.`);
      continue;
    }

    const mensagem = `Olá ${nome}, no dia ${dataBR} há um agendamento de ${produto} (${quantidade}). Podemos confirmar? ✅`;

    try {
      const r = await fetch(`https://api.ultramsg.com/${INSTANCE_ID}/messages/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: TOKEN, to: telefone, body: mensagem })
      });

      const data = await r.json();
      console.log(`✅ Mensagem enviada para ${nome} (${telefone})`, data);
      enviados++;
      await delay(800);
    } catch (err) {
      console.error(`❌ Erro ao enviar para ${nome}`, err);
    }
  }

  alert(`Mensagens enviadas com sucesso (${enviados}/${agendamentosDoDia.length}).`);
}

// ======= FUNÇÕES AUXILIARES =======
function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function formatarDataBR(isoDate) {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}
