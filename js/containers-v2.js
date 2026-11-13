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
  const localizacao = item => item.status === "com_cliente" ? "com_cliente" : "patio";
  const localizacaoNome = item => localizacao(item) === "com_cliente" ? "Com cliente" : "No pátio";
  const localizacaoCor = item => localizacao(item) === "com_cliente" ? "bg-orange-100 text-orange-800" : "bg-green-100 text-green-800";
  const condicao = item => item.condicao || (item.status === "manutencao" ? "danificado" : "normal");
  const condicaoNome = item => condicao(item) === "danificado" ? "Danificado" : "Normal";
  const condicaoCor = item => condicao(item) === "danificado" ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800";
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
    const linhas=[["Número","Localização","Cliente","Pedido","Data de saída","Dias com cliente","Condição","Última devolução","Observação"],
      ...lista.map(i=>[i.numero,localizacaoNome(i),i.clienteAtual,i.pedidoCodigo,i.dataSaida,localizacao(i)==="com_cliente"?dias(i.dataSaida):i.diasUltimaPermanencia,condicaoNome(i),localizacao(i)==="com_cliente"?"":i.ultimaDevolucao,i.observacaoCondicao||i.observacaoSaida||i.observacaoDevolucao||""])];
    const texto="\ufeff"+linhas.map(l=>l.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(";")).join("\n");
    const url=URL.createObjectURL(new Blob([texto],{type:"text/csv;charset=utf-8"}));
    const a=document.createElement("a");a.href=url;a.download="controle-containers.csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  async function exportarPdf(lista, filtros = {}) {
    if(!window.jspdf?.jsPDF){alert("Gerador de PDF indisponível.");return;}
    if(!lista.length){alert("Nenhum contêiner encontrado com os filtros selecionados.");return;}

    const doc=new window.jspdf.jsPDF({orientation:"landscape",unit:"mm",format:"a4"});
    const azul=[31,59,100],azulClaro=[239,246,255],cinza=[107,114,128],borda=[226,232,240],laranja=[242,140,40];
    const total=lista.length;
    const comCliente=lista.filter(i=>localizacao(i)==="com_cliente").length;
    const noPatio=lista.filter(i=>localizacao(i)==="patio").length;
    const danificados=lista.filter(i=>condicao(i)==="danificado").length;
    const emissao=new Date().toLocaleString("pt-BR");

    let logo=null;
    try {
      if(typeof carregarLogoDataUrl==="function") logo=await carregarLogoDataUrl();
    } catch(_) {}
    if(logo) doc.addImage(logo,"PNG",14,9,20,20);

    doc.setTextColor(...azul);
    doc.setFont("helvetica","bold");
    doc.setFontSize(18);
    doc.text("Controle de Contêineres Retornáveis",logo?39:14,17);
    doc.setFont("helvetica","normal");
    doc.setFontSize(9);
    doc.setTextColor(...cinza);
    doc.text("Relatório de movimentação e permanência",logo?39:14,23);
    doc.text("Emitido em "+emissao,283,17,{align:"right"});
    doc.setDrawColor(...azul);
    doc.setLineWidth(0.5);
    doc.line(14,32,283,32);

    const campos=[
      ["Cliente",filtros.cliente||"Todos os clientes",14,74],
      ["Localização",filtros.localizacao||"Todos os locais",91,55],
      ["Período",dataBR(filtros.inicio)+" a "+dataBR(filtros.fim),149,74]
    ];
    campos.forEach(([rotulo,valor,x,largura])=>{
      doc.setFillColor(248,250,252);
      doc.setDrawColor(...borda);
      doc.roundedRect(x,36,largura,15,2,2,"FD");
      doc.setFont("helvetica","bold");doc.setFontSize(7.5);doc.setTextColor(...cinza);
      doc.text(rotulo,x+4,41);
      doc.setFont("helvetica","normal");doc.setFontSize(9);doc.setTextColor(31,41,55);
      const texto=doc.splitTextToSize(String(valor),largura-8);
      doc.text(texto.slice(0,2),x+4,47);
    });

    const cards=[
      ["TOTAL",total,14,azulClaro,azul],
      ["COM CLIENTES",comCliente,81,[248,250,252],[31,41,55]],
      ["NO PÁTIO",noPatio,148,[236,253,245],[4,120,87]],
      ["DANIFICADOS",danificados,215,[254,242,242],[185,28,28]]
    ];
    cards.forEach(([rotulo,valor,x,fundo,texto])=>{
      doc.setFillColor(...fundo);doc.setDrawColor(...borda);
      doc.roundedRect(x,56,62,18,2,2,"FD");
      doc.setFont("helvetica","normal");doc.setFontSize(7);doc.setTextColor(...cinza);
      doc.text(rotulo,x+4,62);
      doc.setFont("helvetica","bold");doc.setFontSize(14);doc.setTextColor(...texto);
      doc.text(String(valor),x+4,70);
    });

    doc.autoTable({
      startY:79,
      margin:{left:14,right:14,bottom:16},
      head:[["Número","Cliente","Pedido","Saída","Dias","Localização","Condição","Observação"]],
      body:lista.map(i=>[
        i.numero,
        i.clienteAtual||"-",
        i.pedidoCodigo||"-",
        dataBR(i.dataSaida),
        localizacao(i)==="com_cliente"?dias(i.dataSaida):"-",
        localizacaoNome(i),
        condicaoNome(i),
        i.observacaoCondicao||i.observacaoSaida||i.observacaoDevolucao||"-"
      ]),
      theme:"grid",
      styles:{font:"helvetica",fontSize:7.5,cellPadding:2.4,textColor:[55,65,81],lineColor:borda,lineWidth:0.15,valign:"middle",overflow:"linebreak"},
      headStyles:{fillColor:azul,textColor:[255,255,255],fontStyle:"bold",fontSize:8,halign:"left",cellPadding:3},
      alternateRowStyles:{fillColor:[248,250,252]},
      columnStyles:{
        0:{cellWidth:17,fontStyle:"bold",textColor:azul},
        1:{cellWidth:43},
        2:{cellWidth:53},
        3:{cellWidth:25,halign:"center"},
        4:{cellWidth:14,halign:"center"},
        5:{cellWidth:24,fontStyle:"bold"},
        6:{cellWidth:25,halign:"center"},
        7:{cellWidth:"auto"}
      },
      didParseCell:(dados)=>{
        if(dados.section!=="body"||dados.column.index!==5)return;
        const valor=String(dados.cell.raw||"").toLowerCase();
        if(valor.includes("com cliente"))dados.cell.styles.textColor=azul;
        else if(valor.includes("pátio"))dados.cell.styles.textColor=[4,120,87];
      }
    });

    const paginas=doc.internal.getNumberOfPages();
    for(let pagina=1;pagina<=paginas;pagina+=1){
      doc.setPage(pagina);
      doc.setDrawColor(...borda);doc.setLineWidth(0.2);doc.line(14,196,283,196);
      doc.setFont("helvetica","normal");doc.setFontSize(7.5);doc.setTextColor(...cinza);
      doc.text("AgendaCF - Controle de Contêineres",14,201);
      doc.text("Página "+pagina+" de "+paginas,283,201,{align:"right"});
      doc.setFillColor(...laranja);doc.rect(14,204,269,1,"F");
    }

    const clienteArquivo=norm(filtros.cliente||"todos").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
    const localArquivo=norm(filtros.localizacao||"todos").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
    doc.save("containers-"+clienteArquivo+"-"+localArquivo+".pdf");
  }

  async function renderContainers() {
    if(PERFIL!=="admin"){pageContent.innerHTML='<div class="bg-red-50 text-red-700 p-4 rounded">Acesso exclusivo do administrador.</div>';return;}
    pageContent.innerHTML=`
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div><h2 class="text-xl font-bold text-blue-900">Controle de Contêineres</h2><p class="text-sm text-gray-500">Localização, tempo com o cliente e condição atual de cada contêiner.</p></div>
        <div class="flex flex-wrap gap-2"><button id="ct-cadastrar" class="bg-blue-700 text-white px-4 py-2 rounded">+ Registrar saída</button><button id="ct-devolver" class="bg-green-700 text-white px-4 py-2 rounded">Registrar devolução</button></div>
      </div>
      <div id="ct-cards" class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4"></div>
      <section class="bg-white p-4 rounded-xl shadow mb-4">
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-2">
          <label class="text-xs text-gray-500 xl:col-span-2">Pesquisar<input id="ct-busca" class="border p-2 rounded w-full mt-1" placeholder="Número, cliente ou pedido"></label>
          <label class="text-xs text-gray-500">Cliente<select id="ct-cliente" class="border p-2 rounded w-full mt-1"><option value="">Todos os clientes</option></select></label>
          <label class="text-xs text-gray-500">Localização<select id="ct-localizacao" class="border p-2 rounded w-full mt-1"><option value="">Todos os locais</option><option value="com_cliente">Com cliente</option><option value="patio">No pátio</option></select></label>
          <label class="text-xs text-gray-500">Condição<select id="ct-condicao" class="border p-2 rounded w-full mt-1"><option value="">Todas as condições</option><option value="normal">Normal</option><option value="danificado">Danificado</option></select></label>
          <button id="ct-limpar" class="border border-gray-400 rounded p-2 self-end">Limpar filtros</button>
        </div>
        <details class="mt-3">
          <summary class="text-sm text-blue-700 cursor-pointer">Filtrar por período de movimentação</summary>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
            <label class="text-xs text-gray-500">Mês<input id="ct-mes" type="month" class="border p-2 rounded w-full mt-1"></label>
            <label class="text-xs text-gray-500">Data inicial<input id="ct-inicio" type="date" class="border p-2 rounded w-full mt-1"></label>
            <label class="text-xs text-gray-500">Data final<input id="ct-fim" type="date" class="border p-2 rounded w-full mt-1"></label>
          </div>
        </details>
        <div class="flex gap-2 mt-3"><button id="ct-csv" class="border border-green-700 text-green-700 px-3 py-2 rounded">Exportar CSV</button><button id="ct-pdf" class="border border-red-700 text-red-700 px-3 py-2 rounded">Exportar PDF</button></div>
      </section>
      <section class="bg-white rounded-xl shadow overflow-hidden">
        <div class="px-4 py-3 border-b"><h3 class="font-bold text-blue-900">Relação de todos os contêineres</h3><p class="text-xs text-gray-500">A condição pode ser alterada a qualquer momento, independentemente da localização.</p></div>
        <div class="overflow-x-auto"><table class="w-full text-sm"><thead class="bg-gray-50"><tr><th class="text-left p-3">Número</th><th class="text-left p-3">Localização</th><th class="text-left p-3">Cliente / último cliente</th><th class="text-left p-3">Desde</th><th class="text-right p-3">Dias</th><th class="text-left p-3">Condição</th><th class="text-left p-3">Observação</th><th class="text-right p-3">Ação</th></tr></thead><tbody id="ct-lista"></tbody></table></div>
      </section>
    `;

    let containers=await buscar(CT,"container");
    const clientes=await buscar("clientes"), pedidos=await buscar("pedidos");
    let visiveis=[];
    const clienteFiltro=document.getElementById("ct-cliente");
    [...new Set(containers.map(i=>String(i.clienteAtual||"").trim()).filter(Boolean))]
      .sort((a,b)=>a.localeCompare(b,"pt-BR"))
      .forEach(nome=>clienteFiltro.add(new Option(nome,nome)));

    function periodoSelecionado() {
      const mes=document.getElementById("ct-mes").value,inicio=document.getElementById("ct-inicio").value,fim=document.getElementById("ct-fim").value;
      if(inicio||fim)return {inicio:inicio||"0000-01-01",fim:fim||"9999-12-31",ativo:true};
      if(mes){const [ano,numero]=mes.split("-").map(Number),ultimo=new Date(ano,numero,0).getDate();return {inicio:mes+"-01",fim:mes+"-"+String(ultimo).padStart(2,"0"),ativo:true};}
      return {inicio:"0000-01-01",fim:"9999-12-31",ativo:false};
    }
    function dentro(data,periodo){return !periodo.ativo||(data&&data>=periodo.inicio&&data<=periodo.fim);}

    function atualizar() {
      const termo=norm(document.getElementById("ct-busca").value);
      const cliente=document.getElementById("ct-cliente").value;
      const local=document.getElementById("ct-localizacao").value;
      const estado=document.getElementById("ct-condicao").value;
      const periodo=periodoSelecionado();
      visiveis=containers.filter(i=>{
        const referencia=localizacao(i)==="com_cliente"?i.dataSaida:(i.ultimaDevolucao||i.dataSaida);
        const texto=norm(`${i.numero} ${i.clienteAtual} ${i.pedidoCodigo}`);
        return dentro(referencia,periodo)&&(!termo||texto.includes(termo))&&(!cliente||i.clienteAtual===cliente)&&(!local||localizacao(i)===local)&&(!estado||condicao(i)===estado);
      }).sort((a,b)=>String(a.numero).localeCompare(String(b.numero),"pt-BR",{numeric:true}));

      const comCliente=visiveis.filter(i=>localizacao(i)==="com_cliente").length;
      const patio=visiveis.filter(i=>localizacao(i)==="patio").length;
      const danificados=visiveis.filter(i=>condicao(i)==="danificado").length;
      document.getElementById("ct-cards").innerHTML=[
        ["Total",visiveis.length,"bg-blue-50 text-blue-900"],
        ["Com clientes",comCliente,"bg-orange-50 text-orange-800"],
        ["No pátio",patio,"bg-green-50 text-green-800"],
        ["Danificados",danificados,"bg-red-50 text-red-800"]
      ].map(x=>`<div class="${x[2]} border rounded-lg p-3"><div class="text-xs">${x[0]}</div><strong class="text-2xl">${x[1].toLocaleString("pt-BR")}</strong></div>`).join("");

      document.getElementById("ct-lista").innerHTML=visiveis.length?visiveis.map(i=>{
        const fora=localizacao(i)==="com_cliente";
        const dataLocal=fora?i.dataSaida:i.ultimaDevolucao;
        const observacao=i.observacaoCondicao||i.observacaoDevolucao||i.observacaoSaida||"-";
        return `<tr class="border-t hover:bg-gray-50">
          <td class="p-3 font-bold text-blue-900">${esc(i.numero)}</td>
          <td class="p-3"><span class="px-2 py-1 rounded-full text-xs ${localizacaoCor(i)}">${localizacaoNome(i)}</span></td>
          <td class="p-3">${esc(i.clienteAtual||"-")}</td>
          <td class="p-3">${dataBR(dataLocal)}</td>
          <td class="p-3 text-right">${fora?dias(i.dataSaida):"-"}</td>
          <td class="p-3"><span class="px-2 py-1 rounded-full text-xs font-semibold ${condicaoCor(i)}">${condicaoNome(i)}</span></td>
          <td class="p-3 max-w-xs">${esc(observacao)}</td>
          <td class="p-3 text-right"><button data-editar-condicao="${i.id}" class="border border-blue-700 text-blue-700 px-3 py-1 rounded whitespace-nowrap">Editar condição</button></td>
        </tr>`;
      }).join(""):'<tr><td colspan="8" class="p-6 text-center text-gray-500">Nenhum contêiner encontrado.</td></tr>';
    }

    function abrirEdicaoCondicao(item) {
      const m=modal("Editar condição do contêiner "+esc(item.numero),`
        <div class="space-y-3">
          <div class="bg-gray-50 border rounded p-3 text-sm"><strong>Localização:</strong> ${esc(localizacaoNome(item))}${item.clienteAtual?` • Cliente: ${esc(item.clienteAtual)}`:""}${localizacao(item)==="com_cliente"?` • ${dias(item.dataSaida)} dia(s)`:""}</div>
          <label class="block"><span class="font-semibold block mb-1">Condição atual *</span><select id="condicao-valor" class="border p-2 rounded w-full"><option value="normal" ${condicao(item)==="normal"?"selected":""}>Normal</option><option value="danificado" ${condicao(item)==="danificado"?"selected":""}>Danificado</option></select></label>
          <label class="block"><span class="font-semibold block mb-1">Observação da condição</span><textarea id="condicao-obs" rows="3" class="border p-2 rounded w-full" placeholder="Ex.: tampa quebrada, vazamento, estrutura amassada">${esc(item.observacaoCondicao||"")}</textarea></label>
        </div>`,"Salvar condição");
      m.querySelector(".salvar").onclick=async()=>{
        const novoEstado=m.querySelector("#condicao-valor").value;
        const observacao=m.querySelector("#condicao-obs").value.trim();
        const botao=m.querySelector(".salvar");botao.disabled=true;botao.textContent="Salvando...";
        try{
          const usuario=await waitForAuth();
          const batch=db.batch();
          batch.update(db.collection(CT).doc(item.id),{
            status:item.status==="manutencao"?"disponivel":item.status,
            condicao:novoEstado,
            observacaoCondicao:observacao,
            condicaoAtualizadaEm:firebase.firestore.FieldValue.serverTimestamp(),
            atualizadoEm:firebase.firestore.FieldValue.serverTimestamp()
          });
          batch.set(db.collection(MOV).doc(),{
            registroTipo:"container_movimento",userId:usuario.uid,containerId:item.id,numero:item.numero,
            tipo:"condicao",data:hoje(),cliente:item.clienteAtual||"",pedidoCodigo:item.pedidoCodigo||"",
            condicao:novoEstado,observacao,createdAt:firebase.firestore.FieldValue.serverTimestamp()
          });
          await batch.commit();
          m.remove();containers=await buscar(CT,"container");atualizar();
        }catch(e){console.error(e);alert("Não foi possível atualizar a condição.");botao.disabled=false;botao.textContent="Salvar condição";}
      };
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
            const dados={registroTipo:"container",userId:usuario.uid,numero,status:"com_cliente",condicao:antigo?condicao(antigo):"normal",clienteAtual:cliente,pedidoCodigo:codigo,pedidoId:pedido.id,dataSaida,observacaoSaida:observacao,atualizadoEm:firebase.firestore.FieldValue.serverTimestamp()};
            if(antigo)batch.update(ref,{...dados,ultimaDevolucao:firebase.firestore.FieldValue.delete(),diasUltimaPermanencia:firebase.firestore.FieldValue.delete(),observacaoDevolucao:firebase.firestore.FieldValue.delete()});else batch.set(ref,{...dados,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
            batch.set(db.collection(MOV).doc(),{registroTipo:"container_movimento",userId:usuario.uid,containerId:ref.id,numero,tipo:"saida",data:dataSaida,cliente,pedidoCodigo:codigo,observacao,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
          });
          await batch.commit();m.remove();containers=await buscar(CT,"container");
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
      const fora=containers.filter(i=>localizacao(i)==="com_cliente");if(!fora.length){alert("Não há contêineres com clientes.");return;}
      const m=modal("Registrar devolução",`<div class="space-y-3">
        <div class="bg-blue-50 text-blue-900 border border-blue-100 rounded p-3 text-sm">A devolução altera apenas a localização para <strong>empresa / pátio</strong>. A condição atual do contêiner será mantida e pode ser editada separadamente.</div>
        <label class="block">Data da devolução *<input id="dev-data" type="date" value="${hoje()}" class="border p-2 rounded w-full"></label>
        <input id="dev-busca" class="border p-2 rounded w-full" placeholder="Pesquisar número ou cliente">
        <div id="dev-lista" class="max-h-72 overflow-y-auto space-y-2">${fora.map(i=>`<label class="dev-linha flex justify-between border rounded p-2" data-busca="${esc(norm(i.numero+" "+i.clienteAtual))}"><span><input type="checkbox" class="dev-item mr-2" value="${i.id}"><strong>${esc(i.numero)}</strong> • ${esc(i.clienteAtual)} <span class="ml-1 px-2 py-0.5 rounded-full text-xs ${condicaoCor(i)}">${condicaoNome(i)}</span></span><span class="text-gray-500">${dias(i.dataSaida)} dias</span></label>`).join("")}</div>
        <label class="block">Observações da devolução<textarea id="dev-obs" class="border p-2 rounded w-full"></textarea></label>
      </div>`,"Confirmar devolução");
      m.querySelector("#dev-busca").oninput=e=>{const t=norm(e.target.value);m.querySelectorAll(".dev-linha").forEach(l=>l.classList.toggle("hidden",t&&!l.dataset.busca.includes(t)));};
      m.querySelector(".salvar").onclick=async()=>{
        const ids=[...m.querySelectorAll(".dev-item:checked")].map(i=>i.value),data=m.querySelector("#dev-data").value,observacao=m.querySelector("#dev-obs").value.trim();
        if(!data||!ids.length){alert("Informe a data e selecione os contêineres devolvidos.");return;}
        const botao=m.querySelector(".salvar");botao.disabled=true;botao.textContent="Salvando...";
        try{
          const usuario=await waitForAuth();
          const batch=db.batch();
          ids.forEach(id=>{
            const i=containers.find(x=>x.id===id),tempo=dias(i.dataSaida);
            batch.update(db.collection(CT).doc(id),{
              status:"disponivel",condicao:condicao(i),ultimaDevolucao:data,diasUltimaPermanencia:tempo,
              observacaoDevolucao:observacao,atualizadoEm:firebase.firestore.FieldValue.serverTimestamp()
            });
            batch.set(db.collection(MOV).doc(),{
              registroTipo:"container_movimento",userId:usuario.uid,containerId:id,numero:i.numero,tipo:"devolucao",
              data,cliente:i.clienteAtual,pedidoCodigo:i.pedidoCodigo,condicao:condicao(i),observacao,diasComCliente:tempo,
              createdAt:firebase.firestore.FieldValue.serverTimestamp()
            });
          });
          await batch.commit();m.remove();containers=await buscar(CT,"container");atualizar();
        }catch(e){console.error(e);alert("Não foi possível registrar a devolução.");botao.disabled=false;botao.textContent="Confirmar devolução";}
      };
    }

    document.getElementById("ct-cadastrar").onclick=abrirCadastro;
    document.getElementById("ct-devolver").onclick=abrirDevolucao;
    document.getElementById("ct-busca").oninput=atualizar;
    document.getElementById("ct-cliente").onchange=atualizar;
    document.getElementById("ct-localizacao").onchange=atualizar;
    document.getElementById("ct-condicao").onchange=atualizar;
    document.getElementById("ct-mes").onchange=()=>{document.getElementById("ct-inicio").value="";document.getElementById("ct-fim").value="";atualizar();};
    document.getElementById("ct-inicio").onchange=()=>{document.getElementById("ct-mes").value="";atualizar();};
    document.getElementById("ct-fim").onchange=()=>{document.getElementById("ct-mes").value="";atualizar();};
    document.getElementById("ct-limpar").onclick=()=>{
      ["ct-busca","ct-cliente","ct-localizacao","ct-condicao","ct-mes","ct-inicio","ct-fim"].forEach(id=>document.getElementById(id).value="");
      atualizar();
    };
    document.getElementById("ct-lista").onclick=e=>{
      const botao=e.target.closest("[data-editar-condicao]");
      if(!botao)return;
      const item=containers.find(i=>i.id===botao.dataset.editarCondicao);
      if(item)abrirEdicaoCondicao(item);
    };
    document.getElementById("ct-csv").onclick=()=>exportarCsv(visiveis);
    document.getElementById("ct-pdf").onclick=()=>{
      const periodo=periodoSelecionado(),cliente=document.getElementById("ct-cliente"),local=document.getElementById("ct-localizacao");
      exportarPdf(visiveis,{
        cliente:cliente.options[cliente.selectedIndex]?.text||"Todos os clientes",
        localizacao:local.options[local.selectedIndex]?.text||"Todos os locais",
        inicio:periodo.ativo?periodo.inicio:"",
        fim:periodo.ativo?periodo.fim:""
      });
    };
    atualizar();
  }
  window.renderContainers=renderContainers;
})();