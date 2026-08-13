(() => {
  const colecao = "containers";
  const movimentos = "containers_movimentos";
  const esc = valor => String(valor ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const hojeIso = () => new Date().toISOString().slice(0,10);
  const dataBr = valor => valor && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor.split("-").reverse().join("/") : "-";
  const qtd = valor => Number(valor || 0).toLocaleString("pt-BR");
  const diasFora = data => data ? Math.max(0, Math.floor((new Date(hojeIso()+"T00:00:00") - new Date(data+"T00:00:00")) / 86400000)) : 0;
  const statusTexto = status => ({disponivel:"Disponível",com_cliente:"Com cliente",manutencao:"Em manutenção",baixado:"Baixado"}[status] || status || "-");
  const statusClasse = status => status === "disponivel" ? "bg-green-100 text-green-800" : status === "com_cliente" ? "bg-orange-100 text-orange-800" : status === "manutencao" ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-700";

  async function carregarTudo(nome) {
    const snap = await db.collection(nome).get();
    return snap.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) }));
  }

  function baixarCsv(nome, linhas) {
    const texto = linhas.map(linha => linha.map(valor => '"' + String(valor ?? "").replace(/"/g,'""') + '"').join(";")).join("\n");
    const blob = new Blob(["\ufeff" + texto], { type:"text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = nome; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportarPdf(registros) {
    if (!window.jspdf?.jsPDF) { alert("Gerador de PDF indisponível."); return; }
    const doc = new window.jspdf.jsPDF({ orientation:"landscape" });
    doc.setFontSize(16); doc.text("Relatório de Contêineres Retornáveis", 14, 15);
    doc.setFontSize(9); doc.text("Emitido em " + new Date().toLocaleString("pt-BR"), 14, 21);
    doc.autoTable({
      startY:26,
      head:[["Número","Situação","Cliente","Saída","Dias fora","Pedido","Última devolução","Observação"]],
      body:registros.map(item => [
        item.numero, statusTexto(item.status), item.clienteAtual || "-", dataBr(item.dataSaida),
        item.status === "com_cliente" ? diasFora(item.dataSaida) : "-", item.pedidoCodigo || "-",
        dataBr(item.ultimaDevolucao), item.observacao || ""
      ]),
      styles:{ fontSize:8 }, headStyles:{ fillColor:[31,59,100] }
    });
    doc.save("relatorio-containers.pdf");
  }

  async function renderContainers() {
    if (PERFIL !== "admin") {
      pageContent.innerHTML = '<div class="bg-red-50 text-red-700 p-4 rounded">Apenas administradores podem acessar o controle de contêineres.</div>';
      return;
    }

    pageContent.innerHTML = `
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div><h2 class="text-xl font-bold text-blue-900">Contêineres Retornáveis</h2><p class="text-sm text-gray-500">Controle individual de saída, permanência e devolução.</p></div>
        <div class="flex flex-wrap gap-2">
          <button id="container-novo" class="bg-blue-700 text-white px-3 py-2 rounded">+ Cadastrar contêiner</button>
          <button id="container-saida" class="bg-orange-600 text-white px-3 py-2 rounded">Registrar saída</button>
          <button id="container-devolucao" class="bg-green-700 text-white px-3 py-2 rounded">Registrar devolução</button>
        </div>
      </div>
      <div id="container-cards" class="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4"></div>
      <section class="bg-white p-4 rounded-xl shadow mb-4">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input id="container-busca" class="border p-2 rounded" placeholder="Número, cliente ou pedido">
          <select id="container-status" class="border p-2 rounded"><option value="">Todas as situações</option><option value="disponivel">Disponíveis</option><option value="com_cliente">Com cliente</option><option value="manutencao">Em manutenção</option><option value="baixado">Baixados</option></select>
          <button id="container-csv" class="border border-green-700 text-green-700 px-3 py-2 rounded">Exportar CSV</button>
          <button id="container-pdf" class="border border-red-700 text-red-700 px-3 py-2 rounded">Exportar PDF</button>
        </div>
      </section>
      <section class="bg-white rounded-xl shadow overflow-hidden">
        <div class="overflow-x-auto"><table class="w-full text-sm">
          <thead class="bg-gray-50"><tr><th class="text-left p-3">Número</th><th class="text-left p-3">Situação</th><th class="text-left p-3">Cliente</th><th class="text-left p-3">Saída</th><th class="text-right p-3">Dias</th><th class="text-left p-3">Pedido</th><th class="text-right p-3">Ações</th></tr></thead>
          <tbody id="container-lista"></tbody>
        </table></div>
      </section>
      <section class="bg-white p-4 rounded-xl shadow mt-4">
        <details><summary class="cursor-pointer font-bold text-blue-900">Histórico de movimentações</summary><div id="container-historico" class="mt-3 overflow-x-auto"></div></details>
      </section>
    `;

    let containers = await carregarTudo(colecao);
    let historico = await carregarTudo(movimentos);
    let visiveis = [];

    function ordenar() { containers.sort((a,b) => String(a.numero).localeCompare(String(b.numero),"pt-BR",{numeric:true})); }
    function atualizar() {
      ordenar();
      const termo = String(document.getElementById("container-busca")?.value || "").trim().toLowerCase();
      const status = document.getElementById("container-status")?.value || "";
      visiveis = containers.filter(item => (!status || item.status === status) && (!termo || [item.numero,item.clienteAtual,item.pedidoCodigo].some(v => String(v||"").toLowerCase().includes(termo))));
      const disponiveis = containers.filter(i=>i.status==="disponivel").length;
      const fora = containers.filter(i=>i.status==="com_cliente");
      const manutencao = containers.filter(i=>i.status==="manutencao").length;
      const atrasados = fora.filter(i=>i.prazoDevolucao && i.prazoDevolucao < hojeIso()).length;
      document.getElementById("container-cards").innerHTML = [
        ["Total",containers.length,"bg-blue-50 text-blue-900"],
        ["Disponíveis",disponiveis,"bg-green-50 text-green-800"],
        ["Com clientes",fora.length,"bg-orange-50 text-orange-800"],
        ["Manutenção",manutencao,"bg-yellow-50 text-yellow-800"],
        ["Atrasados",atrasados,"bg-red-50 text-red-800"]
      ].map(c=>`<div class="${c[2]} border rounded-lg p-3"><div class="text-xs">${c[0]}</div><div class="text-2xl font-bold">${qtd(c[1])}</div></div>`).join("");

      const corpo = document.getElementById("container-lista");
      corpo.innerHTML = visiveis.length ? visiveis.map(item => {
        const dias = item.status === "com_cliente" ? diasFora(item.dataSaida) : 0;
        const atrasado = item.status === "com_cliente" && item.prazoDevolucao && item.prazoDevolucao < hojeIso();
        return `<tr class="border-t ${atrasado ? "bg-red-50" : ""}">
          <td class="p-3 font-bold">${esc(item.numero)}</td><td class="p-3"><span class="px-2 py-1 rounded-full text-xs ${statusClasse(item.status)}">${statusTexto(item.status)}</span></td>
          <td class="p-3">${esc(item.clienteAtual || "-")}</td><td class="p-3">${dataBr(item.dataSaida)}</td><td class="p-3 text-right font-semibold ${atrasado ? "text-red-700" : ""}">${item.status==="com_cliente" ? dias : "-"}</td>
          <td class="p-3">${esc(item.pedidoCodigo || "-")}</td><td class="p-3 text-right whitespace-nowrap"><button data-edit="${item.id}" class="text-blue-700 mr-3">Editar</button><button data-history="${item.id}" class="text-gray-700">Histórico</button></td>
        </tr>`;
      }).join("") : '<tr><td colspan="7" class="p-5 text-center text-gray-500">Nenhum contêiner encontrado.</td></tr>';

      const histOrdenado = [...historico].sort((a,b)=>String(b.data||"").localeCompare(String(a.data||"")));
      document.getElementById("container-historico").innerHTML = `<table class="w-full text-sm"><thead class="bg-gray-50"><tr><th class="text-left p-2">Data</th><th class="text-left p-2">Número</th><th class="text-left p-2">Movimento</th><th class="text-left p-2">Cliente</th><th class="text-left p-2">Pedido</th><th class="text-left p-2">Condição/Obs.</th></tr></thead><tbody>${histOrdenado.slice(0,200).map(m=>`<tr class="border-t"><td class="p-2">${dataBr(m.data)}</td><td class="p-2 font-semibold">${esc(m.numero)}</td><td class="p-2">${m.tipo==="saida"?"Saída":"Devolução"}</td><td class="p-2">${esc(m.cliente||"-")}</td><td class="p-2">${esc(m.pedidoCodigo||"-")}</td><td class="p-2">${esc([m.condicao,m.observacao].filter(Boolean).join(" • ")||"-")}</td></tr>`).join("")}</tbody></table>`;
    }

    function modalBase(titulo, corpo, salvarTexto="Salvar") {
      const modal=document.createElement("div"); modal.className="fixed inset-0 bg-black bg-opacity-50 z-50 p-3 overflow-y-auto";
      modal.innerHTML=`<div class="bg-white max-w-2xl mx-auto my-8 rounded-xl shadow"><div class="p-4 border-b flex justify-between"><h3 class="font-bold text-blue-900">${titulo}</h3><button class="fechar text-2xl">&times;</button></div><div class="p-4">${corpo}</div><div class="p-4 border-t flex justify-end gap-2"><button class="fechar bg-gray-400 text-white px-4 py-2 rounded">Cancelar</button><button class="salvar bg-blue-700 text-white px-4 py-2 rounded">${salvarTexto}</button></div></div>`;
      document.body.appendChild(modal); modal.querySelectorAll(".fechar").forEach(b=>b.onclick=()=>modal.remove()); return modal;
    }

    async function cadastrar(atual=null) {
      const modal=modalBase(atual?"Editar contêiner":"Cadastrar contêiner",`
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label>Número único *<input id="ct-numero" class="border p-2 rounded w-full" value="${esc(atual?.numero||"")}"></label>
          <label>Tipo/capacidade<input id="ct-tipo" class="border p-2 rounded w-full" value="${esc(atual?.tipo||"")}"></label>
          <label>Situação<select id="ct-status" class="border p-2 rounded w-full"><option value="disponivel">Disponível</option><option value="manutencao">Em manutenção</option><option value="baixado">Baixado</option></select></label>
          <label class="md:col-span-2">Observação<textarea id="ct-obs" class="border p-2 rounded w-full">${esc(atual?.observacao||"")}</textarea></label>
        </div>`);
      modal.querySelector("#ct-status").value=atual?.status==="com_cliente"?"com_cliente":(atual?.status||"disponivel");
      if(atual?.status==="com_cliente") modal.querySelector("#ct-status").disabled=true;
      modal.querySelector(".salvar").onclick=async()=>{
        const numero=modal.querySelector("#ct-numero").value.trim(); if(!numero){alert("Informe o número.");return;}
        if(containers.some(i=>i.id!==atual?.id&&String(i.numero).toLowerCase()===numero.toLowerCase())){alert("Já existe um contêiner com esse número.");return;}
        const dados={numero,tipo:modal.querySelector("#ct-tipo").value.trim(),observacao:modal.querySelector("#ct-obs").value.trim(),status:atual?.status==="com_cliente"?"com_cliente":modal.querySelector("#ct-status").value,atualizadoEm:firebase.firestore.FieldValue.serverTimestamp()};
        if(atual) await db.collection(colecao).doc(atual.id).update(dados); else await db.collection(colecao).add({...dados,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
        modal.remove(); containers=await carregarTudo(colecao); atualizar();
      };
    }

    async function registrarSaida() {
      const disponiveis=containers.filter(i=>i.status==="disponivel"); if(!disponiveis.length){alert("Não há contêineres disponíveis.");return;}
      const clientes=await carregarTudo("clientes");
      const modal=modalBase("Registrar saída no carregamento",`
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <label>Data real da saída *<input id="s-data" type="date" class="border p-2 rounded w-full" value="${hojeIso()}"></label>
          <label>Cliente *<select id="s-cliente" class="border p-2 rounded w-full"><option value="">Selecione</option>${clientes.sort((a,b)=>String(a.nome).localeCompare(String(b.nome),"pt-BR")).map(c=>`<option>${esc(c.nome)}</option>`).join("")}</select></label>
          <label>Pedido/agendamento<input id="s-pedido" class="border p-2 rounded w-full" placeholder="Código opcional"></label>
          <label>Previsão de devolução<input id="s-prazo" type="date" class="border p-2 rounded w-full"></label>
          <label class="md:col-span-2">Observação<input id="s-obs" class="border p-2 rounded w-full"></label>
        </div>
        <div class="font-semibold mb-2">Selecione os contêineres</div><div class="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-64 overflow-y-auto border rounded p-2">${disponiveis.map(i=>`<label class="border rounded p-2"><input type="checkbox" class="s-item mr-2" value="${i.id}">${esc(i.numero)}</label>`).join("")}</div>`,"Confirmar saída");
      modal.querySelector(".salvar").onclick=async()=>{
        const data=modal.querySelector("#s-data").value,cliente=modal.querySelector("#s-cliente").value,ids=[...modal.querySelectorAll(".s-item:checked")].map(i=>i.value);
        if(!data||!cliente||!ids.length){alert("Informe data, cliente e selecione os contêineres.");return;}
        const pedidoCodigo=modal.querySelector("#s-pedido").value.trim(),prazoDevolucao=modal.querySelector("#s-prazo").value,observacao=modal.querySelector("#s-obs").value.trim();
        const batch=db.batch(); ids.forEach(id=>{const item=containers.find(i=>i.id===id); batch.update(db.collection(colecao).doc(id),{status:"com_cliente",clienteAtual:cliente,dataSaida:data,prazoDevolucao,pedidoCodigo,observacaoSaida:observacao,atualizadoEm:firebase.firestore.FieldValue.serverTimestamp()});batch.set(db.collection(movimentos).doc(),{containerId:id,numero:item.numero,tipo:"saida",data,cliente,pedidoCodigo,prazoDevolucao,observacao,createdAt:firebase.firestore.FieldValue.serverTimestamp()});});
        await batch.commit(); modal.remove(); containers=await carregarTudo(colecao);historico=await carregarTudo(movimentos);atualizar();
      };
    }

    async function registrarDevolucao() {
      const fora=containers.filter(i=>i.status==="com_cliente"); if(!fora.length){alert("Não há contêineres com clientes.");return;}
      const modal=modalBase("Registrar devolução",`
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3"><label>Data da devolução *<input id="d-data" type="date" class="border p-2 rounded w-full" value="${hojeIso()}"></label><label>Condição<select id="d-condicao" class="border p-2 rounded w-full"><option>Normal</option><option>Danificado</option></select></label><label>Observação<input id="d-obs" class="border p-2 rounded w-full"></label></div>
        <div class="font-semibold mb-2">Selecione exatamente os que retornaram</div><div class="space-y-2 max-h-72 overflow-y-auto">${fora.sort((a,b)=>String(a.clienteAtual).localeCompare(String(b.clienteAtual),"pt-BR")).map(i=>`<label class="flex justify-between border rounded p-2"><span><input type="checkbox" class="d-item mr-2" value="${i.id}"><strong>${esc(i.numero)}</strong> • ${esc(i.clienteAtual)}</span><span class="text-sm text-gray-500">${diasFora(i.dataSaida)} dias</span></label>`).join("")}</div>`,"Confirmar devolução");
      modal.querySelector(".salvar").onclick=async()=>{
        const data=modal.querySelector("#d-data").value,ids=[...modal.querySelectorAll(".d-item:checked")].map(i=>i.value);if(!data||!ids.length){alert("Informe a data e selecione os contêineres devolvidos.");return;}
        const condicao=modal.querySelector("#d-condicao").value,observacao=modal.querySelector("#d-obs").value.trim(),batch=db.batch();
        ids.forEach(id=>{const item=containers.find(i=>i.id===id);batch.update(db.collection(colecao).doc(id),{status:condicao==="Danificado"?"manutencao":"disponivel",ultimaDevolucao:data,clienteAtual:"",dataSaida:"",prazoDevolucao:"",pedidoCodigo:"",atualizadoEm:firebase.firestore.FieldValue.serverTimestamp()});batch.set(db.collection(movimentos).doc(),{containerId:id,numero:item.numero,tipo:"devolucao",data,cliente:item.clienteAtual||"",pedidoCodigo:item.pedidoCodigo||"",condicao,observacao,diasComCliente:diasFora(item.dataSaida),createdAt:firebase.firestore.FieldValue.serverTimestamp()});});
        await batch.commit();modal.remove();containers=await carregarTudo(colecao);historico=await carregarTudo(movimentos);atualizar();
      };
    }

    document.getElementById("container-novo").onclick=()=>cadastrar();
    document.getElementById("container-saida").onclick=registrarSaida;
    document.getElementById("container-devolucao").onclick=registrarDevolucao;
    document.getElementById("container-busca").oninput=atualizar;
    document.getElementById("container-status").onchange=atualizar;
    document.getElementById("container-csv").onclick=()=>baixarCsv("containers.csv",[["Número","Situação","Cliente","Saída","Dias fora","Pedido","Prazo","Última devolução","Observação"],...visiveis.map(i=>[i.numero,statusTexto(i.status),i.clienteAtual||"",i.dataSaida||"",i.status==="com_cliente"?diasFora(i.dataSaida):"",i.pedidoCodigo||"",i.prazoDevolucao||"",i.ultimaDevolucao||"",i.observacao||""])]);
    document.getElementById("container-pdf").onclick=()=>exportarPdf(visiveis);
    document.getElementById("container-lista").onclick=e=>{const editar=e.target.closest("[data-edit]"),hist=e.target.closest("[data-history]");if(editar)cadastrar(containers.find(i=>i.id===editar.dataset.edit));if(hist){const numero=containers.find(i=>i.id===hist.dataset.history)?.numero;document.querySelector("#container-historico").closest("details").open=true;document.getElementById("container-historico").scrollIntoView({behavior:"smooth"});}};
    atualizar();
  }

  window.renderContainers = renderContainers;
})();