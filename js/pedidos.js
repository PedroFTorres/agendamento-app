function escapeHtml(texto) {
  return String(texto == null ? "" : texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatarDataPedido(valor) {
  if (!valor) return "-";
  if (valor && typeof valor.toDate === "function") {
    return valor.toDate().toLocaleDateString("pt-BR");
  }
  if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [ano, mes, dia] = valor.split("-");
    return `${dia}/${mes}/${ano}`;
  }
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "-";
  return data.toLocaleDateString("pt-BR");
}

function formatarCampoCliente(valor) {
  const campo = String(valor || "").trim();
  return campo || "-";
}

function formatarEnderecoCliente(cliente = {}) {
  const partes = [cliente.endereco, cliente.numero, cliente.bairro, cliente.cidade, cliente.uf]
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  if (!partes.length) return "-";
  return partes.join(" • ");
}

function normalizarItensPedido(pedido = {}) {
  if (Array.isArray(pedido.itens) && pedido.itens.length) {
    return pedido.itens
      .map((item) => ({
        produtoNome: String(item.produtoNome || item.produto || "").trim(),
        quantidade: Number(item.quantidade || 0)
      }))
      .filter((item) => item.produtoNome && item.quantidade > 0);
  }

  const produtoNome = String(pedido.produtoNome || "").trim();
  const quantidade = Number(pedido.quantidade || 0);
  return produtoNome && quantidade > 0 ? [{ produtoNome, quantidade }] : [];
}

function formatarQuantidadePedido(valor) {
  if (typeof formatQuantidade === "function") {
    return formatQuantidade(valor);
  }
  return valor == null ? "-" : Number(valor).toLocaleString("pt-BR");
}

function formatarItensPedidoTexto(pedido = {}) {
  const itens = normalizarItensPedido(pedido);
  if (!itens.length) return pedido.produtoNome || "-";

  return itens
    .map((item) => `${item.produtoNome} (${formatarQuantidadePedido(item.quantidade)})`)
    .join(", ");
}

function obterTotalQuantidadePedido(pedido = {}) {
  const itens = normalizarItensPedido(pedido);
  if (!itens.length) return Number(pedido.quantidade || 0);
  return itens.reduce((total, item) => total + Number(item.quantidade || 0), 0);
}

function obterPrazoPedido(pedido) {
  const prazoPagamento = String(pedido.prazoPagamento || "").trim();
  return prazoPagamento || "-";
}

async function obterDataCarregamentoPedido(pedido) {
  const agendamentoIds = Array.isArray(pedido.agendamentoIds) && pedido.agendamentoIds.length
    ? pedido.agendamentoIds
    : (pedido.agendamentoId ? [pedido.agendamentoId] : []);

  for (const agendamentoId of agendamentoIds) {
    try {
      const snap = await db.collection("agendamentos").doc(agendamentoId).get();
      const data = snap.data()?.data;
      if (data) return formatarDataPedido(data);
    } catch (_) {
      // Continua para tentar outras referencias do pedido.
    }
  }

  if (pedido.codigo) {
    try {
      const snap = await db.collection("agendamentos")
        .where("pedidoId", "==", pedido.codigo)
        .limit(1)
        .get();

      if (!snap.empty) {
        const data = snap.docs[0].data()?.data;
        if (data) return formatarDataPedido(data);
      }
    } catch (_) {
      // Se nao encontrar no agendamento, usa a data salva no pedido como fallback.
    }
  }

  return formatarDataPedido(pedido.data);
}

function formatarDataWhatsapp(valor) {
  if (!valor) return "-";
  if (valor && typeof valor.toDate === "function") {
    return valor.toDate().toLocaleDateString("pt-BR");
  }
  if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [ano, mes, dia] = valor.split("-");
    return `${dia}/${mes}/${ano}`;
  }
  return formatarDataPedido(valor);
}

function normalizarNumeroWhatsapp(valor) {
  const digitos = String(valor || "").replace(/\D/g, "");
  if (!digitos) return "";
  if (digitos.startsWith("55")) return digitos;
  return `55${digitos}`;
}

function abrirUrlWhatsapp(numero, mensagem) {
  const numeroNormalizado = normalizarNumeroWhatsapp(numero);
  if (!numeroNormalizado) return false;
  const url = `https://wa.me/${numeroNormalizado}?text=${encodeURIComponent(mensagem)}`;
  window.open(url, "_blank", "noopener");
  return true;
}

