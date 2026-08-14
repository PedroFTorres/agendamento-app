// ================== PRODUÇÃO ==================
function renderProducao() {
  pageContent.innerHTML = `
    <div class="mb-4">
      <h2 class="text-xl font-bold text-blue-900">Produção</h2>
      <p class="text-sm text-gray-500">Registre a produção e acompanhe rapidamente o saldo disponível.</p>
    </div>

    <!-- FORM -->
    <form id="prod-form" class="bg-white p-4 rounded shadow space-y-3 mb-6">
      <input type="date" id="prod-data" class="border p-2 rounded w-full" required>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
        <select id="prod-produto" class="border p-2 rounded w-full"></select>
        <input id="prod-qtd" type="number" class="border p-2 rounded w-full" placeholder="Quantidade">
        <button type="button" id="btn-add" class="bg-gray-600 text-white rounded px-3">
          + Adicionar
        </button>
      </div>

      <div id="lista-temp" class="space-y-2"></div>

      <button class="bg-blue-600 text-white p-2 rounded w-full">
        Salvar Produção do Dia
      </button>
    </form>

    <section class="bg-white rounded-xl shadow p-4 mb-4">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 class="font-bold text-blue-900">Resumo da produção</h3>
          <p class="text-xs text-gray-500">Produzido menos o que está agendado no período.</p>
        </div>
        <input id="prod-mes-filtro" type="month" class="border p-2 rounded">
      </div>
      <div id="prod-resumo" class="mt-4"></div>
    </section>

    <section>
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-bold text-blue-900">Lançamentos por dia</h3>
        <span class="text-xs text-gray-500">Clique em um dia para abrir</span>
      </div>
      <div id="prod-list" class="space-y-2"></div>
    </section>
  `;

  const $form = document.getElementById("prod-form");
  const $data = document.getElementById("prod-data");
  const $produto = document.getElementById("prod-produto");
  const $qtd = document.getElementById("prod-qtd");
  const $btnAdd = document.getElementById("btn-add");
  const $temp = document.getElementById("lista-temp");
  const $list = document.getElementById("prod-list");
  const $resumo = document.getElementById("prod-resumo");
  const $mesFiltro = document.getElementById("prod-mes-filtro");
  $mesFiltro.value = new Date().toISOString().slice(0, 7);

  let buffer = [];

  // ================== HELPERS ==================
  const dias = ["domingo","segunda","terça","quarta","quinta","sexta","sábado"];
  const diaSemana = d => dias[new Date(d + "T00:00:00").getDay()];
  const dataBR = d => d.split("-").reverse().join("/");

  // ================== PRODUTOS ==================
  waitForAuth().then(user => {
    db.collection("produtos")
      .where("userId","==",user.uid)
      .get()
      .then(snap => {
        $produto.innerHTML = `<option value="">Produto</option>`;
        snap.forEach(doc => {
          const o = document.createElement("option");
          o.value = doc.data().nome;
          o.textContent = doc.data().nome;
          $produto.appendChild(o);
        });
      });
  });

  // ================== ADD TEMP ==================
  $btnAdd.onclick = () => {
    if (!$produto.value || !$qtd.value) {
      alert("Produto e quantidade obrigatórios.");
      return;
    }

    buffer.push({
      produto: $produto.value,
      quantidade: parseInt($qtd.value)
    });

    renderTemp();
    $qtd.value = "";
  };

  function renderTemp() {
    $temp.innerHTML = "";
    buffer.forEach((i, idx) => {
      const div = document.createElement("div");
      div.className = "flex justify-between bg-gray-100 p-2 rounded";
      div.innerHTML = `
        <span>${i.produto} — ${formatQuantidade(i.quantidade)}</span>
        <button class="text-red-600">✕</button>
      `;
      div.querySelector("button").onclick = () => {
        buffer.splice(idx, 1);
        renderTemp();
      };
      $temp.appendChild(div);
    });
  }

  // ================== SALVAR ==================
  $form.onsubmit = async e => {
    e.preventDefault();
    const user = await waitForAuth();

    if (!$data.value || buffer.length === 0) {
      alert("Informe data e itens.");
      return;
    }

    const batch = db.batch();

    buffer.forEach(i => {
      batch.set(db.collection("producao").doc(), {
        userId: user.uid,
        data: $data.value,
        produto: i.produto,
        quantidade: i.quantidade,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    });

    await batch.commit();
    buffer = [];
    renderTemp();
    $form.reset();
  };

  // ================== RESUMO E LISTAGEM ==================
  waitForAuth().then(user => {
    let producoes = [];
    let agendamentos = [];
    let carregouProducoes = false;
    let carregouAgendamentos = false;

    const producaoQuery = PERFIL === "representante"
      ? db.collection("producao").where("userId", "==", user.uid)
      : db.collection("producao");
    const agendamentoQuery = PERFIL === "representante"
      ? db.collection("agendamentos").where("userId", "==", user.uid)
      : db.collection("agendamentos");

    function chaveProduto(data, produto) {
      return `${data || ""}::${String(produto || "").trim().toLowerCase()}`;
    }

    function renderizarPainel() {
      if (!carregouProducoes || !carregouAgendamentos) return;
      const mes = $mesFiltro.value;
      const producoesMes = producoes.filter(item => String(item.data || "").startsWith(mes));
      const agendamentosMes = agendamentos.filter(item => String(item.data || "").startsWith(mes));

      const porProduto = new Map();
      producoesMes.forEach(item => {
        const nome = String(item.produto || "Sem produto").trim();
        const chave = nome.toLowerCase();
        if (!porProduto.has(chave)) porProduto.set(chave, { nome, produzido: 0, agendado: 0 });
        porProduto.get(chave).produzido += Number(item.quantidade || 0);
      });
      agendamentosMes.forEach(item => {
        const nome = String(item.produtoNome || "Sem produto").trim();
        const chave = nome.toLowerCase();
        if (!porProduto.has(chave)) porProduto.set(chave, { nome, produzido: 0, agendado: 0 });
        porProduto.get(chave).agendado += Number(item.quantidade || 0);
      });

      const produtos = [...porProduto.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      const totalProduzido = produtos.reduce((soma, item) => soma + item.produzido, 0);
      const totalAgendado = produtos.reduce((soma, item) => soma + item.agendado, 0);
      const saldoTotal = totalProduzido - totalAgendado;

      $resumo.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div class="rounded-lg bg-blue-50 border border-blue-100 p-4"><div class="text-xs text-blue-700">Produzido</div><div class="text-2xl font-bold text-blue-900">${formatQuantidade(totalProduzido)}</div></div>
          <div class="rounded-lg bg-orange-50 border border-orange-100 p-4"><div class="text-xs text-orange-700">Agendado</div><div class="text-2xl font-bold text-orange-900">${formatQuantidade(totalAgendado)}</div></div>
          <div class="rounded-lg ${saldoTotal < 0 ? "bg-red-50 border-red-100" : "bg-green-50 border-green-100"} border p-4"><div class="text-xs ${saldoTotal < 0 ? "text-red-700" : "text-green-700"}">Saldo</div><div class="text-2xl font-bold ${saldoTotal < 0 ? "text-red-800" : "text-green-800"}">${formatQuantidade(saldoTotal)}</div></div>
        </div>
        ${produtos.length ? `
          <div class="overflow-x-auto rounded-lg border">
            <table class="w-full text-sm">
              <thead class="bg-gray-50 text-gray-600"><tr><th class="text-left p-3">Produto</th><th class="text-right p-3">Produzido</th><th class="text-right p-3">Agendado</th><th class="text-right p-3">Saldo</th></tr></thead>
              <tbody>${produtos.map(item => {
                const saldo = item.produzido - item.agendado;
                return `<tr class="border-t"><td class="p-3 font-semibold">${item.nome}</td><td class="p-3 text-right">${formatQuantidade(item.produzido)}</td><td class="p-3 text-right">${formatQuantidade(item.agendado)}</td><td class="p-3 text-right font-bold ${saldo < 0 ? "text-red-600" : "text-green-600"}">${formatQuantidade(saldo)}</td></tr>`;
              }).join("")}</tbody>
            </table>
          </div>` : '<div class="text-sm text-gray-500 py-4 text-center">Nenhum lançamento neste mês.</div>'}
      `;

      const agendadoPorDiaProduto = new Map();
      agendamentosMes.forEach(item => {
        const chave = chaveProduto(item.data, item.produtoNome);
        agendadoPorDiaProduto.set(chave, (agendadoPorDiaProduto.get(chave) || 0) + Number(item.quantidade || 0));
      });

      const porDia = new Map();
      producoesMes.forEach(item => {
        if (!porDia.has(item.data)) porDia.set(item.data, []);
        porDia.get(item.data).push(item);
      });

      const diasOrdenados = [...porDia.keys()].sort((a, b) => b.localeCompare(a));
      if (!diasOrdenados.length) {
        $list.innerHTML = '<div class="bg-white rounded-lg p-5 text-center text-gray-500">Nenhuma produção lançada neste mês.</div>';
        return;
      }

      $list.innerHTML = diasOrdenados.map((dia, indice) => {
        const itensDia = porDia.get(dia);
        const agrupados = new Map();
        itensDia.forEach(item => {
          const chave = String(item.produto || "").trim().toLowerCase();
          if (!agrupados.has(chave)) agrupados.set(chave, { produto: item.produto, produzido: 0, ids: [] });
          agrupados.get(chave).produzido += Number(item.quantidade || 0);
          agrupados.get(chave).ids.push(item.id);
        });
        const totalDia = [...agrupados.values()].reduce((soma, item) => soma + item.produzido, 0);
        return `
          <details class="bg-white rounded-lg shadow border border-gray-100 overflow-hidden" ${indice === 0 ? "open" : ""}>
            <summary class="cursor-pointer list-none p-3 flex items-center justify-between gap-3 bg-gray-50">
              <div><span class="font-bold text-blue-900">${dataBR(dia)}</span><span class="text-sm text-gray-500 ml-2">${diaSemana(dia)}</span></div>
              <span class="text-sm font-semibold">${formatQuantidade(totalDia)} produzidos</span>
            </summary>
            <div class="divide-y">
              ${[...agrupados.values()].map(item => {
                const agendado = agendadoPorDiaProduto.get(chaveProduto(dia, item.produto)) || 0;
                const saldo = item.produzido - agendado;
                return `
                  <div class="p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div><div class="font-semibold">${item.produto}</div><div class="text-sm text-gray-500">Produzido: ${formatQuantidade(item.produzido)} • Agendado: ${formatQuantidade(agendado)} • <strong class="${saldo < 0 ? "text-red-600" : "text-green-600"}">Saldo: ${formatQuantidade(saldo)}</strong></div></div>
                    <div class="flex gap-2"><button class="btn-edit bg-yellow-500 text-white px-3 py-1 rounded" data-ids="${item.ids.join(",")}" data-qtd="${item.produzido}">Editar</button><button class="btn-del bg-red-600 text-white px-3 py-1 rounded" data-ids="${item.ids.join(",")}">Excluir</button></div>
                  </div>`;
              }).join("")}
            </div>
          </details>`;
      }).join("");
    }

    $mesFiltro.addEventListener("change", renderizarPainel);
    $list.addEventListener("click", async event => {
      const botao = event.target.closest("button");
      if (!botao) return;
      const ids = String(botao.dataset.ids || "").split(",").filter(Boolean);
      if (botao.classList.contains("btn-edit")) {
        const novaQtd = Number(prompt("Nova quantidade produzida:", botao.dataset.qtd));
        if (!Number.isFinite(novaQtd) || novaQtd < 0) return;
        const base = Math.floor(novaQtd / ids.length);
        let restante = novaQtd - (base * ids.length);
        for (const id of ids) {
          await db.collection("producao").doc(id).update({ quantidade: base + (restante-- > 0 ? 1 : 0) });
        }
      }
      if (botao.classList.contains("btn-del") && confirm("Excluir esta produção?")) {
        for (const id of ids) await db.collection("producao").doc(id).delete();
      }
    });

    producaoQuery.orderBy("data", "desc").onSnapshot(snap => {
      producoes = snap.docs
        .map(doc => ({ id: doc.id, ...(doc.data() || {}) }))
        .filter(item => !item.registroTipo || item.registroTipo === "producao");
      carregouProducoes = true;
      renderizarPainel();
    });
    agendamentoQuery.onSnapshot(snap => {
      agendamentos = snap.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) }));
      carregouAgendamentos = true;
      renderizarPainel();
    });
  });

}

