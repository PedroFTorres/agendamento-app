// whatsappConfirmacao.js
console.log("⚙️ whatsappConfirmacao.js carregado.");

// ============================
// FUNÇÕES DE SUPORTE DE DATAS
// ============================
function zero2(n) { return String(n).padStart(2, "0"); }

function toISOFromDateObj(d) {
  return `${d.getFullYear()}-${zero2(d.getMonth() + 1)}-${zero2(d.getDate())}`;
}

function normalizarParaISO(valor) {
  if (!valor) return "";

  if (typeof valor === "string") {
    // já ISO
    if (/^\d{4}-\d{2}-\d{2}$/.test(valor.trim())) return valor.trim();
    // dd/mm/aaaa
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(valor.trim())) {
      const [d, m, y] = valor.trim().split("/");
      return `${y}-${zero2(m)}-${zero2(d)}`;
    }
    // string ISO longa
    if (/^\d{4}-\d{2}-\d{2}/.test(valor)) return valor.slice(0, 10);
  }

  if (valor instanceof Date) return toISOFromDateObj(valor);

  if (typeof valor === "object") {
    if (valor.seconds != null) return toISOFromDateObj(new Date(valor.seconds * 1000));
    if (valor.start instanceof Date) return toISOFromDateObj(valor.start);
    if (typeof valor.startStr === "string") return valor.startStr.slice(0, 10);
    if (typeof valor.data === "string") return normalizarParaISO(valor.data);
  }

  const d = new Date(valor);
  return isNaN(d) ? "" : toISOFromDateObj(d);
}

// ============================
// FUNÇÃO PRINCIPAL DE ENVIO
// ============================
async function confirmarAgendamentosDoDia() {
  if (!window.dataSelecionada) {
    alert("Selecione um dia no calendário para confirmar os agendamentos.");
    return;
  }

  const dataSelecionadaISO = window.dataSelecionada.slice(0, 10);
  console.log("📅 Data selecionada:", dataSelecionadaISO);

  const agendamentos = window.agendamentos || [];
  if (!Array.isArray(agendamentos) || agendamentos.length === 0) {
    alert("Nenhum agendamento carregado ainda.");
    return;
  }

  const agendamentosDoDia = agendamentos.filter(a => {
    const candidatos = [
      a.data,
      a.start,
      a.startStr,
      a.extendedProps?.data,
      a.extendedProps?.start,
      a.extendedProps?.startStr
    ].filter(v => v != null);

    let iso = "";
    for (const v of candidatos) {
      iso = normalizarParaISO(v);
      if (iso) break;
    }
    if (!iso) iso = normalizarParaISO(a);

    console.log("🔎 DATA AG:", {
      cliente: a.clienteNome || a.title,
      raw: a.data || a.start || a.startStr,
      normalizada: iso
    });

    return iso === dataSelecionadaISO;
  });

  console.log("📋 Agendamentos encontrados:", agendamentosDoDia.length, agendamentosDoDia);

  if (agendamentosDoDia.length === 0) {
    alert("Nenhum agendamento encontrado nesta data.");
    return;
  }

  // 🔗 Configuração UltraMsg
  const INSTANCE_ID = "COLOQUE_SEU_INSTANCE_ID";
  const TOKEN = "COLOQUE_SEU_TOKEN";

  for (const ag of agendamentosDoDia) {
    if (!ag.whatsapp) {
      console.warn(`⚠️ ${ag.clienteNome} sem telefone — ignorado.`);
      continue;
    }

    const numero = ag.whatsapp.replace(/\D/g, "");
    const mensagem = `Olá *${ag.clienteNome}*, no dia *${ag.data}* está agendado *${ag.produtoNome}* (${ag.quantidade}). Podemos confirmar?`;

    try {
      const resposta = await fetch(`https://api.ultramsg.com/${INSTANCE_ID}/messages/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          token: TOKEN,
          to: `55${numero}`,
          body: mensagem,
        }),
      });

      const resultado = await resposta.json();
      console.log("✅ Enviado:", resultado);
    } catch (err) {
      console.error("❌ Erro ao enviar mensagem:", err);
    }
  }

  alert("Mensagens de confirmação enviadas!");
}

// ============================
// INSERÇÃO AUTOMÁTICA DO BOTÃO
// ============================
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

// Observa continuamente o DOM até o calendário aparecer
document.addEventListener("DOMContentLoaded", () => {
  console.log("🕒 Aguardando calendário para inserir botão...");
  setInterval(() => criarBotaoConfirmacao(), 2000);
});
