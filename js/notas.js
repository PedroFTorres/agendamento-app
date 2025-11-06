// ================== BLOCO DE ANOTAÇÕES ==================
function renderNotas() {
  pageContent.innerHTML = `
    <div class="p-4">
      <h2 class="text-2xl font-bold mb-4 text-gray-800">📒 Bloco de Anotações</h2>
      
      <form id="nota-form" class="bg-yellow-50 border border-yellow-200 p-4 rounded-lg shadow-md space-y-3">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input id="nota-titulo" type="text" class="border p-2 rounded w-full" placeholder="Título da anotação" required>
          <select id="nota-cliente" class="border p-2 rounded w-full"></select>
          <select id="nota-produto" class="border p-2 rounded w-full"></select>
        </div>
        <textarea id="nota-texto" class="border p-2 rounded w-full h-32 resize-none" placeholder="Escreva suas anotações..." required></textarea>
        <button class="bg-yellow-600 hover:bg-yellow-700 text-white font-bold p-2 rounded w-full">Salvar Anotação</button>
      </form>

      <div id="notas-list" class="mt-6 space-y-4"></div>
    </div>
  `;

  const $form = document.getElementById("nota-form");
  const $cliente = document.getElementById("nota-cliente");
  const $produto = document.getElementById("nota-produto");
  const $list = document.getElementById("notas-list");

  // === Carregar clientes e produtos ===
  waitForAuth().then(user => {
    db.collection("clientes").where("userId", "==", user.uid).get().then(snap => {
      $cliente.innerHTML = `<option value="">Vincular cliente (opcional)</option>`;
      snap.forEach(doc => {
        const d = doc.data();
        const opt = document.createElement("option");
        opt.value = d.nome;
        opt.textContent = d.nome;
        $cliente.appendChild(opt);
      });
    });

    db.collection("produtos").where("userId", "==", user.uid).get().then(snap => {
      $produto.innerHTML = `<option value="">Vincular produto (opcional)</option>`;
      snap.forEach(doc => {
        const d = doc.data();
        const opt = document.createElement("option");
        opt.value = d.nome;
        opt.textContent = d.nome;
        $produto.appendChild(opt);
      });
    });
  });

  // === Salvar nova anotação ===
  $form.addEventListener("submit", async e => {
    e.preventDefault();
    const user = await waitForAuth();
    const titulo = document.getElementById("nota-titulo").value.trim();
    const cliente = $cliente.value;
    const produto = $produto.value;
    const texto = document.getElementById("nota-texto").value.trim();

    if (!titulo || !texto) return alert("Preencha o título e o texto.");

    await db.collection("notas").add({
      userId: user.uid,
      titulo,
      cliente,
      produto,
      texto,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    $form.reset();
  });

  // === Listar anotações ===
  waitForAuth().then(user => {
    db.collection("notas")
      .where("userId", "==", user.uid)
      .orderBy("createdAt", "desc")
      .onSnapshot(snap => {
        $list.innerHTML = "";
        if (snap.empty) {
          $list.innerHTML = `<p class="text-gray-500 italic">Nenhuma anotação ainda.</p>`;
          return;
        }

        snap.forEach(doc => {
          const n = doc.data();
          const data = n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString("pt-BR") : "";
          const card = document.createElement("div");
          card.className = "bg-yellow-100 border-l-4 border-yellow-500 shadow p-4 rounded-lg relative note-card hover:shadow-lg transition";
          card.innerHTML = `
            <div class="absolute top-2 right-2 flex space-x-2">
              <button class="text-blue-600 hover:underline btn-edit" data-id="${doc.id}">Editar</button>
              <button class="text-red-600 hover:underline btn-del" data-id="${doc.id}">Excluir</button>
            </div>
            <h3 class="text-lg font-semibold mb-1">${n.titulo}</h3>
            <p class="text-sm text-gray-600">${data}</p>
            ${n.cliente ? `<p class="text-sm mt-1"><strong>Cliente:</strong> ${n.cliente}</p>` : ""}
            ${n.produto ? `<p class="text-sm"><strong>Produto:</strong> ${n.produto}</p>` : ""}
            <p class="mt-3 whitespace-pre-line text-gray-800">${n.texto}</p>
          `;
          $list.appendChild(card);
        });
      });
  });

  // === Edição e exclusão ===
  $list.addEventListener("click", async e => {
    const del = e.target.closest(".btn-del");
    const edit = e.target.closest(".btn-edit");
    if (del) {
      const id = del.dataset.id;
      if (confirm("Excluir esta anotação?")) await db.collection("notas").doc(id).delete();
    }
    if (edit) {
      const id = edit.dataset.id;
      const snap = await db.collection("notas").doc(id).get();
      const n = snap.data();
      const novoTexto = prompt("Editar anotação:", n.texto);
      if (novoTexto !== null) {
        await db.collection("notas").doc(id).update({ texto: novoTexto });
      }
    }
  });
}
