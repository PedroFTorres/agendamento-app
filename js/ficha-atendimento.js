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

  function imprimirFichasAtendimento(clientes, data, titulo) {
    const janela = window.open("", "", "width=950,height=800");
    if (!janela) {
      alert("Permita a abertura de janelas para imprimir as fichas.");
      return;
    }

    const logoUrl = new URL("img/logo.png", window.location.href).href;
    const linhas = Array.from({ length: 9 }, () => '<div class="linha"></div>').join("");

    const montarFicha = cliente => {
      const telefone = formatarTelefoneFicha(cliente.whatsapp || cliente.telefone || "");
      const representante = cliente.vinculadoPor || REPRESENTANTE_ATUAL || "-";
      return `
        <article class="ficha">
          <header class="cabecalho">
            <img src="${logoUrl}" alt="Logo">
            <div class="titulo">
              <h1>${escaparFicha(titulo)}</h1>
              <div>Data: ${dataBrFicha(data)}</div>
            </div>
          </header>
          <section class="dados">
            <div class="campo cliente"><span>Cliente</span><strong>${escaparFicha(cliente.nome || "-")}</strong></div>
            <div class="campo"><span>Telefone / WhatsApp</span><strong>${escaparFicha(telefone)}</strong></div>
            <div class="campo"><span>Vendedor / Representante</span><strong>${escaparFicha(representante)}</strong></div>
            <div class="campo"><span>Contato</span><strong>□ Visita &nbsp; □ Ligação &nbsp; □ WhatsApp</strong></div>
          </section>
          <section class="observacoes">
            <h2>Observações da conversa</h2>
            <div class="pautas">${linhas}</div>
          </section>
          <footer>
            <div>Próximo contato: ____/____/________</div>
            <div>Assinatura: ________________________________</div>
          </footer>
        </article>
      `;
    };

    const folhas = [];
    for (let indice = 0; indice < clientes.length; indice += 2) {
      folhas.push(`<section class="folha">${clientes.slice(indice, indice + 2).map(montarFicha).join("")}</section>`);
    }

    janela.document.write(`
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8">
          <title>${escaparFicha(titulo)} - ${clientes.length} cliente(s)</title>
          <style>
            @page { size: A4 portrait; margin: 8mm; }
            * { box-sizing: border-box; }
            body { margin: 0; color: #1f2937; font-family: Arial, Helvetica, sans-serif; font-size: 9px; background: #fff; }
            .folha { height: 280mm; display: grid; grid-template-rows: 1fr 1fr; gap: 4mm; break-after: page; page-break-after: always; }
            .folha:last-child { break-after: auto; page-break-after: auto; }
            .ficha { height: 138mm; border: 1px solid #94a3b8; border-radius: 7px; padding: 5mm; overflow: hidden; break-inside: avoid; page-break-inside: avoid; }
            .cabecalho { display: flex; align-items: center; gap: 8px; border-bottom: 2px solid #f28c28; padding-bottom: 5px; }
            .cabecalho img { width: 34px; height: 34px; object-fit: contain; }
            .titulo h1 { margin: 0 0 2px; color: #1f3b64; font-size: 14px; }
            .titulo div { color: #4b5563; font-size: 9px; }
            .dados { display: grid; grid-template-columns: 1.35fr 1fr; gap: 5px; margin-top: 6px; }
            .campo { border: 1px solid #cbd5e1; border-radius: 4px; padding: 5px 6px; min-height: 32px; }
            .campo span { display: block; color: #64748b; font-size: 7px; font-weight: bold; text-transform: uppercase; margin-bottom: 2px; }
            .campo strong { color: #111827; font-size: 9px; }
            .observacoes { margin-top: 7px; }
            .observacoes h2 { margin: 0 0 3px; color: #1f3b64; font-size: 10px; }
            .pautas { border: 1px solid #cbd5e1; border-radius: 4px; padding: 0 7px 4px; }
            .linha { height: 13px; border-bottom: 1px solid #94a3b8; }
            footer { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 7px; color: #475569; font-size: 8px; }
            footer div { border-bottom: 1px solid #64748b; height: 18px; padding-top: 3px; }
            @media print {
              body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
              .folha, .ficha { break-inside: avoid; page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>${folhas.join("")}</body>
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
        <section class="max-w-4xl mx-auto">
          <div class="mb-5">
            <h2 class="text-2xl font-bold text-blue-900">Ficha de Atendimento</h2>
            <p class="text-sm text-gray-500">Selecione um ou mais clientes. A impressão será organizada com duas fichas por folha.</p>
          </div>

          <div class="bg-white rounded-xl shadow p-5 space-y-4">
            <label class="block">
              <span class="block font-semibold mb-1">Pesquisar clientes</span>
              <input id="ficha-busca" class="border rounded p-3 w-full" placeholder="Digite parte do nome do cliente">
            </label>

            <div class="flex flex-wrap items-center justify-between gap-2">
              <strong id="ficha-contador" class="text-blue-900">0 clientes selecionados</strong>
              <div class="flex gap-2">
                <button id="ficha-marcar-visiveis" type="button" class="border border-blue-600 text-blue-700 px-3 py-2 rounded">Selecionar visíveis</button>
                <button id="ficha-limpar" type="button" class="border border-gray-400 text-gray-700 px-3 py-2 rounded">Limpar seleção</button>
              </div>
            </div>

            <div id="ficha-lista-clientes" class="border rounded max-h-80 overflow-y-auto divide-y"></div>

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

            <div class="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-900">
              Será impressa uma ficha para cada cliente selecionado, com duas fichas em cada folha A4.
            </div>

            <button id="ficha-imprimir" class="bg-blue-700 hover:bg-blue-800 text-white font-semibold px-5 py-3 rounded w-full">
              Imprimir / Gerar PDF
            </button>
          </div>
        </section>
      `;

      const busca = document.getElementById("ficha-busca");
      const lista = document.getElementById("ficha-lista-clientes");
      const contador = document.getElementById("ficha-contador");
      const selecionados = new Set();
      let clientesVisiveis = [...clientes];

      const atualizarContador = () => {
        const total = selecionados.size;
        contador.textContent = `${total} cliente${total === 1 ? "" : "s"} selecionado${total === 1 ? "" : "s"}`;
      };

      const renderizarLista = () => {
        const chave = normalizarTexto(busca.value);
        clientesVisiveis = clientes.filter(cliente => !chave || normalizarTexto(cliente.nome).includes(chave));
        lista.innerHTML = clientesVisiveis.length ? clientesVisiveis.map(cliente => `
          <label class="flex items-center gap-3 p-3 hover:bg-blue-50 cursor-pointer">
            <input type="checkbox" class="ficha-cliente-item w-5 h-5" value="${escaparFicha(cliente.id)}" ${selecionados.has(cliente.id) ? "checked" : ""}>
            <span class="flex-1">
              <strong class="block">${escaparFicha(cliente.nome)}</strong>
              <small class="text-gray-500">${escaparFicha(formatarTelefoneFicha(cliente.whatsapp || cliente.telefone || ""))}</small>
            </span>
          </label>
        `).join("") : '<div class="p-5 text-center text-gray-500">Nenhum cliente encontrado.</div>';

        lista.querySelectorAll(".ficha-cliente-item").forEach(caixa => {
          caixa.onchange = () => {
            if (caixa.checked) selecionados.add(caixa.value);
            else selecionados.delete(caixa.value);
            atualizarContador();
          };
        });
      };

      busca.oninput = renderizarLista;
      document.getElementById("ficha-marcar-visiveis").onclick = () => {
        clientesVisiveis.forEach(cliente => selecionados.add(cliente.id));
        renderizarLista();
        atualizarContador();
      };
      document.getElementById("ficha-limpar").onclick = () => {
        selecionados.clear();
        renderizarLista();
        atualizarContador();
      };

      document.getElementById("ficha-imprimir").onclick = () => {
        const escolhidos = clientes.filter(cliente => selecionados.has(cliente.id));
        const data = document.getElementById("ficha-data").value;
        const titulo = document.getElementById("ficha-titulo").value.trim();
        if (!escolhidos.length || !data || !titulo) {
          alert("Selecione ao menos um cliente e preencha a data e o título.");
          return;
        }
        imprimirFichasAtendimento(escolhidos, data, titulo);
      };

      renderizarLista();
      atualizarContador();
    } catch (erro) {
      console.error("Erro ao preparar ficha de atendimento.", erro);
      pageContent.innerHTML = '<div class="bg-red-50 text-red-700 p-4 rounded">Não foi possível carregar os clientes.</div>';
    }
  }

  window.renderFichaAtendimento = renderFichaAtendimento;
})();