async function abrirWhatsappPedidoAprovado(pedido, dataAgendada) {
  const cliente = await buscarDadosClientePedido(pedido);
  await imprimirPedidoPdf(pedido, cliente);

  const mensagem = [
    `Olá, ${pedido.clienteNome || "cliente"}.`,
    `Seu pedido ${pedido.codigo || ""} foi aprovado com carregamento para ${formatarDataWhatsapp(dataAgendada)}.`,
    `Produtos: ${formatarItensPedidoTexto(pedido)}.`,
    `Quantidade total: ${formatarQuantidadePedido(obterTotalQuantidadePedido(pedido))}.`,
    "O PDF do pedido foi gerado para anexar nesta conversa."
  ].filter(Boolean).join("\n");

  if (!abrirUrlWhatsapp(cliente.whatsapp || pedido.clienteWhatsapp, mensagem)) {
    alert("Pedido aprovado, mas este cliente não tem WhatsApp cadastrado.");
  }
}

async function abrirWhatsappPedidoAtualizado(pedidoAnterior, pedidoAtualizado, dataAnterior, novaData) {
  const cliente = await buscarDadosClientePedido(pedidoAtualizado);
  const itensAntes = formatarItensPedidoTexto(pedidoAnterior);
  const itensDepois = formatarItensPedidoTexto(pedidoAtualizado);
  const quantidadeAntes = obterTotalQuantidadePedido(pedidoAnterior);
  const quantidadeDepois = obterTotalQuantidadePedido(pedidoAtualizado);
  const linhasAlteracoes = [];

  if (dataAnterior !== novaData) {
    linhasAlteracoes.push(`Data: ${formatarDataWhatsapp(dataAnterior)} -> ${formatarDataWhatsapp(novaData)}`);
  }
  if (itensAntes !== itensDepois || Number(quantidadeAntes || 0) !== Number(quantidadeDepois || 0)) {
    linhasAlteracoes.push(`Pedido: ${itensAntes} -> ${itensDepois}`);
    linhasAlteracoes.push(`Quantidade total: ${formatarQuantidadePedido(quantidadeAntes)} -> ${formatarQuantidadePedido(quantidadeDepois)}`);
  }

  if (!linhasAlteracoes.length) return;

  await imprimirPedidoPdf(pedidoAtualizado, cliente);

  const mensagem = [
    `Olá, ${pedidoAtualizado.clienteNome || "cliente"}.`,
    `Houve uma atualização no seu pedido ${pedidoAtualizado.codigo || ""}:`,
    ...linhasAlteracoes,
    `Nova data do carregamento: ${formatarDataWhatsapp(novaData)}.`,
    "O PDF atualizado do pedido foi gerado para anexar nesta conversa."
  ].join("\n");

  if (!abrirUrlWhatsapp(cliente.whatsapp || pedidoAtualizado.clienteWhatsapp, mensagem)) {
    alert("Pedido atualizado, mas este cliente não tem WhatsApp cadastrado.");
  }
}

async function carregarLogoDataUrl() {
  try {
    const blob = await fetch("img/logo.png").then((r) => r.blob());
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    return null;
  }
}

const cacheClientePedido = new Map();

async function buscarDadosClientePedido(pedido) {
  const chave = `${pedido.userId || ""}::${pedido.clienteNome || ""}`;
  if (cacheClientePedido.has(chave)) {
    return cacheClientePedido.get(chave);
  }

  const snapshotPedido = {
    nome: pedido.clienteNome || "",
    cnpj: pedido.clienteCnpj || "",
    whatsapp: pedido.clienteWhatsapp || "",
    ie: pedido.clienteIe || "",
    endereco: pedido.clienteEndereco || "",
    numero: pedido.clienteNumero || "",
    bairro: pedido.clienteBairro || "",
    cidade: pedido.clienteCidade || "",
    uf: pedido.clienteUf || ""
  };

  if (snapshotPedido.cnpj || snapshotPedido.whatsapp || snapshotPedido.endereco) {
    cacheClientePedido.set(chave, snapshotPedido);
    return snapshotPedido;
  }

  try {
    let query = db.collection("clientes").where("nome", "==", pedido.clienteNome || "").limit(5);
    if (pedido.userId) {
      query = query.where("userId", "==", pedido.userId).limit(5);
    }

    const snap = await query.get();
    const cliente = snap.empty ? snapshotPedido : (snap.docs[0].data() || snapshotPedido);
    cacheClientePedido.set(chave, cliente);
    return cliente;
  } catch (e) {
    cacheClientePedido.set(chave, snapshotPedido);
    return snapshotPedido;
  }
}

