// ================== PRODUÇÃO ==================
function renderProducao() {
  pageContent.innerHTML = `
    <h2 class="text-xl font-bold mb-4">Produção</h2>
    <form id="producao-form" class="bg-white p-4 rounded shadow mb-4 space-y-3">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
        <input type="date" id="prod-data" class="border p-2 rounded w-full" required>
        <select id="prod-produto" class="border p-2 rounded w-full"></select>
        <input type="number" id="prod-qtd" class="border p-2 rounded w-full" placeholder="Qtd produzida" required>
      </div>
      <button class="bg-blue-600 text-white p-2 rounded w-full mt-2">Salvar</button>
    </form>
    <div id="prod-list" class="space-y-4"></div>
  `;

  const $selProd = document.getElementById("prod-produto");
  const $form    = document.getElementById("producao-form");
  const $list    = document.getElementById("prod-list");

  // helpers para data
  function diaSemanaPT(dateStr) {
    const nomes = ["domingo","segunda-feira","terça-feira","quarta-feira","quinta-feira","sexta-feira","sábado"];
    const dt = new Date(dateStr + "T00:00:00");
    return nomes[dt.getDay()];
  }
  function dataBR(dateStr) {
    const [y,m,d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  }

  // carregar produtos
  waitForAuth().then(user => {
    db.collection("produtos").where("userId","==",user.uid).get().then(snap=>{
      $selProd.innerHTML = `<option value="">Selecione o produto</option>`;
      snap.forEach(doc=>{
        const d = doc.data();
        const opt = document.createElement("option");
        opt.value = d.nome;
        opt.textContent = d.nome;
        $selProd.appendChild(opt);
      });
    });
  });

  // salvar produção
  $form.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const user = await waitForAuth();
    const data = document.getElementById("prod-data").value;
    const produto = $selProd.value;
    const qtd = parseInt(document.getElementById("prod-qtd").value);

    await db.collection("producao").add({
      userId: user.uid,
      data,
      produto,
      quantidade: qtd,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    $form.reset();
  });

  // listar produções agrupadas por data
  waitForAuth().then(user=>{
    db.collection("producao").where("userId","==",user.uid).orderBy("data","desc")
      .onSnapshot(async snap=>{
        $list.innerHTML = "";
        if(snap.empty){
          $list.innerHTML = `<p class="text-gray-500">Nenhuma produção lançada.</p>`;
          return;
        }

        // agrupa por data
        const prodPorDia = {};
        for(const doc of snap.docs){
          const p = { id: doc.id, ...doc.data() };
          if(!prodPorDia[p.data]) prodPorDia[p.data] = [];
          prodPorDia[p.data].push(p);
        }

        Object.keys(prodPorDia).sort((a,b)=>b.localeCompare(a)).forEach(dia=>{
          // header colapsável com data formatada
          const header = document.createElement("div");
          header.className = "px-3 py-2 rounded border-l-4 border-blue-500 bg-blue-50 text-blue-700 font-bold cursor-pointer";
          header.textContent = `${dataBR(dia)} - ${diaSemanaPT(dia)}`;

          const container = document.createElement("div");
          container.className = "ml-4 mt-2 hidden space-y-2";

          // lista de produções do dia
          prodPorDia[dia].forEach(async item=>{
            // total agendado para o dia/produto
            const agSnap = await db.collection("agendamentos")
              .where("userId","==",user.uid)
              .where("data","==",item.data)
              .where("produtoNome","==",item.produto)
              .get();

            let totalAg = 0;
            agSnap.forEach(a=> totalAg += a.data().quantidade||0);
            const disponivel = (item.quantidade||0) - totalAg;

            const card = document.createElement("div");
            card.className = "p-3 bg-white rounded shadow flex justify-between items-center";
            card.innerHTML = `
              <div>
                <div class="font-semibold">${item.produto}</div>
                <div class="text-sm">Produzido: ${formatQuantidade(item.quantidade)}</div>
                <div class="text-sm">Agendado: ${formatQuantidade(totalAg)}</div>
                <div class="text-sm font-bold text-green-600">Disponível: ${formatQuantidade(disponivel)}</div>
              </div>
              <div class="space-x-2">
                <button data-id="${item.id}" class="bg-yellow-500 text-white px-2 py-1 rounded btn-edit">Editar</button>
                <button data-id="${item.id}" class="bg-red-600 text-white px-2 py-1 rounded btn-del">Excluir</button>
              </div>
            `;
            container.appendChild(card);
          });

          // toggle abrir/fechar
          header.addEventListener("click", ()=>container.classList.toggle("hidden"));

          $list.appendChild(header);
          $list.appendChild(container);
        });

        // excluir
        $list.querySelectorAll(".btn-del").forEach(btn=>{
          btn.addEventListener("click", async e=>{
            if(confirm("Excluir esta produção?")){
              await db.collection("producao").doc(e.target.dataset.id).delete();
            }
          });
        });

        // editar
        $list.querySelectorAll(".btn-edit").forEach(btn=>{
          btn.addEventListener("click", async e=>{
            const id = e.target.dataset.id;
            const snap = await db.collection("producao").doc(id).get();
            const d = snap.data();

            const modal = document.createElement("div");
            modal.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";
            modal.innerHTML = `
              <div class="bg-white rounded-lg shadow-lg w-full max-w-lg p-6 space-y-4">
                <h3 class="text-lg font-bold mb-2">Editar Produção</h3>
                <div class="grid grid-cols-1 gap-3">
                  <input id="edit-data" type="date" class="border p-2 rounded" value="${d.data || ""}">
                  <input id="edit-prod" class="border p-2 rounded" value="${d.produto || ""}" placeholder="Produto">
                  <input id="edit-qtd" type="number" class="border p-2 rounded" value="${d.quantidade || 0}" placeholder="Quantidade">
                </div>
                <div class="flex justify-end space-x-3 mt-4">
                  <button id="btn-cancel" class="bg-gray-400 text-white px-4 py-2 rounded">Cancelar</button>
                  <button id="btn-save" class="bg-green-600 text-white px-4 py-2 rounded">Salvar</button>
                </div>
              </div>
            `;
            document.body.appendChild(modal);

            modal.querySelector("#btn-cancel").addEventListener("click", ()=>modal.remove());
            modal.querySelector("#btn-save").addEventListener("click", async ()=>{
              const data = modal.querySelector("#edit-data").value;
              const produto = modal.querySelector("#edit-prod").value.trim();
              const quantidade = parseInt(modal.querySelector("#edit-qtd").value)||0;

              await db.collection("producao").doc(id).update({ data, produto, quantidade });
              modal.remove();
            });
          });
        });
      });
  });
}
