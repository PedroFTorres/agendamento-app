// ================== BLOCO DE ANOTAÇÕES (NOVO) ==================

function renderNotas() {
  pageContent.innerHTML = `
    <div class="p-4">
      <h2 class="text-2xl font-bold mb-4">📒 Bloco de Anotações</h2>

      <form id="nota-form" class="bg-yellow-50 p-4 rounded shadow space-y-3">

        <input id="nota-titulo"
          class="border p-2 rounded w-full"
          placeholder="Título da anotação"
          required>

        <!-- CLIENTE + PRODUTOS -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
          <select id="nota-cliente" class="border p-2 rounded"></select>

          <select id="nota-produtos"
            multiple
            class="border p-2 rounded h-28">
          </select>

          <button type="button"
            id="btn-add-cliente"
            class="bg-blue-600 text-white rounded">
            Vincular
          </button>
        </div>

        <!-- LISTA DE CLIENTES VINCULADOS -->
        <div id="clientes-vinculados" class="space-y-2"></div>

        <textarea id="nota-texto"
          class="border p-2 rounded w-full h-32"
          placeholder="Anotação..."
          required></textarea>

        <button class="bg-yellow-600 text-white p-2 rounded w-full">
          Salvar Anotação
        </button>
      </form>

      <div id="notas-list" class="mt-6 space-y-4"></div>
    </div>
  `;

  const $form = document.getElementById("nota-form");
  const $cliente = document.getElementById("nota-cliente");
  const $produtos = document.getElementById("nota-produtos");
  const $listaClientes = document.getElementById("clientes-vinculados");
  const $list = document.getElementById("notas-list");

  let clientesNota = [];

  // ================== CARREGAR CLIENTES E PRODUTOS ==================
  waitForAuth().then(user => {

    db.collection("clientes")
      .where("userId", "==", user.uid)
      .get()
      .then(snap => {
        $cliente.innerHTML = `<option value="">Cliente</option>`;
        snap.forEach(doc => {
          const d = doc.data();
          $cliente.appendChild(new Option(d.nome, d.nome));
        });
      });

    db.collection("produtos")
      .where("userId", "==", user.uid)
      .get()
      .then(snap => {
        $produtos.innerHTML = "";
        snap.forEach(doc => {
          const d = doc.data();
          $produtos.appendChild(new Option(d.nome, d.nome));
        });
      });
  });

  // ================== VINCULAR CLIENTE ==================
  document.getElementById("btn-add-cliente").onclick = () => {
    const cliente = $cliente.value;
    const produtos = [...$produtos.selectedOptions].map(o => o.value);

    if (!cliente || produtos.length === 0) {
      alert("Selecione cliente e produtos.");
      return;
    }

    clientesNota.push({ cliente, produtos });
    renderClientes();
  };

  function renderClientes() {
    $listaClientes.innerHTML = "";

    clientesNota.forEach((c, i) => {
      const div = document.createElement("div");
      div.className = "bg-blue-50 p-2 rounded flex justify-between";

      div.innerHTML = `
        <div>
          <strong>${c.cliente}</strong><br>
          <span class="text-sm">${c.produtos.join(", ")}</span>
        </div>
        <button class="text-red-600">✕</button>
      `;

      div.querySelector("button").onclick = () => {
        clientesNota.splice(i, 1);
        renderClientes();
      };

      $listaClientes.appendChild(div);
    });
  }

  // ================== SALVAR ANOTAÇÃO ==================
  $form.addEventListener("submit", async e => {
    e.preventDefault();
    const user = await waitForAuth();

    const titulo = document.getElementById("nota-titulo").value.trim();
    const texto = document.getElementById("nota-texto").value.trim();

    if (!titulo || !texto) return;

    await db.collection("notas").add({
      userId: user.uid,
      titulo,
      clientes: clientesNota,
      texto,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    clientesNota = [];
    $form.reset();
    renderClientes();
  });

  // ================== LISTAR ANOTAÇÕES ==================
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
            <h3 class="font-bold">${n.titulo}</h3>

            ${n.clientes?.map(c => `
              <p class="text-sm mt-1">
                <strong>${c.cliente}:</strong> ${c.produtos.join(", ")}
              </p>
            `).join("")}

            <p class="mt-2 whitespace-pre-line">${n.texto}</p>
          `;

          $list.appendChild(card);
        });
      });
  });
}