async function imprimirPedidoPdf(pedido, cliente = {}) {
  const jsPdfLib = window.jspdf || {};
  const jsPDF = jsPdfLib.jsPDF;

  if (!jsPDF) {
    alert("Biblioteca de PDF não encontrada.");
    return;
  }

  const doc = new jsPDF();
  const emissao = formatarDataPedido(pedido.createdAt);
  const prazo = obterPrazoPedido(pedido);
  const dataCarregamento = await obterDataCarregamentoPedido(pedido);

  const itensTexto = formatarItensPedidoTexto(pedido);
  const quantidade = formatarQuantidadePedido(obterTotalQuantidadePedido(pedido));

const logo = await carregarLogoDataUrl();

  if (logo) {
    doc.addImage(logo, "PNG", 14, 10, 22, 22);
  }

  doc.setTextColor(31, 59, 100);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Detalhes do Pedido", 40, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.text(`Emissão: ${emissao}`, 40, 24);

  doc.setDrawColor(31, 59, 100);
  doc.setLineWidth(0.5);
  doc.line(14, 36, 196, 36);

  const margemX = 14;
  const larguraPagina = 182;
  const gap = 6;
  const larguraColuna = (larguraPagina - gap) / 2;

  function desenharTituloSecao(titulo, posY) {
    doc.setTextColor(31, 41, 55);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(titulo, margemX, posY);
    return posY + 7;
  }

  function desenharCampo(rotulo, valor, x, posY, larguraCampo) {
    const texto = String(valor || "-");
    const linhas = doc.splitTextToSize(texto, larguraCampo - 8);
    const altura = Math.max(18, 11 + linhas.length * 5);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, posY, larguraCampo, altura, 2, 2, "FD");

    doc.setTextColor(31, 41, 55);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(`${rotulo}:`, x + 4, posY + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(linhas, x + 4, posY + 12);

    return posY + altura + 4;
  }

  function desenharLinhaDupla(campoA, campoB, posY) {
    const yA = desenharCampo(campoA[0], campoA[1], margemX, posY, larguraColuna);
    const yB = desenharCampo(campoB[0], campoB[1], margemX + larguraColuna + gap, posY, larguraColuna);
    return Math.max(yA, yB);
  }

  let y = 46;
  y = desenharTituloSecao("Informações do Pedido", y);
  y = desenharLinhaDupla(["Pedido", pedido.codigo || "-"], ["Status", pedido.status || "-"], y);
  y = desenharLinhaDupla(["Representante", pedido.representanteNome || "-"], ["Prazo", prazo], y);
  y = desenharCampo("Produtos", itensTexto, margemX, y, larguraPagina);
  y = desenharLinhaDupla(["Quantidade total", quantidade], ["Data do carregamento", dataCarregamento], y);
  y = desenharCampo("Observação", pedido.observacao || "-", margemX, y, larguraPagina);

  y += 3;
  y = desenharTituloSecao("Dados do Cliente", y);
  y = desenharLinhaDupla(
    ["Cliente", formatarCampoCliente(cliente.nome || pedido.clienteNome)],
    ["CNPJ/CPF", formatarCampoCliente(cliente.cnpj)],
    y
  );
  y = desenharLinhaDupla(
    ["WhatsApp", formatarCampoCliente(cliente.whatsapp)],
    ["Inscrição Estadual", formatarCampoCliente(cliente.ie)],
    y
  );
  y = desenharCampo("Endereço", formatarEnderecoCliente(cliente), margemX, y, larguraPagina);

  doc.save(`pedido-${pedido.codigo || pedido.id || "sem-codigo"}.pdf`);
}

