(() => {
  // Usa uma coleção já autorizada pelo aplicativo; os tipos mantêm os dados isolados da Produção.
  const CT = "producao";
  const MOV = "producao";
  const esc = v => String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const norm = v => String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase();
  const hoje = () => new Date().toISOString().slice(0,10);
  const dataBR = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v||"")) ? String(v).split("-").reverse().join("/") : "-";
  const dias = v => v ? Math.max(0,Math.floor((new Date(hoje()+"T00:00:00")-new Date(v+"T00:00:00"))/86400000)) : 0;
  const buscar = async (nome, registroTipo = "") => {
    const snap = await db.collection(nome).get();
    return snap.docs
      .map(doc => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter(item => !registroTipo || item.registroTipo === registroTipo);
  };
  const statusNome = s => ({com_cliente:"Com cliente",disponivel:"Devolvido",manutencao:"Em manutenção"}[s]||s||"-");
  const statusCor = s => s==="com_cliente"?"bg-orange-100 text-orange-800":s==="manutencao"?"bg-yellow-100 text-yellow-800":"bg-green-100 text-green-800";
  const dataPedido = p => {
    const valor=p.dataCarregamento||p.dataAgendada||p.data||"";
    if(typeof valor==="string") return valor.slice(0,10);
    if(valor?.toDate) return valor.toDate().toISOString().slice(0,10);
    return "";
  };
  const nomePedido = p => `${p.codigo||p.id} • ${p.produtosResumo||p.produtoNome||"Sem produto"}`;

  function modal(titulo,corpo,texto="Salvar") {
    const el=document.createElement("div");
    el.className="fixed inset-0 bg-black bg-opacity-50 z-50 p-2 md:p-4 overflow-y-auto";
    el.innerHTML=`<div class="bg-white max-w-3xl mx-auto my-4 md:my-8 rounded-xl shadow-xl overflow-hidden">
      <div class="p-4 border-b flex items-center justify-between"><div><h3 class="font-bold text-lg text-blue-900">${titulo}</h3></div><button class="fechar text-2xl text-gray-500">&times;</button></div>
      <div class="p-4 md:p-5">${corpo}</div>
      <div class="p-4 border-t flex justify-end gap-2 bg-gray-50"><button class="fechar bg-gray-400 text-white px-4 py-2 rounded">Cancelar</button><button class="salvar bg-blue-700 text-white px-4 py-2 rounded">${texto}</button></div>
    </div>`;
    document.body.appendChild(el);
    el.querySelectorAll(".fechar").forEach(b=>b.onclick=()=>el.remove());
    return el;
  }

  function exportarCsv(lista) {
    const linhas=[["Número","Cliente","Pedido","Data carregamento","Dias com cliente","Situação","Data devolução","Observação"],
      ...lista.map(i=>[i.numero,i.clienteAtual,i.pedidoCodigo,i.dataSaida,i.status==="com_cliente"?dias(i.dataSaida):i.diasUltimaPermanencia,statusNome(i.status),i.ultimaDevolucao,i.observacaoSaida||i.observacaoDevolucao||""])];
    const texto="\ufeff"+linhas.map(l=>l.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(";")).join("\n");
    const url=URL.createObjectURL(new Blob([texto],{type:"text/csv;charset=utf-8"}));
    const a=document.createElement("a");a.href=url;a.download="controle-containers.csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function exportarPdf(lista) {
    if(!window.jspdf?.jsPDF){alert("Gerador de PDF indisponível.");return;}
    const doc=new window.jspdf.jsPDF({orientation:"landscape"});
    doc.setFontSize(16);doc.text("Controle de Contêineres Retornáveis",14,15);
    doc.setFontSize(9);doc.text("Emitido em "+new Date().toLocaleString("pt-BR"),14,21);
    doc.autoTable({startY:26,head:[["Número","Cliente","Pedido","Carregamento","Dias","Situação","Devolução","Observação"]],
      body:lista.map(i=>[i.numero,i.clienteAtual||"-",i.pedidoCodigo||"-",dataBR(i.dataSaida),i.status==="com_cliente"?dias(i.dataSaida):(i.diasUltimaPermanencia??"-"),statusNome(i.status),dataBR(i.ultimaDevolucao),i.observacaoSaida||i.observacaoDevolucao||""]),
      styles:{fontSize:8},headStyles:{fillColor:[31,59,100]}});
    doc.save("controle-containers.pdf");
  }

  async function renderContainers() {
    if(PERFIL!=="admin"){pageContent.innerHTML='<div class="bg-red-50 text-red-700 p-4 rounded">Acesso exclusivo do administrador.</div>';return;}
    pageContent.innerHTML=`
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div><h2 class="text-xl font-bold text-blue-900">Contêineres Retornáveis</h2><p class="text-sm text-gray-500">Cadastre o envio completo por cliente e pedido.</p></div>
        <div class="flex gap-2"><button id="ct-cadastrar" class="bg-blue-700 text-white px-4 py-2 rounded">+ Cadastrar contêineres</button><button id="ct-devolver" class="bg-green-700 text-white px-4 py-2 rounded">Registrar devolução</button></div>
      </div>
      <div id="ct-cards" class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4"></div>
      <section class="bg-white p-4 rounded-xl shadow mb-4">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input id="ct-busca" class="border p-2 rounded" placeholder="Pesquisar número do contêiner">
          <select id="ct-cliente" class="border p-2 rounded"><option value="">Todos os clientes</option></select>
          <select id="ct-status" class="border p-2 rounded"><option value="">Todas as situações</option><option value="com_cliente">Com cliente</option><option value="disponivel">Devolvidos</option><option value="manutencao">Em manutenção</option></select>
          <button id="ct-limpar" class="border border-gray-400 rounded p-2">Limpar filtros</button>
        </div>
        <div class="flex gap-2 mt-3"><button id="ct-csv" class="border border-green-700 text-green-700 px-3 py-2 rounded">Exportar CSV</button><button id="ct-pdf" class="border border-red-700 text-red-700 px-3 py-2 rounded">Exportar PDF</button></div>
      </section>
      <section class="bg-white rounded-xl shadow overflow-hidden"><div class="overflow-x-auto"><table class="w-full text-sm">
        <thead class="bg-gray-50"><tr><th class="text-left p-3">Número</th><th class="text-left p-3">Cliente</th><th class="text-left p-3">Pedido</th><th class="text-left p-3">Carregamento</th><th class="text-right p-3">Dias</th><th class="text-left p-3">Situação</th><th class="text-left p-3">Observação</th></tr></thead><tbody id="ct-lista"></tbody>
      </table></div></section>
      <details class="bg-white rounded-xl shadow mt-4"><summary class="p-4 cursor-pointer font-bold text-blue-900">Histórico de movimentações</summary><div id="ct-historico" class="p-4 pt-0 overflow-x-auto"></div></details>`;

    let containers=await buscar(CT,"container"), historico=await buscar(MOV,"container_movimento");
    const clientes=await buscar("clientes"), pedidos=await buscar("pedidos");
    let visiveis=[];
    const clienteFiltro=document.getElementById("ct-cliente");
    [...new Set(containers.map(i=>i.clienteAtual).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR")).forEach(n=>clienteFiltro.add(new Option(n,n)));

    function atualizar() {
      const termo=norm(document.getElementById("ct-busca").value),cliente=clienteFiltro.value,status=document.getElementById("ct-status").value;
      visiveis=containers.filter(i=>(!termo||norm(i.numero).includes(termo))&&(!cliente||i.clienteAtual===cliente)&&(!status||i.status===status))
        .sort((a,b)=>String(a.numero).localeCompare(String(b.numero),"pt-BR",{numeric:true}));
      const fora=containers.filter(i=>i.status==="com_cliente"),devolvidos=containers.filter(i=>i.status==="disponivel"),manut=containers.filter(i=>i.status==="manutencao");
      document.getElementById("ct-cards").innerHTML=[["Total",containers.length,"bg-blue-50 text-blue-900"],["Com clientes",fora.length,"bg-orange-50 text-orange-800"],["Devolvidos",devolvidos.length,"bg-green-50 text-green-800"],["Manutenção",manut.length,"bg-yellow-50 text-yellow-800"]].map(x=>`<div class="${x[2]} border rounded-lg p-3"><div class="text-xs">${x[0]}</div><strong class="text-2xl">${x[1].toLocaleString("pt-BR")}</strong></div>`).join("");
      document.getElementById("ct-lista").innerHTML=visiveis.length?visiveis.map(i=>`<tr class="border-t">
        <td class="p-3 font-bold">${esc(i.numero)}</td><td class="p-3">${esc(i.clienteAtual||"-")}</td><td class="p-3">${esc(i.pedidoCodigo||"-")}</td><td class="p-3">${dataBR(i.dataSaida)}</td>
        <td class="p-3 text-right font-semibold">${i.status==="com_cliente"?dias(i.dataSaida):(i.diasUltimaPermanencia??"-")}</td><td class="p-3"><span class="px-2 py-1 rounded-full text-xs ${statusCor(i.status)}">${statusNome(i.status)}</span></td><td class="p-3">${esc(i.observacaoSaida||i.observacaoDevolucao||"-")}</td>
      </tr>`).join(""):'<tr><td colspan="7" class="p-6 text-center text-gray-500">Nenhum contêiner cadastrado.</td></tr>';
      const mov=[...historico].sort((a,b)=>String(b.data||"").localeCompare(String(a.data||"")));
      document.getElementById("ct-historico").innerHTML=`<table class="w-full text-sm"><thead class="bg-gray-50"><tr><th class="text-left p-2">Data</th><th class="text-left p-2">Número</th><th class="text-left p-2">Movimento</th><th class="text-left p-2">Cliente</th><th class="text-left p-2">Pedido</th><th class="text-left p-2">Observação</th></tr></thead><tbody>${mov.map(m=>`<tr class="border-t"><td class="p-2">${dataBR(m.data)}</td><td class="p-2 font-semibold">${esc(m.numero)}</td><td class="p-2">${m.tipo==="saida"?"Saída":"Devolução"}</td><td class="p-2">${esc(m.cliente||"-")}</td><td class="p-2">${esc(m.pedidoCodigo||"-")}</td><td class="p-2">${esc(m.observacao||m.condicao||"-")}</td></tr>`).join("")}</tbody></table>`;
    }

    function abrirCadastro() {
      const clientesOrdenados=[...clientes].filter(c=>c.nome).sort((a,b)=>String(a.nome).localeCompare(String(b.nome),"pt-BR"));
      const m=modal("Cadastrar contêineres do carregamento",`
        <div class="space-y-4">
          <label class="block"><span class="font-semibold block mb-1">1. Cliente *</span><select id="cad-cliente" class="border p-2 rounded w-full"><option value="">Selecione o cliente cadastrado</option>${clientesOrdenados.map(c=>`<option value="${esc(c.nome)}">${esc(c.nome)}</option>`).join("")}</select></label>
          <div><label class="font-semibold block mb-1">2. Pedido do cliente *</label><input id="cad-pesquisa-pedido" class="border p-2 rounded w-full mb-2" placeholder="Pesquisar pelo número ou produto" disabled><select id="cad-pedido" class="border p-2 rounded w-full" disabled><option>Selecione primeiro o cliente</option></select><p id="cad-pedido-info" class="text-xs text-gray-500 mt-1"></p></div>
          <label class="block"><span class="font-semibold block mb-1">3. Data do carregamento *</span><input id="cad-data" type="date" class="border p-2 rounded w-full"><span class="text-xs text-gray-500">Preenchida automaticamente com a data do pedido; pode ser corrigida se necessário.</span></label>
          <div><label class="font-semibold block mb-1">4. Numeração dos contêineres *</label><div id="cad-numeros" class="space-y-2"><div class="flex gap-2"><input class="cad-numero border p-2 rounded flex-1" placeholder="Número do contêiner"><button type="button" class="cad-remover hidden bg-red-600 text-white px-3 rounded">&times;</button></div></div><button id="cad-adicionar" type="button" class="mt-2 border border-blue-700 text-blue-700 px-3 py-2 rounded">+ Adicionar outro contêiner</button></div>
          <label class="block"><span class="font-semibold block mb-1">5. Observações</span><textarea id="cad-obs" rows="3" class="border p-2 rounded w-full" placeholder="Informações sobre o carregamento ou os contêineres"></textarea></label>
        </div>`,"Cadastrar e registrar saída");
      const selCliente=m.querySelector("#cad-cliente"),buscaPedido=m.querySelector("#cad-pesquisa-pedido"),selPedido=m.querySelector("#cad-pedido"),data=m.querySelector("#cad-data"),info=m.querySelector("#cad-pedido-info");
      let pedidosCliente=[];
      function preencherPedidos() {
        const termo=norm(buscaPedido.value);
        const filtrados=pedidosCliente.filter(p=>!termo||norm(`${p.codigo} ${p.produtosResumo} ${p.produtoNome}`).includes(termo));
        const valorAtual = selPedido.value;
        selPedido.innerHTML = '<option value="">Selecione o pedido</option>' +
          filtrados.map(p=>`<option value="${p.id}">${esc(nomePedido(p))}</option>`).join("");
        if (filtrados.some(p => p.id === valorAtual)) selPedido.value = valorAtual;
      }
      selCliente.onchange=()=>{
        pedidosCliente=pedidos.filter(p=>norm(p.clienteNome)===norm(selCliente.value)).sort((a,b)=>String(dataPedido(b)).localeCompare(String(dataPedido(a))));
        buscaPedido.disabled=!selCliente.value;selPedido.disabled=!selCliente.value;buscaPedido.value="";preencherPedidos();data.value="";info.textContent=pedidosCliente.length?`${pedidosCliente.length} pedido(s) encontrado(s).`:"Nenhum pedido encontrado para este cliente.";
      };
      buscaPedido.oninput=preencherPedidos;
      selPedido.onchange=()=>{const p=pedidosCliente.find(x=>x.id===selPedido.value);data.value=p?dataPedido(p):"";info.textContent=p?`Pedido ${p.codigo||p.id} • ${p.produtosResumo||p.produtoNome||""}`:"";};
      function atualizarRemover(){const linhas=m.querySelectorAll("#cad-numeros>div");linhas.forEach(l=>l.querySelector(".cad-remover").classList.toggle("hidden",linhas.length===1));}
      m.querySelector("#cad-adicionar").onclick=()=>{const linha=document.createElement("div");linha.className="flex gap-2";linha.innerHTML='<input class="cad-numero border p-2 rounded flex-1" placeholder="Número do contêiner"><button type="button" class="cad-remover bg-red-600 text-white px-3 rounded">&times;</button>';linha.querySelector("button").onclick=()=>{linha.remove();atualizarRemover();};m.querySelector("#cad-numeros").appendChild(linha);atualizarRemover();linha.querySelector("input").focus();};
      m.querySelector(".salvar").onclick=async()=>{
        const cliente=selCliente.value,pedido=pedidosCliente.find(x=>x.id===selPedido.value),dataSaida=data.value,observacao=m.querySelector("#cad-obs").value.trim();
        const numeros=[...m.querySelectorAll(".cad-numero")].map(i=>i.value.trim()).filter(Boolean);
        if(!cliente||!pedido||!dataSaida||!numeros.length){alert("Cliente, pedido, data do carregamento e ao menos um contêiner são obrigatórios.");return;}
        if(new Set(numeros.map(norm)).size!==numeros.length){alert("Há números repetidos neste cadastro.");return;}
        const existentes=containers.filter(i=>numeros.map(norm).includes(norm(i.numero))&&i.status==="com_cliente");
        if(existentes.length){alert("Estes contêineres já estão com cliente: "+existentes.map(i=>i.numero).join(", "));return;}
        const btn=m.querySelector(".salvar");btn.disabled=true;btn.textContent="Salvando...";
        try {
          const usuario = await waitForAuth();
          const batch=db.batch(),codigo=pedido.codigo||pedido.id;
          numeros.forEach(numero=>{
            const antigo=containers.find(i=>norm(i.numero)===norm(numero));
            const ref=antigo?db.collection(CT).doc(antigo.id):db.collection(CT).doc();
            const dados={registroTipo:"container",userId:usuario.uid,numero,status:"com_cliente",clienteAtual:cliente,pedidoCodigo:codigo,pedidoId:pedido.id,dataSaida,observacaoSaida:observacao,atualizadoEm:firebase.firestore.FieldValue.serverTimestamp()};
            if(antigo)batch.update(ref,dados);else batch.set(ref,{...dados,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
            batch.set(db.collection(MOV).doc(),{registroTipo:"container_movimento",userId:usuario.uid,containerId:ref.id,numero,tipo:"saida",data:dataSaida,cliente,pedidoCodigo:codigo,observacao,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
          });
          await batch.commit();m.remove();containers=await buscar(CT,"container");historico=await buscar(MOV,"container_movimento");
          if(![...clienteFiltro.options].some(o=>o.value===cliente))clienteFiltro.add(new Option(cliente,cliente));
          atualizar();
        } catch(e){
          console.error(e);
          alert(e?.code === "permission-denied"
            ? "O Firebase bloqueou o salvamento. Verifique se o administrador possui acesso à Produção."
            : "Não foi possível cadastrar os contêineres.");
          btn.disabled=false;btn.textContent="Cadastrar e registrar saída";
        }
      };
    }

    function abrirDevolucao() {
      const fora=containers.filter(i=>i.status==="com_cliente");if(!fora.length){alert("Não há contêineres com clientes.");return;}
      const m=modal("Registrar devolução",`<div class="space-y-3"><label class="block">Data da devolução *<input id="dev-data" type="date" value="${hoje()}" class="border p-2 rounded w-full"></label><label class="block">Condição<select id="dev-condicao" class="border p-2 rounded w-full"><option>Normal</option><option>Danificado</option></select></label><input id="dev-busca" class="border p-2 rounded w-full" placeholder="Pesquisar número ou cliente"><div id="dev-lista" class="max-h-72 overflow-y-auto space-y-2">${fora.map(i=>`<label class="dev-linha flex justify-between border rounded p-2" data-busca="${esc(norm(i.numero+" "+i.clienteAtual))}"><span><input type="checkbox" class="dev-item mr-2" value="${i.id}"><strong>${esc(i.numero)}</strong> • ${esc(i.clienteAtual)}</span><span class="text-gray-500">${dias(i.dataSaida)} dias</span></label>`).join("")}</div><label class="block">Observações<textarea id="dev-obs" class="border p-2 rounded w-full"></textarea></label></div>`,"Confirmar devolução");
      m.querySelector("#dev-busca").oninput=e=>{const t=norm(e.target.value);m.querySelectorAll(".dev-linha").forEach(l=>l.classList.toggle("hidden",t&&!l.dataset.busca.includes(t)));};
      m.querySelector(".salvar").onclick=async()=>{
        const ids=[...m.querySelectorAll(".dev-item:checked")].map(i=>i.value),data=m.querySelector("#dev-data").value,condicao=m.querySelector("#dev-condicao").value,observacao=m.querySelector("#dev-obs").value.trim();
        if(!data||!ids.length){alert("Informe a data e selecione os contêineres devolvidos.");return;}
        const usuario = await waitForAuth();
        const batch=db.batch();ids.forEach(id=>{const i=containers.find(x=>x.id===id),tempo=dias(i.dataSaida);batch.update(db.collection(CT).doc(id),{status:condicao==="Danificado"?"manutencao":"disponivel",ultimaDevolucao:data,diasUltimaPermanencia:tempo,observacaoDevolucao:observacao,atualizadoEm:firebase.firestore.FieldValue.serverTimestamp()});batch.set(db.collection(MOV).doc(),{registroTipo:"container_movimento",userId:usuario.uid,containerId:id,numero:i.numero,tipo:"devolucao",data,cliente:i.clienteAtual,pedidoCodigo:i.pedidoCodigo,condicao,observacao,diasComCliente:tempo,createdAt:firebase.firestore.FieldValue.serverTimestamp()});});
        await batch.commit();m.remove();containers=await buscar(CT,"container");historico=await buscar(MOV,"container_movimento");atualizar();
      };
    }

    document.getElementById("ct-cadastrar").onclick=abrirCadastro;
    document.getElementById("ct-devolver").onclick=abrirDevolucao;
    document.getElementById("ct-busca").oninput=atualizar;clienteFiltro.onchange=atualizar;document.getElementById("ct-status").onchange=atualizar;
    document.getElementById("ct-limpar").onclick=()=>{document.getElementById("ct-busca").value="";clienteFiltro.value="";document.getElementById("ct-status").value="";atualizar();};
    document.getElementById("ct-csv").onclick=()=>exportarCsv(visiveis);document.getElementById("ct-pdf").onclick=()=>exportarPdf(visiveis);
    atualizar();
  }
  window.renderContainers=renderContainers;
})();