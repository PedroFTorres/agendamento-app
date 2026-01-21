// ================== PRODUÇÃO ==================
function renderProducao() {
  pageContent.innerHTML = `
    <h2 class="text-xl font-bold mb-4">Produção</h2>

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

    <!-- LISTAGEM -->
    <div id="prod-list" class="space-y-4"></div>
  `;

  const $form = document.getElementById("prod-form");
  const $data = document.getElementById("prod-data");
  const $produto = document.getElementById("prod-produto");
  const $qtd = document.getElementById("prod-qtd");
  const $btnAdd = document.getElementById("btn-add");
  const $temp = document.getElementById("lista-temp");
  const $list = document.getElementById("prod-list");

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

  // ================== LISTAGEM ==================
  waitForAuth().then(user => {
    db.collection("producao")
      .where("userId","==",user.uid)
      .orderBy("data","desc")
      .onSnapshot(async snap => {
        $list.innerHTML = "";
        if (snap.empty) return;

        const porDia = {};
        snap.forEach(doc => {
          const d = { id: doc.id, ...doc.data() };
          if (!porDia[d.data]) porDia[d.data] = [];
          porDia[d.data].push(d);
        });

        for (const dia of Object.keys(porDia)) {
          const header = document.createElement("div");
          header.className = "font-bold bg-blue-50 p-2 cursor-pointer";
          header.textContent = `${dataBR(dia)} — ${diaSemana(dia)}`;

          const box = document.createElement("div");
          box.className = "ml-4 mt-2 space-y-2 hidden";

          // agrupar por produto
          const porProduto = {};
          porDia[dia].forEach(p => {
            if (!porProduto[p.produto]) porProduto[p.produto] = { qtd: 0, ids: [] };
            porProduto[p.produto].qtd += p.quantidade;
            porProduto[p.produto].ids.push(p.id);
          });

          for (const prod in porProduto) {
            const produzido = porProduto[prod].qtd;

            const ag = await db.collection("agendamentos")
              .where("userId","==",user.uid)
              .where("data","==",dia)
              .where("produtoNome","==",prod)
              .get();

            let agendado = 0;
            ag.forEach(a => agendado += a.data().quantidade || 0);

            const disp = produzido - agendado;

            const card = document.createElement("div");
            card.className = "bg-white p-3 rounded shadow";
            card.innerHTML = `
              <div class="font-semibold">${prod}</div>
              <div>Produzido: ${formatQuantidade(produzido)}</div>
              <div>Agendado: ${formatQuantidade(agendado)}</div>
              <div class="${disp < 0 ? "text-red-600" : "text-green-600"} font-bold">
                Disponível: ${formatQuantidade(disp)}
              </div>
              <div class="flex gap-2 mt-2">
                <button class="btn-edit bg-yellow-500 text-white px-2 rounded">Editar</button>
                <button class="btn-del bg-red-600 text-white px-2 rounded">Excluir</button>
              </div>
            `;

            // EDITAR
            card.querySelector(".btn-edit").onclick = async () => {
              const novaQtd = prompt("Nova quantidade produzida:", produzido);
              if (!novaQtd) return;

              const qtdPorDoc = Math.floor(novaQtd / porProduto[prod].ids.length);

              for (const id of porProduto[prod].ids) {
                await db.collection("producao").doc(id).update({
                  quantidade: qtdPorDoc
                });
              }
            };

            // EXCLUIR
            card.querySelector(".btn-del").onclick = async () => {
              if (!confirm("Excluir esta produção?")) return;
              for (const id of porProduto[prod].ids) {
                await db.collection("producao").doc(id).delete();
              }
            };

            box.appendChild(card);
          }

          header.onclick = () => box.classList.toggle("hidden");

          $list.appendChild(header);
          $list.appendChild(box);
        }
      });
  });
}