async function abrirModalDetalhesPedido(pedido) {
  const cliente = await buscarDadosClientePedido(pedido);
  const modal = document.createElement("div");
 modal.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3";

  const emissao = formatarDataPedido(pedido.createdAt);
   const prazo = obterPrazoPedido(pedido);
  const dataCarregamento = await obterDataCarregamentoPedido(pedido);
 const itensTexto = formatarItensPedidoTexto(pedido);
  const quantidade = formatarQuantidadePedido(obterTotalQuantidadePedido(pedido));

  modal.innerHTML = `
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200">
      <div class="px-5 py-4 text-white" style="background: linear-gradient(90deg, #1f3b64 0%, #2b4f86 100%);">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <img src="img/logo.png" alt="Logo" class="h-10 w-10 rounded-full bg-white p-1 object-contain" onerror="this.style.display='none'" />
            <div>
              <h3 class="text-xl font-bold leading-tight">Detalhes do Pedido</h3>
              <p class="text-xs text-blue-100">Visualização administrativa e impressão profissional</p>
            </div>
          </div>
          <span class="text-xs px-3 py-1 rounded-full font-semibold" style="background: #f28c28; color: #1f3b64;">${escapeHtml(pedido.status || "-")}</span>
        </div>
      </div>

      <div class="p-5 space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div class="bg-slate-50 rounded-lg p-3"><span class="font-semibold text-slate-700">Número:</span> ${escapeHtml(pedido.codigo || "-")}</div>
          <div class="bg-slate-50 rounded-lg p-3"><span class="font-semibold text-slate-700">Data de emissão:</span> ${escapeHtml(emissao)}</div>
          <div class="bg-slate-50 rounded-lg p-3"><span class="font-semibold text-slate-700">Representante:</span> ${escapeHtml(pedido.representanteNome || "-")}</div>
          <div class="bg-slate-50 rounded-lg p-3 md:col-span-2"><span class="font-semibold text-slate-700">Produtos:</span> ${escapeHtml(itensTexto)}</div>
          <div class="bg-slate-50 rounded-lg p-3"><span class="font-semibold text-slate-700">Quantidade total:</span> ${escapeHtml(quantidade)}</div>
          <div class="bg-slate-50 rounded-lg p-3"><span class="font-semibold text-slate-700">Prazo:</span> ${escapeHtml(prazo || "-")}</div>
          <div class="bg-slate-50 rounded-lg p-3"><span class="font-semibold text-slate-700">Data do carregamento:</span> ${escapeHtml(dataCarregamento || "-")}</div>
          <div class="md:col-span-2 bg-orange-50 rounded-lg p-3 border border-orange-100"><span class="font-semibold text-slate-700">Observação:</span> ${escapeHtml(pedido.observacao || "-")}</div>
        </div>

        <div class="border border-slate-200 rounded-lg p-4">
          <h4 class="font-bold text-slate-800 mb-3">Dados do Cliente</h4>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div><span class="font-semibold">Nome:</span> ${escapeHtml(formatarCampoCliente(cliente.nome || pedido.clienteNome))}</div>
            <div><span class="font-semibold">CNPJ/CPF:</span> ${escapeHtml(formatarCampoCliente(cliente.cnpj))}</div>
            <div><span class="font-semibold">WhatsApp:</span> ${escapeHtml(formatarCampoCliente(cliente.whatsapp))}</div>
            <div><span class="font-semibold">Inscrição Estadual:</span> ${escapeHtml(formatarCampoCliente(cliente.ie))}</div>
            <div class="md:col-span-2"><span class="font-semibold">Endereço:</span> ${escapeHtml(formatarEnderecoCliente(cliente))}</div>
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-2 px-5 py-4 border-t border-slate-200 bg-slate-50">
        <button id="btn-imprimir-pedido" class="text-white px-4 py-2 rounded font-semibold" style="background-color:#1f3b64;">
          Imprimir PDF
        </button>
       <button id="btn-fechar-pedido" class="text-white px-4 py-2 rounded font-semibold" style="background-color:#6b7280;">
          Fechar
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("btn-fechar-pedido").onclick = () => modal.remove();
   document.getElementById("btn-imprimir-pedido").onclick = () => imprimirPedidoPdf(pedido, cliente);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });
}
// ================== APROVAR PEDIDO ==================
async function aprovarPedido(id, btn) {

  if (btn) btn.disabled = true;

  try {
    const doc = await db.collection("pedidos").doc(id).get();
    const p = doc.data();
    const user = await waitForAuth();

      if (PERFIL !== "admin") {
      alert("Sem permissão para aprovar");
      if (btn) btn.disabled = false;
      return;
    }

    const modal = document.createElement("div");
    modal.className = "fixed inset-0 bg-black bg-opacity-50 flex items-start sm:items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto";

    modal.innerHTML = `
      <style>
        #modal-aprovacao-conteudo {
          width: min(100%, 48rem);
          max-width: calc(100vw - 1rem);
          min-width: 0;
          overflow-x: hidden;
        }
        #calendar-aprovacao,
        #calendar-aprovacao .fc,
        #calendar-aprovacao .fc-view-harness,
        #calendar-aprovacao .fc-view,
        #calendar-aprovacao .fc-scrollgrid {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
        }
        #calendar-aprovacao table {
          width: 100% !important;
          table-layout: fixed;
        }
        #calendar-aprovacao .fc-toolbar {
          flex-wrap: wrap;
          gap: .5rem;
        }
        #calendar-aprovacao .fc-toolbar-title {
          font-size: 1.1rem;
          line-height: 1.25;
          text-align: center;
          overflow-wrap: anywhere;
        }
        #calendar-aprovacao .fc-daygrid-day-frame {
          min-width: 0;
          min-height: 70px;
        }
        #calendar-aprovacao .fc-daygrid-event,
        #calendar-aprovacao .fc-event-main,
        #calendar-aprovacao .fc-event-title {
          max-width: 100%;
          min-width: 0;
          white-space: normal !important;
          overflow: hidden;
          overflow-wrap: anywhere;
          word-break: break-word;
        }
        @media (max-width: 640px) {
          #modal-aprovacao-conteudo {
            max-width: calc(100vw - 1rem);
            padding: .75rem;
          }
          #calendar-aprovacao .fc-toolbar {
            display: grid;
            grid-template-columns: 1fr;
            justify-items: center;
          }
          #calendar-aprovacao .fc-toolbar-chunk {
            max-width: 100%;
          }
          #calendar-aprovacao .fc-toolbar-title {
            font-size: 1rem;
          }
          #calendar-aprovacao .fc-button {
            padding: .3rem .5rem;
            font-size: .8rem;
          }
          #calendar-aprovacao .fc-col-header-cell-cushion,
          #calendar-aprovacao .fc-daygrid-day-number {
            font-size: .72rem;
            padding: 2px;
          }
          #calendar-aprovacao .fc-daygrid-day-frame {
            min-height: 52px;
          }
          #calendar-aprovacao .fc-daygrid-event {
            font-size: .65rem;
            margin: 1px;
          }
        }
      </style>
      <div id="modal-aprovacao-conteudo" class="bg-white rounded shadow max-h-[95vh] overflow-y-auto">
        <div class="p-3 sm:p-4">
          <h3 class="text-lg font-bold mb-2">Escolher data do agendamento</h3>
          <div class="w-full min-w-0 overflow-hidden">
            <div id="calendar-aprovacao" class="w-full max-w-full min-w-0"></div>
          </div>
        </div>


        <div class="text-right px-3 sm:px-4 pb-3 sm:pb-4">
          <button id="fechar-modal" class="bg-gray-400 text-white px-3 py-1 rounded">
            Cancelar
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById("fechar-modal").onclick = () => {
      modal.remove();
      if (btn) btn.disabled = false;
    };

    const snap = await db.collection("agendamentos").get();

    const eventos = snap.docs.map(doc => {
      const d = doc.data();
      return {
        title: `${d.produtoNome || ""} (${d.quantidade || 0})`,
        start: d.data
      };
    });

    let clicado = false;
    const isMobile = window.matchMedia("(max-width: 640px)").matches;

    const calendar = new FullCalendar.Calendar(
      document.getElementById("calendar-aprovacao"),
      {
        initialView: "dayGridMonth",
        aspectRatio: isMobile ? 0.95 : 1.35,
        locale: "pt-br",
        height: "auto",
        contentHeight: "auto",
        expandRows: true,
        handleWindowResize: true,
        windowResizeDelay: 150,
        headerToolbar: {
          left: "prev,next",
          center: "title",
          right: ""
        },
        events: eventos,

        dateClick: async function(info) {

          if (clicado) return;
          clicado = true;

          const dataEscolhida = info.dateStr;

          try {

           const itensPedido = normalizarItensPedido(p);
            const agRefs = [];

            for (const item of itensPedido) {
              const agRef = await db.collection("agendamentos").add({
                userId: p.userId,
                clienteNome: p.clienteNome,
                produtoNome: item.produtoNome,
                quantidade: item.quantidade,
                representanteNome: p.representanteNome,
                criadoPor: p.userId,
                pedidoId: p.codigo || id,
                data: dataEscolhida,
                observacao: p.observacao || "",
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
              });
              agRefs.push(agRef.id);
            }

            await db.collection("pedidos").doc(id).update({
              status: "aprovado",
              agendamentoId: agRefs[0] || "",
              agendamentoIds: agRefs,
              data: dataEscolhida,
              notificadoAprovado: true
            });

            // 🔔 MARCAR NOTIFICAÇÃO DO ADMIN COMO LIDA
            const notifSnap = await db.collection("notificacoes")
              .where("pedidoId", "==", p.codigo)
              .where("userId", "==", user.uid)
              .get();

            notifSnap.forEach(doc => {
              doc.ref.update({ lida: true });
            });
            
            // 🔔 Notificar representante
            await db.collection("notificacoes").add({
              userId: p.userId,
              pedidoId: p.codigo,
              texto: `✅ Pedido ${p.codigo} foi aprovado para o dia ${dataEscolhida}.`,
              lida: false,
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            alert("Pedido aprovado e agendado!");
            await abrirWhatsappPedidoAprovado({
              id,
              ...p,
              status: "aprovado",
              agendamentoId: agRefs[0] || "",
              agendamentoIds: agRefs,
              data: dataEscolhida
            }, dataEscolhida);
            modal.remove();

          } catch (e) {
            clicado = false;
            alert("Erro ao salvar agendamento");
          }
        }
      }
    );

    calendar.render();

  } catch (e) {
    if (btn) btn.disabled = false;
    alert("Erro ao abrir aprovação");
  }
}


