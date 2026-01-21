// ================== PRODUÇÃO ==================
function renderProducao() {
  pageContent.innerHTML = `
    <h2 class="text-xl font-bold mb-4">Produção</h2>

    <form id="producao-form" class="bg-white p-4 rounded shadow mb-4 space-y-3">

      <input type="date" id="prod-data" class="border p-2 rounded w-full" required>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
        <select id="prod-produto" class="border p-2 rounded w-full"></select>
        <input type="number" id="prod-qtd" class="border p-2 rounded w-full" placeholder="Qtd produzida">
        <button type="button" id="btn-add-item" class="bg-gray-600 text-white rounded px-3">
          + Adicionar
        </button>
      </div>

      <div id="itens-dia" class="space-y-2"></div>

      <button class="bg-blue-600 text-white p-2 rounded w-full mt-2">
        Salvar Produção do Dia
      </button>
    </form>

    <div id="prod-list" class="space-y-4"></div>
  `;

  const $form    = document.getElementById("producao-form");
  const $selProd = document.getElementById("prod-produto");
  const $list    = document.getElementById("prod-list");
  const $btnAdd  = document.getElementById("btn-add-item");
  const $itensDia = document.getElementById("itens-dia");

  let itensProducao = [];

  // ===== helpers =====
  function diaSemanaPT(dateStr) {
    const nomes = ["domingo","segunda-feira","terça-feira","quarta-feira","quinta-feira","sexta-feira","sábado"];
    const dt = new Date(dateStr + "T00:00:00");
    return nomes[dt.getDay()];
  }

  function dataBR(dateStr) {
    const [y,m,d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  }

  // ===== carregar produtos =====
  waitForAuth().then(user => {
    db.collection("produtos")
      .where("userId","==",user.uid)
      .get()
      .then(snap => {
        $selProd.innerHTML = `<option value="">Selecione o produto</option>`;
        snap.forEach(doc => {
          const d = doc.data();
          const opt = document.createElement("option");
          opt.value = d.nome;
          opt.textContent = d.nome;
          $selProd.appendChild(opt);
        });
      });
  });

  // ===== adicionar item =====
  $btnAdd.addEventListener("click", () => {
    const produto = $selProd.value;
    const qtd = parseInt(document.getElementById("prod-qtd").value);

    if (!produto || !qtd || qtd <= 0) {
      alert("Informe produto e quantidade válida.");
      return;
    }

    itensProducao.push({ produto, quantidade: qtd });
    renderItens();

    document.getElementById("prod-qtd").value = "";
  });

  function renderItens() {
    $itensDia.innerHTML = "";
    itensProducao.forEach((item, i) => {
      const div = document.createElement("div");
      div.className = "flex justify-between bg-gray-100 p-2 rounded";
      div.innerHTML = `
        <span>${item.produto} — ${formatQuantidade(item.quantidade)}</span>
        <button class="text-red-600">✕</button>
      `;
      div.querySelector("button").onclick = () => {
        itensProducao.splice(i, 1);
        renderItens();
      };
      $itensDia.appendChild(div);
    });
  }

  // ===== salvar produção do dia (BATCH) =====
  $form.addEventListener("submit", async e => {
    e.preventDefault();
    const user = await waitForAuth();
    const data = document.getElementById("prod-data").value;

    if (!data || itensProducao.length === 0) {
      alert("Informe a data e adicione pelo menos um item.");
      return;
    }

    const batch = db.batch();

    itensProducao.forEach(item => {
      const ref = db.collection("producao").doc();
      batch.set(ref, {
        userId: user.uid,
        data,
        produto: item.produto,
        quantidade: item.quantidade,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    });

    await batch.commit();

    itensProducao = [];
    renderItens();
    $form.reset();
  });

  // ===== listar produções =====
  waitForAuth().then(user => {
    db.collection("producao")
      .where("userId","==",user.uid)
      .orderBy("data","desc")
      .onSnapshot(async snap => {
        $list.innerHTML = "";
        if (snap.empty) {
          $list.innerHTML = `<p class="text-gray-500">Nenhuma produção lançada.</p>`;
          return;
        }

        const prodPorDia = {};

        snap.docs.forEach(doc => {
          const p = { id: doc.id, ...doc.data() };
          if (!prodPorDia[p.data]) prodPorDia[p.data] = [];
          prodPorDia[p.data].push(p);
        });

        Object.keys(prodPorDia).forEach(dia => {
          const header = document.createElement("div");
          header.className = "px-3 py-2 rounded border-l-4 border-blue-500 bg-blue-50 font-bold cursor-pointer";
          header.textContent = `${dataBR(dia)} - ${diaSemanaPT(dia)}`;

          const container = document.createElement("div");
          container.className = "ml-4 mt-2 hidden space-y-2";

          prodPorDia[dia].forEach(async item => {
            const agSnap = await db.collection("agendamentos")
              .where("userId","==",user.uid)
              .where("data","==",item.data)
              .where("produtoNome","==",item.produto)
              .get();

            let totalAg = 0;
            agSnap.forEach(a => totalAg += a.data().quantidade || 0);

            const disponivel = item.quantidade - totalAg;

            const card = document.createElement("div");
            card.className = "p-3 bg-white rounded shadow flex justify-between";
            card.innerHTML = `
              <div>
                <div class="font-semibold">${item.produto}</div>
                <div>Produzido: ${formatQuantidade(item.quantidade)}</div>
                <div>Agendado: ${formatQuantidade(totalAg)}</div>
                <div class="font-bold text-green-600">Disponível: ${formatQuantidade(disponivel)}</div>
              </div>
              <button data-id="${item.id}" class="bg-red-600 text-white px-2 py-1 rounded btn-del">
                Excluir
              </button>
            `;
            container.appendChild(card);
          });

          header.onclick = () => container.classList.toggle("hidden");

          $list.appendChild(header);
          $list.appendChild(container);
        });
      });
  });

  // ===== excluir produção =====
  $list.addEventListener("click", async e => {
    const del = e.target.closest(".btn-del");
    if (!del) return;

    if (confirm("Excluir esta produção?")) {
      await db.collection("producao").doc(del.dataset.id).delete();
    }
  });
}
