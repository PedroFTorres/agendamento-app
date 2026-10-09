(() => {
  const escaparFicha = valor => String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  const formatarTelefoneFicha = valor => {
    const numeros = String(valor || "").replace(/\D/g, "");
    if (numeros.length === 11) return numeros.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    if (numeros.length === 10) return numeros.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    return valor || "-";
  };

  const dataHojeLocal = () => {
    const agora = new Date();
    return new Date(agora.getTime() - agora.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  };

  const dataBrFicha = valor => {
    const partes = String(valor || "").split("-");
    return partes.length === 3 ? partes.reverse().join("/") : valor || "-";
  };

  function imprimirFichaAtendimento(cliente, data, titulo) {
    const janela = window.open("", "", "width=900,height=750");
    if (!janela) {
      alert("Permita a abertura de janelas para imprimir a ficha.");
      return;
    }

    const telefone = formatarTelefoneFicha(cliente.whatsapp || cliente.telefone || "");
    const representante = cliente.vinculadoPor || REPRESENTANTE_ATUAL || "-";
    const logoUrl = new URL("img/logo.png", window.location.href).href;
    const linhas = Array.from({ length: 18 }, () => '<div class="linha"></div>').join("");

    janela.document.write(`
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8">
          <title>${escaparFicha(titulo)} - ${escaparFicha(cliente.nome)}</title>
          <style>
            @page { size: A4 portrait; margin: 14mm; }
            * { box-sizing: border-box; }
            body { margin: 0; color: #1f2937; font-family: Arial, Helvetica, sans-serif; font-size: 12px; }
            .cabecalho { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #f28c28; padding-bottom: 10px; }
            .cabecalho img { width: 58px; height: 58px; object-fit: contain; }
            h1 { margin: 0 0 5px; color: #1f3b64; font-size: 21px; }
            .data { color: #4b5563; font-size: 13px; }
            .dados { display: grid; grid-template-columns: 2fr 1fr; gap: 10px; margin-top: 16px; }
            .campo { border: 1px solid #cbd5e1; border-radius: 7px; padding: 10px; min-height: 55px; }
            .campo span { display: block; color: #64748b; font-size: 10px; font-weight: bold; text-transform: uppercase; margin-bottom: 5px; }
            .campo strong { color: #111827; font-size: 14px; }
            .secao { margin-top: 18px; }
            .secao h2 { margin: 0 0 8px; color: #1f3b64; font-size: 14px; }
            .pautas { border: 1px solid #cbd5e1; border-radius: 7px; padding: 5px 12px 10px; min-height: 430px; }
            .linha { height: 23px; border-bottom: 1px solid #94a3b8; }
            .rodape-campos { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 18px; }
            .preencher { border-bottom: 1px solid #64748b; height: 42px; padding-top: 4px; color: #64748b; }
            .emitido { margin-top: 16px; color: #94a3b8; font-size: 9px; text-align: right; }
            @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <header class="cabecalho">
            <img src="${logoUrl}" alt="Logo">
            <div>
              <h1>${escaparFicha(titulo)}</h1>
              <div class="data">Data: ${dataBrFicha(data)}</div>
            </div>
          </header>

          <section class="dados">
            <div class="campo"><span>Cliente</span><strong>${escaparFicha(cliente.nome || "-")}</strong></div>
            <div class="campo"><span>Telefone / WhatsApp</span><strong>${escaparFicha(telefone)}</strong></div>
            <div class="campo"><span>Vendedor / Representante</span><strong>${escaparFicha(representante)}</strong></div>
            <div class="campo"><span>Forma do contato</span><strong>□ Visita &nbsp; □ Ligação &nbsp; □ WhatsApp</strong></div>
          </section>

          <section class="secao">
            <h2>Observações da conversa</h2>
            <div class="pautas">${linhas}</div>
          </section>

          <section class="rodape-campos">
            <div class="preencher">Próximo contato: ____/____/________</div>
            <div class="preencher">Assinatura do vendedor:</div>
          </section>

          <div class="emitido">Ficha emitida em ${new Date().toLocaleString("pt-BR")}</div>
        </body>
      </html>
    `);
    janela.document.close();
    janela.onload = () => setTimeout(() => janela.print(), 250);
    janela.focus();
  }

  async function renderFichaAtendimento() {
    pageContent.innerHTML = '<div class="bg-white rounded-xl shadow p-6 text-center text-gray-500">Carregando clientes...</div>';

    try {
      const snap = await getClientesFiltrados();
      const clientes = [];
      snap.forEach(doc => {
        const dados = doc.data() || {};
        if (!String(dados.nome || "").trim()) return;
        clientes.push({ id: doc.id, ...dados });
      });
      clientes.sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));

      pageContent.innerHTML = `
        <section class="max-w-3xl mx-auto">
          <div class="mb-5">
            <h2 class="text-2xl font-bold text-blue-900">Ficha de Atendimento</h2>
            <p class="text-sm text-gray-500">Selecione o cliente e imprima uma ficha pautada para registrar a conversa à mão.</p>
          </div>

          <div class="bg-white rounded-xl shadow p-5 space-y-4">
            <label class="block">
              <span class="block font-semibold mb-1">Pesquisar cliente</span>
              <input id="ficha-busca" class="border rounded p-3 w-full" placeholder="Digite parte do nome do cliente">
            </label>

            <label class="block">
              <span class="block font-semibold mb-1">Cliente *</span>
              <select id="ficha-cliente" class="border rounded p-3 w-full">
                <option value="">Selecione um cliente</option>
                ${clientes.map(cliente => `<option value="${escaparFicha(cliente.id)}">${escaparFicha(cliente.nome)}</option>`).join("")}
              </select>
            </label>

            <div id="ficha-dados-cliente" class="hidden bg-blue-50 border border-blue-200 rounded p-4 grid grid-cols-1 sm:grid-cols-2 gap-3"></div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label class="block">
                <span class="block font-semibold mb-1">Data *</span>
                <input id="ficha-data" type="date" value="${dataHojeLocal()}" class="border rounded p-3 w-full">
              </label>
              <label class="block">
                <span class="block font-semibold mb-1">Título *</span>
                <input id="ficha-titulo" value="Ficha de Atendimento ao Cliente" class="border rounded p-3 w-full">
              </label>
            </div>

            <button id="ficha-imprimir" class="bg-blue-700 hover:bg-blue-800 text-white font-semibold px-5 py-3 rounded w-full">
              Imprimir / Gerar PDF
            </button>
          </div>
        </section>
      `;

      const busca = document.getElementById("ficha-busca");
      const select = document.getElementById("ficha-cliente");
      const dadosCliente = document.getElementById("ficha-dados-cliente");

      const preencherOpcoes = termo => {
        const atual = select.value;
        const chave = normalizarTexto(termo);
        const filtrados = clientes.filter(cliente => !chave || normalizarTexto(cliente.nome).includes(chave));
        select.innerHTML = '<option value="">Selecione um cliente</option>' + filtrados
          .map(cliente => `<option value="${escaparFicha(cliente.id)}">${escaparFicha(cliente.nome)}</option>`)
          .join("");
        if (filtrados.some(cliente => cliente.id === atual)) select.value = atual;
      };

      busca.oninput = () => preencherOpcoes(busca.value);
      select.onchange = () => {
        const cliente = clientes.find(item => item.id === select.value);
        if (!cliente) {
          dadosCliente.classList.add("hidden");
          dadosCliente.innerHTML = "";
          return;
        }
        dadosCliente.classList.remove("hidden");
        dadosCliente.innerHTML = `
          <div><span class="text-xs text-gray-500 block">Cliente</span><strong>${escaparFicha(cliente.nome)}</strong></div>
          <div><span class="text-xs text-gray-500 block">Telefone / WhatsApp</span><strong>${escaparFicha(formatarTelefoneFicha(cliente.whatsapp || cliente.telefone || ""))}</strong></div>
        `;
      };

      document.getElementById("ficha-imprimir").onclick = () => {
        const cliente = clientes.find(item => item.id === select.value);
        const data = document.getElementById("ficha-data").value;
        const titulo = document.getElementById("ficha-titulo").value.trim();
        if (!cliente || !data || !titulo) {
          alert("Selecione o cliente e preencha a data e o título.");
          return;
        }
        imprimirFichaAtendimento(cliente, data, titulo);
      };
    } catch (erro) {
      console.error("Erro ao preparar ficha de atendimento.", erro);
      pageContent.innerHTML = '<div class="bg-red-50 text-red-700 p-4 rounded">Não foi possível carregar os clientes.</div>';
    }
  }

  window.renderFichaAtendimento = renderFichaAtendimento;
})();