// ================== CANCELAR PEDIDO ==================
async function cancelarPedido(id, btn) {

  if (btn) btn.disabled = true;

  const motivo = prompt("Motivo do cancelamento:");

  if (!motivo) {
    if (btn) btn.disabled = false;
    return;
  }

  try {

    const docPedido = await db.collection("pedidos").doc(id).get();
    const p = docPedido.data();
   const user = await waitForAuth();

      if (PERFIL !== "admin") {
      alert("Sem permissão para cancelar");
      if (btn) btn.disabled = false;
      return;
    }

    if (!docPedido.exists || !p) {
      alert("Pedido não encontrado");
      if (btn) btn.disabled = false;
      return;
    }

    if (!["pendente", "aprovado"].includes(p.status)) {
      alert("Este pedido não pode ser cancelado");
      if (btn) btn.disabled = false;
      return;
    }

    const pedidoRef = db.collection("pedidos").doc(id);
    const agendamentoIds = p.status === "aprovado"
      ? (Array.isArray(p.agendamentoIds) && p.agendamentoIds.length
        ? p.agendamentoIds
        : (p.agendamentoId ? [p.agendamentoId] : []))
      : [];

    const batch = db.batch();
    agendamentoIds.forEach((agendamentoId) => {
      batch.delete(db.collection("agendamentos").doc(agendamentoId));
    });
    batch.update(pedidoRef, {
      status: "cancelado",
      motivoCancelamento: motivo,
      notificadoCancelado: true,
      agendamentoId: "",
      agendamentoIds: []
    });
    await batch.commit();

    // 🔔 MARCAR NOTIFICAÇÃO DO ADMIN COMO LIDA
    const notifSnap = await db.collection("notificacoes")
      .where("pedidoId", "==", p.codigo)
      .where("userId", "==", user.uid)
      .get();

    notifSnap.forEach(doc => {
      doc.ref.update({ lida: true });
    });

    // 🔔 Notificar representante
    await db.collection("notificacoes").add({
      userId: p.userId,
      pedidoId: p.codigo,
      texto: `❌ Pedido ${p.codigo} foi cancelado. Motivo: ${motivo}`,
      lida: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });


    alert("Pedido cancelado!");

  } catch (e) {
    if (btn) btn.disabled = false;
    alert("Erro ao cancelar pedido");
  }
}

