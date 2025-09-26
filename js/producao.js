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

  // listar produções + cálculo disponibilidade
  waitForAuth().then(user=>{
    db.collection("producao").where("userId","==",user.uid).orderBy("data","desc")
      .onSnapshot(async snap=>{
        $list.innerHTML = "";
        if(snap.empty){
          $list.innerHTML = `<p class="text-gray-500">Nenhuma produção lançada.</p>`;
          return;
        }

        for(const doc of snap.docs){
          const p = doc.data();

          // total agendado para o dia/produto
          const agSnap = await db.collection("agendamentos")
            .where("userId","==",user.uid)
            .where("data","==",p.data)
            .where("produtoNome","==",p.produto)
            .get();

          let totalAg = 0;
          agSnap.forEach(a=> totalAg += a.data().quantidade||0);

          const disponivel = (p.quantidade||0) - totalAg;

          const card = document.createElement("div");
          card.className = "p-4 bg-white rounded shadow";
          card.innerHTML = `
            <div><strong>Data:</strong> ${p.data}</div>
            <div><strong>Produto:</strong> ${p.produto}</div>
            <div><strong>Produzido:</strong> ${formatQuantidade(p.quantidade)}</div>
            <div><strong>Agendado:</strong> ${formatQuantidade(totalAg)}</div>
            <div><strong class="text-green-600">Disponível:</strong> ${formatQuantidade(disponivel)}</div>
          `;
          $list.appendChild(card);
        }
      });
  });
}
