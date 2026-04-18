// ================== BLOCO DE ANOTAÇÕES ==================
function renderNotas() {
 pageContent.innerHTML = `
  <div class="p-6 bg-gray-50 min-h-screen">

    <h2 class="text-2xl font-semibold mb-6 text-gray-800">
      Bloco de Anotações
    </h2>

    <!-- CARD CRIAR -->
    <div class="bg-white p-6 rounded-xl shadow-sm border mb-8">
      <form id="nota-form" class="space-y-4">

        <!-- TÍTULO -->
        <input id="nota-titulo"
          class="border p-2 rounded w-full"
          placeholder="Título da anotação (ex: Anotações do dia)"
          required>

        <!-- DATA -->
        <input id="nota-data"
          type="date"
          class="border p-2 rounded w-full"
          required>

        <!-- CLIENTE -->
        <select id="nota-cliente" class="border p-2 rounded w-full"></select>

        <!-- PRODUTO -->
        <select id="nota-produto" class="border p-2 rounded w-full"></select>

        <!-- OBSERVAÇÃO DO PRODUTO -->
        <textarea id="nota-obs-produto"
          class="border p-2 rounded w-full h-20"
          placeholder="Observação deste produto para este cliente..."></textarea>

        <button type="button"
          id="btn-add-produto"
          class="bg-blue-600 text-white p-2 rounded w-full">
          Vincular produto ao cliente
        </button>

        <!-- PREVIEW -->
        <div id="preview-nota" class="space-y-3"></div>

        <!-- OBSERVAÇÃO GERAL -->
        <textarea id="nota-texto"
          class="border p-2 rounded w-full h-28"
          placeholder="Observação geral da anotação (opcional)"></textarea>

        <button class="bg-yellow-600 text-white p-2 rounded w-full">
          Salvar anotação do dia
        </button>
           </form>
    </div>

    <!-- FILTROS -->
    <div class="bg-white p-4 rounded-xl shadow-sm border mb-6 flex gap-4 items-center">
      <input id="filtro-busca"
        placeholder="Buscar por título ou cliente..."
        class="border p-2 rounded w-full">

      <input type="date"
        id="filtro-data"
        class="border p-2 rounded">
    </div>

    <!-- LISTA -->
    <div id="notas-list" class="space-y-4"></div>

  </div>
`;

  const $form = document.getElementById("nota-form");
  const $cliente = document.getElementById("nota-cliente");
  const $produto = document.getElementById("nota-produto");
  const $obsProduto = document.getElementById("nota-obs-produto");
  const $preview = document.getElementById("preview-nota");
  const $list = document.getElementById("notas-list");

  let clientesNota = [];

  // ================== CARREGAR CLIENTES E PRODUTOS ==================
  waitForAuth().then(user => {

   const snap = await getClientesFiltrados();

$cliente.innerHTML = `<option value="">Selecione o cliente</option>`;

snap.forEach(doc => {
  const d = doc.data();
  $cliente.appendChild(new Option(d.nome, d.nome));
});
      });

    db.collection("produtos")
      .where("userId", "==", user.uid)
      .get()
      .then(snap => {
        $produto.innerHTML = `<option value="">Selecione o produto</option>`;
        snap.forEach(doc => {
          const d = doc.data();
          $produto.appendChild(new Option(d.nome, d.nome));
        });
      });
  });

  // ================== VINCULAR PRODUTO AO CLIENTE ==================
  document.getElementById("btn-add-produto").onclick = () => {
    const cliente = $cliente.value;
    const produto = $produto.value;
    const obs = $obsProduto.value.trim();

    if (!cliente || !produto) {
      alert("Selecione cliente e produto.");
      return;
    }

    let c = clientesNota.find(x => x.cliente === cliente);
    if (!c) {
      c = { cliente, produtos: [] };
      clientesNota.push(c);
    }

    if (c.produtos.find(p => p.nome === produto)) {
      alert("Este produto já foi adicionado para este cliente.");
      return;
    }

    c.produtos.push({ nome: produto, obs });
    $obsProduto.value = "";
    renderPreview();
  };

  // ================== PREVIEW ==================
  function renderPreview() {
    $preview.innerHTML = "";

    clientesNota.forEach((c, ci) => {
      const box = document.createElement("div");

const cores = ["bg-blue-50", "bg-gray-50"];
box.className = `${cores[ci % 2]} p-3 rounded`;

      box.innerHTML = `
        <strong>${c.cliente}</strong>
        <div class="mt-2 space-y-2">
          ${c.produtos.map((p, pi) => `
            <div class="bg-white p-2 rounded border flex justify-between">
              <div>
                <strong>${p.nome}</strong>
                ${p.obs ? `<p class="text-sm text-gray-600">${p.obs}</p>` : ""}
              </div>
              <button class="text-red-600" data-ci="${ci}" data-pi="${pi}">✕</button>
            </div>
          `).join("")}
        </div>
      `;

      box.querySelectorAll("button").forEach(btn => {
        btn.onclick = () => {
          const ci = btn.dataset.ci;
          const pi = btn.dataset.pi;
          clientesNota[ci].produtos.splice(pi, 1);
          if (clientesNota[ci].produtos.length === 0) {
            clientesNota.splice(ci, 1);
          }
          renderPreview();
        };
      });

      $preview.appendChild(box);
    });
  }

  // ================== SALVAR ==================