async function editarPedidoAprovado(id) {

  const doc = await db.collection("pedidos").doc(id).get();
  const p = doc.data();

  const user = await waitForAuth();

  if (PERFIL !== "admin") {
    alert("Sem permissão");
    return;
  }

  // 🔥 pega data atual do pedido/agendamento
  let dataAtual = p.data || "";
  
  if (!dataAtual && p.agendamentoId) {
    const agSnap = await db.collection("agendamentos").doc(p.agendamentoId).get();
    dataAtual = agSnap.data()?.data || "";
  }

  const itensPedido = normalizarItensPedido(p);
  const itensEditaveis = itensPedido.length ? itensPedido : [{ produtoNome: p.produtoNome || "", quantidade: Number(p.quantidade || 0) }];
  const produtosSnap = await db.collection("produtos").get();
  const nomesProdutos = [];
  const nomesUnicos = new Set();

  produtosSnap.forEach((produtoDoc) => {
    const nome = String(produtoDoc.data()?.nome || "").trim();
    const chave = nome.toLowerCase();
    if (!nome || nomesUnicos.has(chave)) return;
    nomesUnicos.add(chave);
    nomesProdutos.push(nome);
  });
  nomesProdutos.sort((a, b) => a.localeCompare(b, "pt-BR"));

  const optionsProdutos = nomesProdutos
    .map((nome) => `<option value="${escapeHtml(nome)}"></option>`)
    .join("");

  function montarLinhaItem(item) {
    return `
      <div class="edit-item grid grid-cols-1 sm:grid-cols-12 gap-2 items-end border rounded p-2">
        <label class="sm:col-span-7 text-sm">
          <span class="block mb-1">Produto</span>
          <input class="edit-produto w-full border p-2" list="edit-produtos-lista" value="${escapeHtml(item.produtoNome)}" placeholder="Produto">
        </label>
        <label class="sm:col-span-4 text-sm">
          <span class="block mb-1">Quantidade</span>
          <input class="edit-qtd w-full border p-2" type="number" min="1" value="${Number(item.quantidade || 0)}" placeholder="Quantidade">
        </label>
        <button type="button" class="remover-edit-item bg-red-600 text-white px-2 py-2 rounded sm:col-span-1">×</button>
      </div>
    `;
  }
  
  // 🔥 cria modal
  const modal = document.createElement("div");
  modal.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4";

  modal.innerHTML = `
    <div class="bg-white p-4 rounded shadow w-full max-w-2xl max-h-[95vh] overflow-y-auto">
      <h3 class="text-lg font-bold mb-3">Editar Pedido</h3>
      <p class="text-xs text-gray-500 mb-3">Edição permitida somente para administradores.</p>
      <h3 class="text-lg font-bold mb-3">Editar Pedido</h3>

      <datalist id="edit-produtos-lista">${optionsProdutos}</datalist>

      <div id="edit-itens" class="space-y-2 mb-3">
        ${itensEditaveis.map(montarLinhaItem).join("")}
      </div>

      <button id="adicionar-edit-item" type="button" class="border border-blue-600 text-blue-700 px-3 py-2 rounded w-full mb-3">
        + Adicionar produto
      </button>
      
     <label class="block mb-1">Data/Dia</label>
      <input id="edit-data" type="date" value="${escapeHtml(dataAtual)}" class="w-full border p-2 mb-3"/>

      <label class="block mb-1">Prazo de pagamento</label>
      <select id="edit-prazo" class="w-full border p-2 mb-3">
        ${["À vista", "10 dias", "15 dias", "30 dias", "30/60 dias"]
          .map((prazo) => `<option value="${prazo}" ${prazo === (p.prazoPagamento || "") ? "selected" : ""}>${prazo}</option>`)
          .join("")}
      </select>

      <label class="block mb-1">Observação do pedido</label>
      <input id="edit-obs" type="text" value="${escapeHtml(p.observacao || "")}" class="w-full border p-2 mb-3" placeholder="Observações"/>

      <div class="flex justify-end space-x-2">
        <button id="cancelar-edit" class="bg-gray-400 text-white px-3 py-1 rounded">
          Cancelar
        </button>
        <button id="salvar-edit" class="bg-blue-600 text-white px-3 py-1 rounded">
          Salvar
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const containerItens = modal.querySelector("#edit-itens");

  function atualizarBotoesRemover() {
    const linhas = modal.querySelectorAll(".edit-item");
    linhas.forEach((linha) => {
      linha.querySelector(".remover-edit-item")?.classList.toggle("hidden", linhas.length === 1);
    });
  }

  function registrarRemocao(linha) {
    linha.querySelector(".remover-edit-item")?.addEventListener("click", () => {
      linha.remove();
      atualizarBotoesRemover();
    });
  }

  modal.querySelectorAll(".edit-item").forEach(registrarRemocao);
  atualizarBotoesRemover();

  modal.querySelector("#adicionar-edit-item").onclick = () => {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = montarLinhaItem({ produtoNome: "", quantidade: 0 }).trim();
    const linha = wrapper.firstElementChild;
    containerItens.appendChild(linha);
    registrarRemocao(linha);
    atualizarBotoesRemover();
  };

  // cancelar
  document.getElementById("cancelar-edit").onclick = () => modal.remove();

  // salvar
  document.getElementById("salvar-edit").onclick = async () => {

    const novosItens = Array.from(modal.querySelectorAll(".edit-item"))
      .map((linha) => ({
        produtoNome: linha.querySelector(".edit-produto")?.value.trim() || "",
        quantidade: Number(linha.querySelector(".edit-qtd")?.value || 0)
      }))
      .filter((item) => item.produtoNome && item.quantidade > 0);
    const novaData = document.getElementById("edit-data").value;
    const novoPrazo = document.getElementById("edit-prazo").value;
    const novaObs = document.getElementById("edit-obs").value.trim();

  if (!novosItens.length || !novaData || !novoPrazo) {
      alert("Preencha produto, quantidade, data e prazo");
      return;
    }

    try {
      const quantidadeTotal = novosItens.reduce((total, item) => total + item.quantidade, 0);
      const statusAprovado = String(p.status || "").toLowerCase() === "aprovado";
      const pedidoRef = db.collection("pedidos").doc(id);
      const atualizacaoPedido = {
        dataAnterior: dataAtual,
        data: novaData,
        produtoNome: novosItens[0].produtoNome,
        produtosResumo: novosItens
          .map((item) => `${item.produtoNome} (${typeof formatQuantidade === "function" ? formatQuantidade(item.quantidade) : item.quantidade})`)
          .join(", "),
        itens: novosItens,
        quantidade: quantidadeTotal,
        qtdAnterior: p.quantidade,
        prazoPagamento: novoPrazo,
        observacao: novaObs,
        notificadoData: dataAtual !== novaData,
        notificadoQtd: Number(p.quantidade || 0) !== quantidadeTotal,
        editadoPor: user.uid,
        editadoEm: firebase.firestore.FieldValue.serverTimestamp()
      };

      if (statusAprovado) {
        const agendamentosPorId = new Map();
        const idsSalvos = Array.isArray(p.agendamentoIds) && p.agendamentoIds.length
          ? p.agendamentoIds
          : (p.agendamentoId ? [p.agendamentoId] : []);

        const snapsIdsSalvos = await Promise.all(
          idsSalvos.map((agendamentoId) =>
            db.collection("agendamentos").doc(agendamentoId).get()
          )
        );

        snapsIdsSalvos.forEach((agendamentoSnap) => {
          if (agendamentoSnap.exists) {
            agendamentosPorId.set(agendamentoSnap.id, agendamentoSnap);
          }
        });

        const codigoVinculo = p.codigo || id;
        const vinculadosPorCodigo = await db.collection("agendamentos")
          .where("pedidoId", "==", codigoVinculo)
          .get();

        vinculadosPorCodigo.docs.forEach((agendamentoDoc) => {
          if (!agendamentosPorId.has(agendamentoDoc.id)) {
            agendamentosPorId.set(agendamentoDoc.id, agendamentoDoc);
          }
        });

        const agendamentosAtuais = Array.from(agendamentosPorId.values());
        const agendamentoIdsFinais = [];
        const batch = db.batch();

        novosItens.forEach((item, index) => {
          const agendamentoExistente = agendamentosAtuais[index];
          const agendamentoRef = agendamentoExistente
            ? agendamentoExistente.ref
            : db.collection("agendamentos").doc();
          const dadosAgendamento = {
            userId: p.userId,
            clienteNome: p.clienteNome,
            produtoNome: item.produtoNome,
            quantidade: item.quantidade,
            representanteNome: p.representanteNome,
            pedidoId: codigoVinculo,
            data: novaData,
            observacao: novaObs,
            editadoPor: user.uid,
            editadoEm: firebase.firestore.FieldValue.serverTimestamp()
          };

          if (!agendamentoExistente) {
            dadosAgendamento.criadoPor = p.userId;
            dadosAgendamento.createdAt = firebase.firestore.FieldValue.serverTimestamp();
          }

          batch.set(agendamentoRef, dadosAgendamento, { merge: true });
          agendamentoIdsFinais.push(agendamentoRef.id);
        });

        agendamentosAtuais
          .slice(novosItens.length)
          .forEach((agendamentoDoc) => batch.delete(agendamentoDoc.ref));

        atualizacaoPedido.agendamentoId = agendamentoIdsFinais[0] || "";
        atualizacaoPedido.agendamentoIds = agendamentoIdsFinais;
        batch.update(pedidoRef, atualizacaoPedido);
        await batch.commit();
      } else {
        await pedidoRef.update(atualizacaoPedido);
      }

      
      modal.remove();
      alert("Pedido atualizado!");

      // 🔔 Notificar representante sobre edição
      await db.collection("notificacoes").add({
        userId: p.userId,
        pedidoId: p.codigo,
        texto: `📝 Pedido ${p.codigo} atualizado pelo administrador. Produtos: ${atualizacaoPedido.produtosResumo}. Data: ${dataAtual || "-"} → ${novaData}.`,
        lida: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      if (p.status === "aprovado") {
        await abrirWhatsappPedidoAtualizado(
          p,
          { id, ...p, ...atualizacaoPedido },
          dataAtual,
          novaData
        );
      }

      location.reload();

    } catch (e) {
      console.error(e);
      alert("Erro ao editar pedido");
    }
  };
}

async function excluirPedidoCompleto(id) {
  const confirmar = confirm("Deseja excluir este pedido e o agendamento vinculado?");
  if (!confirmar) return;

  try {
    await waitForAuth();

    if (PERFIL !== "admin") {
      alert("Sem permissão para excluir");
      return;
    }

    const pedidoRef = db.collection("pedidos").doc(id);
    const pedidoSnap = await pedidoRef.get();

    if (!pedidoSnap.exists) {
      alert("Pedido não encontrado");
      return;
    }

    const pedido = pedidoSnap.data();

   const agendamentoIds = Array.isArray(pedido.agendamentoIds) && pedido.agendamentoIds.length
      ? pedido.agendamentoIds
      : (pedido.agendamentoId ? [pedido.agendamentoId] : []);

    await Promise.all(agendamentoIds.map((agId) => db.collection("agendamentos").doc(agId).delete()));

    await pedidoRef.delete();

    if (pedido.userId) {
      await db.collection("notificacoes").add({
        userId: pedido.userId,
        pedidoId: pedido.codigo,
        texto: `🗑️ Pedido ${pedido.codigo} foi excluído pelo administrador.`,
        lida: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    alert("Pedido excluído com sucesso!");
  } catch (e) {
    console.error(e);
    alert("Erro ao excluir pedido");
  }
}
// Garante disponibilidade global para chamadas vindas de outros scripts.
window.imprimirPedidoPdf = imprimirPedidoPdf;
window.abrirModalDetalhesPedido = abrirModalDetalhesPedido;
window.abrirWhatsappPedidoAtualizado = abrirWhatsappPedidoAtualizado;
