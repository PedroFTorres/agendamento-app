// ================== BLOCO DE ANOTAÇÕES ==================
function renderNotas() {
  pageContent.innerHTML = `
    <div class="p-4">
      <h2 class="text-2xl font-bold mb-4">📒 Bloco de Anotações</h2>

      <form id="nota-form" class="bg-yellow-50 p-4 rounded shadow space-y-4">

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

      <div id="notas-list" class="mt-6 space-y-4"></div>
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

    db.collection("clientes")
      .where("userId", "==", user.uid)
      .get()
      .then(snap => {
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

  await db.collection("notas").add({
    userId: user.uid,
    titulo,
    data,
    clientes: clientesNota,
    observacaoGeral: texto,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

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

      if (snap.empty) {
        $list.innerHTML = `<p class="text-gray-500">Nenhuma anotação.</p>`;
        return;
      }

      snap.forEach(doc => {
        const n = doc.data();

        const card = document.createElement("div");
        card.className = "bg-yellow-100 p-4 rounded shadow";

        card.innerHTML = `
          <div class="flex justify-between items-center mb-2">
            <h3 class="font-bold">${n.titulo}</h3>
            <button class="bg-gray-700 text-white px-3 py-1 rounded btn-print">
              Imprimir
            </button>
          </div>

          <p class="text-sm text-gray-600 mb-2">
            📅 ${new Date(n.data + "T00:00:00").toLocaleDateString("pt-BR")}
          </p>

          ${n.clientes.map((c, i) => `
            <div class="mb-2 ${i % 2 === 0 ? "bg-gray-100" : "bg-white"} p-2 rounded">
              <strong>${c.cliente}</strong>
              <ul class="ml-4 list-disc">
                ${c.produtos.map(p => `
                  <li>
                    ${p.nome}
                    ${p.obs ? `— <em>${p.obs}</em>` : ""}
                  </li>
                `).join("")}
              </ul>
            </div>
          `).join("")}

          ${n.observacaoGeral ? `<p class="mt-2">${n.observacaoGeral}</p>` : ""}
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
      });
    });
});

}
