// === CLIENTES COM REPRESENTANTE OBRIGATÓRIO ===
function renderClientesComRepresentante() {
  pageContent.innerHTML = `
    <h2 class="text-xl font-bold mb-4">Cadastro de Clientes</h2>

    <form id="form-cliente" class="bg-white p-4 rounded shadow space-y-3">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input id="cliente-nome" class="border p-2 rounded w-full" placeholder="Nome do cliente" required>
        <input id="cliente-whatsapp" class="border p-2 rounded w-full" placeholder="WhatsApp" required>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <select id="cliente-representante" class="border p-2 rounded w-full" required>
          <option value="">Selecione o representante</option>
        </select>
        <input id="cliente-cidade" class="border p-2 rounded w-full" placeholder="Cidade" required>
      </div>

      <button class="bg-blue-600 text-white p-2 rounded w-full mt-2">Salvar</button>
    </form>

    <div id="clientes-lista" class="mt-4 space-y-2"></div>
  `;

  const form = document.getElementById("form-cliente");
  const selRep = document.getElementById("cliente-representante");
  const lista = document.getElementById("clientes-lista");

  // Carregar lista de representantes
  waitForAuth().then(user => {
    db.collection("representantes")
      .where("userId", "==", user.uid)
      .orderBy("nome")
      .get()
      .then(snapshot => {
        snapshot.forEach(doc => {
          const d = doc.data();
          const opt = document.createElement("option");
          opt.value = d.nome;
          opt.textContent = d.nome;
          selRep.appendChild(opt);
        });
      });
  });

  // Salvar cliente
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = await waitForAuth();

    const nome = document.getElementById("cliente-nome").value.trim();
    const whatsapp = document.getElementById("cliente-whatsapp").value.trim();
    const representante = selRep.value;
    const cidade = document.getElementById("cliente-cidade").value.trim();

    if (!representante) {
      alert("Selecione um representante antes de salvar!");
      return;
    }

    await db.collection("clientes").add({
      userId: user.uid,
      nome,
      whatsapp,
      representante,
      cidade,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    form.reset();
  });

  // Listar clientes
  waitForAuth().then(user => {
    db.collection("clientes")
      .where("userId", "==", user.uid)
      .orderBy("nome")
      .onSnapshot(snap => {
        lista.innerHTML = "";
        if (snap.empty) {
          lista.innerHTML = `<p class="text-gray-500">Nenhum cliente cadastrado.</p>`;
          return;
        }
        snap.forEach(doc => {
          const c = doc.data();
          const card = document.createElement("div");
          card.className = "p-3 bg-white rounded shadow flex justify-between items-center";
          card.innerHTML = `
            <div>
              <div class="font-bold">${c.nome}</div>
              <div class="text-sm text-gray-600">${c.representante}</div>
              <div class="text-sm">${c.whatsapp}</div>
              <div class="text-sm">${c.cidade}</div>
            </div>
          `;
          lista.appendChild(card);
        });
      });
  });
}
