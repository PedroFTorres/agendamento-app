// ==========================================
// MÓDULO DE CONFIRMAÇÃO DE AGENDAMENTOS (UltraMsg)
// ==========================================
// Integrado ao calendário, sem alterar o crud.js.
// Adiciona botão 📢 e envia mensagens personalizadas.
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  const observer = new MutationObserver(() => {
    const calendarContainer = document.getElementById("calendar");
    if (calendarContainer && !document.getElementById("btnConfirmarAgendamentos")) {
      inserirBotaoConfirmar(calendarContainer);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
});

function inserirBotaoConfirmar(container) {
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

  document.getElementById("btnConfirmarAgendamentos").addEventListener("click", confirmarAgendamentosDoDia);
}

async function confirmarAgendamentosDoDia() {
  const dataSelecionada = window.dataSelecionada;
  if (!dataSelecionada) {
    alert("Selecione uma data no calendário primeiro!");
    return;
  }

  const INSTANCE_ID = "instance147478"; // UltraMsg
  const TOKEN = "c4j1m6wyghzhvhrd";

  const dataSelecionadaLimpa = (dataSelecionada || "").substring(0, 10);
  const dataBR = formatarDataBR(dataSelecionadaLimpa);

  const agendamentosDoDia = (window.agendamentos || []).filter(a => {
    if (!a.data) return false;
    const dataNormalizada = (a.data.length > 10) ? a.data.substring(0, 10) : a.data;
    const dataSelecionadaLimpaFinal = (window.dataSelecionada || "").substring(0, 10);
    return dataNormalizada === dataSelecionadaLimpaFinal;
  });

  if (agendamentosDoDia.length === 0) {
    alert(`Nenhum agendamento encontrado para ${dataBR}.`);
    return;
  }

  if (!confirm(`Deseja enviar mensagens de confirmação para ${agendamentosDoDia.length} agendamento(s) do dia ${dataBR}?`)) return;

  let enviados = 0;

  for (const ag of agendamentosDoDia) {
    const nome = ag.clienteNome || ag.cliente || "Cliente";
    const produto = ag.produtoNome || ag.produto || "produto";
    const quantidade = ag.quantidade || "";

    // Busca telefone no cadastro global de clientes
    const clienteCadastro = (window.clientes || []).find(c =>
      c.nome === nome || c.clienteNome === nome
    );
    
    const telefone = clienteCadastro
      ? (clienteCadastro.telefone || clienteCadastro.whatsapp || "").replace(/\D/g, "")
      : (ag.telefone || "").replace(/\D/g, "");

    if (!telefone) continue;

    const mensagem = `Olá ${nome}, no dia ${dataBR} há um agendamento de ${produto} (${quantidade}). Podemos confirmar? ✅`;

    try {
      const r = await fetch(`https://api.ultramsg.com/${INSTANCE_ID}/messages/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: TOKEN, to: telefone, body: mensagem })
      });
      await r.json();
      enviados++;
      await delay(800);
    } catch (err) {
      console.error(`Erro ao enviar para ${nome}:`, err);
    }
  }

  alert(`Mensagens enviadas com sucesso (${enviados}/${agendamentosDoDia.length}).`);
}

// ======= Funções auxiliares =======
function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function formatarDataBR(isoDate) {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}
