function formatarMoedaPrecoCliente(valor) {
  if (typeof formatMoeda === "function") return formatMoeda(valor);
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 3
  });
}

function inserirMenuPrecosClientes() {
  if (document.querySelector('[data-page="precos-clientes"]')) return;

  const menu = document.querySelector("#sidebar ul.space-y-2");
  if (!menu) return;

  const item = document.createElement("li");
  item.setAttribute("data-perfil", "admin");
  item.innerHTML = `
    <button data-page="precos-clientes" class="menu-item flex items-center space-x-2 hover:bg-gray-100 p-2 rounded">
      <span>💲</span><span>Preços por Cliente</span>
    </button>
  `;

  const produtos = menu.querySelector('[data-page="produtos"]')?.closest("li");
  if (produtos?.nextSibling) {
    menu.insertBefore(item, produtos.nextSibling);
  } else {
    menu.appendChild(item);
  }

  item.querySelector("button").addEventListener("click", () => {
    if (PERFIL !== "admin") {
      alert("Apenas administradores podem acessar preços por cliente.");
      return;
    }

    renderPrecosClientes();
    const sidebar = document.getElementById("sidebar");
    if (window.innerWidth < 768) sidebar.classList.add("-translate-x-full");
  });
}

async function renderPrecosClientes() {
  if (PERFIL !== "admin") {
    pageContent.innerHTML = `<p class="text-red-600 font-semibold">Apenas administradores podem gerenciar preços por cliente.</p>`;
    return;
  }

  pageContent.innerHTML = `
    <h2 class="text-xl font-bold mb-4">Preços por Cliente</h2>

    <form id="precos-clientes-form" class="bg-white p-4 rounded shadow mb-4 space-y-3">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
        <select id="pc-cliente" class="border p-2 rounded w-full" required>
          <option value="">Selecione cliente</option>
        </select>
        <select id="pc-produto" class="border p-2 rounded w-full" required>
          <option value="">Selecione produto</option>
        </select>
        <input id="pc-preco" type="text" inputmode="decimal" class="border p-2 rounded w-full" placeholder="Preço especial. Ex.: 8,50" required>
      </div>
      <button class="bg-blue-600 text-white px-4 py-2 rounded w-full md:w-auto">Salvar preço especial</button>
    </form>

    <div class="bg-white p-4 rounded shadow">
      <h3 class="font-bold mb-3">Preços cadastrados</h3>
      <div id="precos-clientes-lista" class="space-y-3">Carregando...</div>
    </div>
  `;

  const form = document.getElementById("precos-clientes-form");
  const clienteSelect = document.getElementById("pc-cliente");
  const produtoSelect = document.getElementById("pc-produto");
  const precoInput = document.getElementById("pc-preco");
  const lista = document.getElementById("precos-clientes-lista");

  const [clientesSnap, produtosSnap] = await Promise.all([
    db.collection("clientes").get(),
    db.collection("produtos").get()
  ]);

  const clientes = [];
  clientesSnap.forEach(doc => {
    const nome = String(doc.data()?.nome || "").trim();
    if (nome) clientes.push(nome);
  });

  [...new Set(clientes)]
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .forEach(nome => {
      const opt = document.createElement("option");
      opt.value = nome;
      opt.textContent = nome;
      clienteSelect.appendChild(opt);
    });

  const produtos = [];
  produtosSnap.forEach(doc => {
    const nome = String(doc.data()?.nome || "").trim();
    if (nome) produtos.push(nome);
  });

  [...new Set(produtos)]
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .forEach(nome => {
      const opt = document.createElement("option");
      opt.value = nome;
      opt.textContent = nome;
      produtoSelect.appendChild(opt);
    });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const user = await waitForAuth();
    const clienteNome = clienteSelect.value;
    const produtoNome = produtoSelect.value;
    const preco = Number(precoInput.value.trim().replace(",", "."));

    if (!clienteNome || !produtoNome || !Number.isFinite(preco) || preco < 0) {
      alert("Informe cliente, produto e um preço válido.");
      return;
    }

    const existente = await db.collection("precos_clientes")
      .where("clienteNome", "==", clienteNome)
      .where("produtoNome", "==", produtoNome)
      .limit(1)
      .get();

    const payload = {
      userId: user.uid,
      clienteNome,
      produtoNome,
      preco,
      editadoEm: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (existente.empty) {
      await db.collection("precos_clientes").add({
        ...payload,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } else {
      await existente.docs[0].ref.update(payload);
    }

    form.reset();
    alert("Preço especial salvo!");
  });

  db.collection("precos_clientes").onSnapshot(snap => {
    if (snap.empty) {
      lista.innerHTML = `<p class="text-gray-500">Nenhum preço especial cadastrado.</p>`;
      return;
    }

    const agrupado = {};
    snap.forEach(doc => {
      const item = { id: doc.id, ...(doc.data() || {}) };
      const cliente = item.clienteNome || "Cliente não informado";
      if (!agrupado[cliente]) agrupado[cliente] = [];
      agrupado[cliente].push(item);
    });

    lista.innerHTML = Object.entries(agrupado)
      .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
      .map(([cliente, itens]) => `
        <div class="border rounded p-3">
          <div class="font-bold mb-2">${escapeHtmlRelatorio(cliente)}</div>
          ${itens
            .sort((a, b) => String(a.produtoNome || "").localeCompare(String(b.produtoNome || ""), "pt-BR"))
            .map(item => `
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t py-2">
                <div>
                  <div class="font-medium">${escapeHtmlRelatorio(item.produtoNome || "-")}</div>
                  <div class="text-sm text-gray-500">Preço especial: ${formatarMoedaPrecoCliente(item.preco)}</div>
                </div>
                <div class="flex gap-2">
                  <button data-id="${item.id}" data-acao="editar" class="bg-yellow-500 text-white px-3 py-1 rounded">Editar</button>
                  <button data-id="${item.id}" data-acao="excluir" class="bg-red-600 text-white px-3 py-1 rounded">Excluir</button>
                </div>
              </div>
            `).join("")}
        </div>
      `).join("");
  });

  lista.addEventListener("click", async (e) => {
    const botao = e.target.closest("button[data-id]");
    if (!botao) return;

    const id = botao.dataset.id;
    if (botao.dataset.acao === "excluir") {
      if (confirm("Excluir este preço especial?")) {
        await db.collection("precos_clientes").doc(id).delete();
      }
      return;
    }

    const novoPreco = prompt("Novo preço especial:");
    if (!novoPreco) return;

    const preco = Number(novoPreco.replace(",", "."));
    if (!Number.isFinite(preco) || preco < 0) {
      alert("Preço inválido.");
      return;
    }

    await db.collection("precos_clientes").doc(id).update({
      preco,
      editadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });
  });
}

inserirMenuPrecosClientes();