$form.addEventListener("submit", async e => {
  e.preventDefault();
  const user = await waitForAuth();

  const titulo = document.getElementById("nota-titulo").value.trim();
  const data = document.getElementById("nota-data").value;
  const texto = document.getElementById("nota-texto").value.trim();

  if (!titulo || !data || clientesNota.length === 0) {
    alert("Informe título, data e pelo menos um cliente.");
    return;
  }

  if ($form.dataset.editId) {
  // EDITAR
  await db.collection("notas").doc($form.dataset.editId).update({
    titulo,
    data,
    clientes: clientesNota,
    observacaoGeral: texto
  });

  delete $form.dataset.editId;

} else {
  // NOVA NOTA
  await db.collection("notas").add({
    userId: user.uid,
    titulo,
    data,
    clientes: clientesNota,
    observacaoGeral: texto,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

  clientesNota = [];
  $form.reset();
  renderPreview();
});


// ================== LISTAR + IMPRIMIR ==================
waitForAuth().then(user => {
  db.collection("notas")
    .where("userId", "==", user.uid)
    .orderBy("createdAt", "desc")
    .onSnapshot(snap => {
      $list.innerHTML = "";
      const termo = document.getElementById("filtro-busca")?.value?.toLowerCase() || "";
const dataFiltro = document.getElementById("filtro-data")?.value;

      if (snap.empty) {
        $list.innerHTML = `<p class="text-gray-500">Nenhuma anotação.</p>`;
        return;
      }

      snap.forEach(doc => { 
        const n = doc.data();
        if (
  termo &&
  !n.titulo.toLowerCase().includes(termo) &&
  !n.clientes.some(c => c.cliente.toLowerCase().includes(termo))
) return;

if (dataFiltro && n.data !== dataFiltro) return;

        const card = document.createElement("div");
       card.className = "bg-white rounded-xl shadow-sm border overflow-hidden";

        card.innerHTML = `
  <div class="p-4 cursor-pointer flex justify-between items-center card-header">
    <div>
      <h3 class="font-semibold text-gray-800">${n.titulo}</h3>
      <p class="text-sm text-gray-500">
        ${new Date(n.data + "T00:00:00").toLocaleDateString("pt-BR")}
        • ${n.clientes.length} cliente(s)
      </p>
    </div>

    <div class="flex gap-4 text-sm">
      <button class="text-blue-600 btn-edit" data-id="${doc.id}">Editar</button>
      <button class="text-red-600 btn-del" data-id="${doc.id}">Excluir</button>
      <button class="text-gray-600 btn-print">🖨</button>
    </div>
  </div>

  <div class="px-4 pb-4 hidden card-body">
    ${n.clientes.map(c => `
      <div class="mb-3">
        <p class="font-medium text-gray-700">${c.cliente}</p>
        <ul class="ml-4 list-disc text-sm text-gray-600">
          ${c.produtos.map(p => `
            <li>${p.nome}${p.obs ? ` — ${p.obs}` : ""}</li>
          `).join("")}
        </ul>
      </div>
    `).join("")}

    ${n.observacaoGeral ? `
      <div class="mt-3 pt-3 border-t text-sm text-gray-600">
        ${n.observacaoGeral}
      </div>
    ` : ""}
  </div>
`;
  
        // ===== IMPRESSÃO COM ZEBRA =====
        card.querySelector(".btn-print").onclick = () => {
          const w = window.open("", "_blank");
          w.document.write(`
            <html>
              <head>
                <title>${n.titulo}</title>
                <style>
                  body {
                    font-family: Arial;
                    padding: 20px;
                  }
                  h2 {
                    margin-bottom: 5px;
                  }
                  .cliente {
                    padding: 8px;
                    margin-bottom: 6px;
                  }
                  .zebra-0 {
                    background: #f3f4f6;
                  }
                  .zebra-1 {
                    background: #ffffff;
                  }
                </style>
              </head>
              <body>
                <h2>${n.titulo}</h2>
                <p><strong>Data:</strong> ${new Date(n.data + "T00:00:00").toLocaleDateString("pt-BR")}</p>

                ${n.clientes.map((c, i) => `
                  <div class="cliente zebra-${i % 2}">
                    <strong>${c.cliente}</strong>
                    <ul>
                      ${c.produtos.map(p => `
                        <li>${p.nome}${p.obs ? ` — ${p.obs}` : ""}</li>
                      `).join("")}
                    </ul>
                  </div>
                `).join("")}

                ${n.observacaoGeral ? `<p>${n.observacaoGeral}</p>` : ""}
              </body>
            </html>
          `);
          w.document.close();
          w.print();
        };

        $list.appendChild(card);
  
  const header = card.querySelector(".card-header");
const body = card.querySelector(".card-body");

header.addEventListener("click", (e) => {
  if (e.target.tagName === "BUTTON") return;
  body.classList.toggle("hidden");
});
        
        // ===== EDITAR =====
card.querySelector(".btn-edit").onclick = async () => {
  const id = doc.id;

  const snapNota = await db.collection("notas").doc(id).get();
  const nota = snapNota.data();

  // Preencher formulário
  document.getElementById("nota-titulo").value = nota.titulo;
  document.getElementById("nota-data").value = nota.data;
  document.getElementById("nota-texto").value = nota.observacaoGeral || "";

  clientesNota = nota.clientes || [];
  renderPreview();

  // Marcar modo edição
  $form.dataset.editId = id;

  window.scrollTo({ top: 0, behavior: "smooth" });
};

// ===== EXCLUIR =====
card.querySelector(".btn-del").onclick = async () => {
  if (!confirm("Excluir esta anotação?")) return;
  await db.collection("notas").doc(doc.id).delete();
};
      });
    });
});

}
