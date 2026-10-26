(() => {
  const escRG = valor => String(valor ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  const normRG = valor => String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase();
  const qtdRG = valor => Math.floor(Number(valor || 0)).toLocaleString("pt-BR");
  const hojeRG = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0,10);
  };
  const primeiroDiaRG = () => hojeRG().slice(0,8) + "01";
  const dataBRRG = valor => {
    const p = String(valor || "").slice(0,10).split("-");
    return p.length === 3 ? p.reverse().join("/") : "-";
  };
  const diasEntreRG = (inicio, fim) => {
    if (!inicio || !fim) return null;
    return Math.max(0, Math.floor((new Date(fim + "T12:00:00") - new Date(inicio + "T12:00:00")) / 86400000));
  };

  let estadoRG = { aba:"agendados", inicio:primeiroDiaRG(), fim:hojeRG(), representante:"", produto:"", dias:15, agendamentos:[], clientes:[] };

  function cabecalhoRG() {
    const header = document.getElementById("dashboard-header");
    if (header) header.innerHTML = '<h1>Relatórios</h1><p>Indicadores operacionais e acompanhamento da carteira de clientes.</p>';
  }

  async function carregarDadosRG() {
    const user = await waitForAuth();
    const inicio = estadoRG.inicio;
    const fim = estadoRG.fim;
    let agQuery = db.collection("agendamentos");
    if (inicio) agQuery = agQuery.where("data", ">=", inicio);
    if (fim) agQuery = agQuery.where("data", "<=", fim);
    const cliQuery = PERFIL === "representante"
      ? db.collection("clientes").where("userId", "==", user.uid)
      : db.collection("clientes");
    const [agSnap, cliSnap] = await Promise.all([agQuery.get(), cliQuery.get()]);
    estadoRG.agendamentos = agSnap.docs.map(d => ({id:d.id,...d.data()})).filter(d =>
      PERFIL !== "representante" || d.userId === user.uid
    );
    estadoRG.clientes = cliSnap.docs.map(d => ({id:d.id,...d.data()}));
  }

  function filtrarAgendamentosRG() {
    return estadoRG.agendamentos.filter(item => {
      if (estadoRG.representante && String(item.representanteNome || "") !== estadoRG.representante) return false;
      if (estadoRG.produto && String(item.produtoNome || "") !== estadoRG.produto) return false;
      return true;
    });
  }

  function opcoesRG(lista, atual, todos) {
    return '<option value="">'+todos+'</option>' + lista.map(v =>
      '<option value="'+escRG(v)+'" '+(v === atual ? "selected" : "")+'>'+escRG(v)+'</option>'
    ).join("");
  }

  function resumoAgendadosRG() {
    const dados = filtrarAgendamentosRG();
    const total = dados.reduce((s,i) => s + Number(i.quantidade || 0), 0);
    const dias = new Set(dados.map(i => i.data)).size;
    const produtos = new Set(dados.map(i => i.produtoNome).filter(Boolean)).size;
    const agrupado = new Map();
    dados.forEach(item => {
      const chave = (item.data || "")+"||"+(item.produtoNome || "Não informado");
      const atual = agrupado.get(chave) || {data:item.data,produto:item.produtoNome || "Não informado",quantidade:0,agendamentos:0};
      atual.quantidade += Number(item.quantidade || 0);
      atual.agendamentos += 1;
      agrupado.set(chave,atual);
    });
    const linhas = [...agrupado.values()].sort((a,b) => String(a.data).localeCompare(String(b.data)) || a.produto.localeCompare(b.produto,"pt-BR"));
    return {dados,total,dias,produtos,linhas};
  }

  function renderAgendadosRG() {
    const r = resumoAgendadosRG();
    const corpo = r.linhas.map(item => '<tr><td>'+dataBRRG(item.data)+'</td><td class="font-semibold">'+escRG(item.produto)+'</td><td class="text-right">'+qtdRG(item.agendamentos)+'</td><td class="text-right font-bold">'+qtdRG(item.quantidade)+'</td></tr>').join("");
    const detalhes = [...r.dados].sort((a,b)=>String(a.data).localeCompare(String(b.data)) || String(a.clienteNome||"").localeCompare(String(b.clienteNome||""),"pt-BR")).map(item =>
      '<tr><td>'+dataBRRG(item.data)+'</td><td>'+escRG(item.clienteNome || "-")+'</td><td>'+escRG(item.produtoNome || "-")+'</td><td>'+escRG(item.representanteNome || "-")+'</td><td class="text-right font-bold">'+qtdRG(item.quantidade)+'</td></tr>'
    ).join("");
    return '<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">'+
      '<div class="bg-white p-5"><p class="text-xs uppercase tracking-wider text-gray-500">Quantidade agendada</p><strong class="text-2xl text-blue-900">'+qtdRG(r.total)+'</strong></div>'+
      '<div class="bg-white p-5"><p class="text-xs uppercase tracking-wider text-gray-500">Dias com agendamento</p><strong class="text-2xl text-blue-900">'+qtdRG(r.dias)+'</strong></div>'+
      '<div class="bg-white p-5"><p class="text-xs uppercase tracking-wider text-gray-500">Produtos diferentes</p><strong class="text-2xl text-blue-900">'+qtdRG(r.produtos)+'</strong></div>'+
      '</div>'+
      '<div class="bg-white overflow-hidden mb-5"><div class="p-5 border-b"><h3 class="font-bold">Totais por dia e produto</h3><p class="text-sm text-gray-500">Consolidação das quantidades agendadas no período.</p></div><div class="overflow-x-auto"><table><thead><tr><th>Data</th><th>Produto</th><th class="text-right">Agendamentos</th><th class="text-right">Quantidade</th></tr></thead><tbody>'+(corpo || '<tr><td colspan="4" class="text-center text-gray-500">Nenhum agendamento no período.</td></tr>')+'</tbody></table></div></div>'+
      '<div class="bg-white overflow-hidden"><div class="p-5 border-b"><h3 class="font-bold">Detalhamento dos agendamentos</h3><p class="text-sm text-gray-500">Data, cliente, produto, representante e quantidade.</p></div><div class="overflow-x-auto"><table><thead><tr><th>Data</th><th>Cliente</th><th>Produto</th><th>Representante</th><th class="text-right">Quantidade</th></tr></thead><tbody>'+(detalhes || '<tr><td colspan="5" class="text-center text-gray-500">Nenhum agendamento encontrado.</td></tr>')+'</tbody></table></div></div>';
  }

  async function calcularInativosRG() {
    const user = await waitForAuth();
    let histQuery = db.collection("agendamentos");
    if (estadoRG.fim) histQuery = histQuery.where("data", "<=", estadoRG.fim);
    const histSnap = await histQuery.get();
    const historico = histSnap.docs.map(d => d.data()).filter(d => PERFIL !== "representante" || d.userId === user.uid);
    const ultima = new Map();
    historico.forEach(item => {
      const chave = normRG(item.clienteNome);
      if (!chave) return;
      if (!ultima.has(chave) || String(item.data || "") > String(ultima.get(chave).data || "")) ultima.set(chave,item);
    });
    return estadoRG.clientes.map(cliente => {
      const mov = ultima.get(normRG(cliente.nome));
      const ultimaCompra = mov?.data || "";
      const dias = ultimaCompra ? diasEntreRG(ultimaCompra,estadoRG.fim) : null;
      return {...cliente,ultimaCompra,diasSemComprar:dias,ultimoProduto:mov?.produtoNome || "",representanteNome:cliente.vinculadoPor || mov?.representanteNome || "-"};
    }).filter(cliente => {
      if (estadoRG.representante && String(cliente.representanteNome || "") !== estadoRG.representante) return false;
      if (estadoRG.inicio && cliente.ultimaCompra && cliente.ultimaCompra < estadoRG.inicio) return false;
      return cliente.diasSemComprar === null || cliente.diasSemComprar > Number(estadoRG.dias || 15);
    }).sort((a,b) => {
      if (a.diasSemComprar === null && b.diasSemComprar !== null) return -1;
      if (b.diasSemComprar === null && a.diasSemComprar !== null) return 1;
      return Number(b.diasSemComprar || 0) - Number(a.diasSemComprar || 0);
    });
  }

  async function renderInativosRG() {
    const area = document.getElementById("relatorio-resultado");
    area.innerHTML = '<div class="bg-white p-8 text-center text-gray-500">Calculando clientes inativos...</div>';
    const clientes = await calcularInativosRG();
    const nunca = clientes.filter(c=>c.diasSemComprar===null).length;
    const corpo = clientes.map(c => '<tr><td class="font-semibold">'+escRG(c.nome || "-")+'</td><td>'+escRG(c.representanteNome || "-")+'</td><td>'+escRG(c.whatsapp || "-")+'</td><td>'+ (c.ultimaCompra ? dataBRRG(c.ultimaCompra) : '<span class="text-red-600 font-semibold">Nunca comprou</span>') +'</td><td>'+escRG(c.ultimoProduto || "-")+'</td><td class="text-right font-bold">'+(c.diasSemComprar===null ? "-" : qtdRG(c.diasSemComprar))+'</td></tr>').join("");
    area.innerHTML = '<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">'+
      '<div class="bg-white p-5"><p class="text-xs uppercase tracking-wider text-gray-500">Clientes inativos</p><strong class="text-2xl text-blue-900">'+qtdRG(clientes.length)+'</strong></div>'+
      '<div class="bg-white p-5"><p class="text-xs uppercase tracking-wider text-gray-500">Nunca compraram</p><strong class="text-2xl text-blue-900">'+qtdRG(nunca)+'</strong></div>'+
      '<div class="bg-white p-5"><p class="text-xs uppercase tracking-wider text-gray-500">Limite de inatividade</p><strong class="text-2xl text-blue-900">'+qtdRG(estadoRG.dias)+' dias</strong></div>'+
      '</div>'+
      '<div class="bg-white overflow-hidden"><div class="p-5 border-b"><h3 class="font-bold">Clientes sem comprar</h3><p class="text-sm text-gray-500">Posição calculada até '+dataBRRG(estadoRG.fim)+'.</p></div><div class="overflow-x-auto"><table><thead><tr><th>Cliente</th><th>Representante</th><th>WhatsApp</th><th>Última compra</th><th>Último produto</th><th class="text-right">Dias sem comprar</th></tr></thead><tbody>'+(corpo || '<tr><td colspan="6" class="text-center text-gray-500">Nenhum cliente inativo encontrado.</td></tr>')+'</tbody></table></div></div>';
  }

  function imprimirRG() {
    const titulo = estadoRG.aba === "agendados" ? "Produtos agendados por dia" : "Clientes sem comprar";
    const conteudo = document.getElementById("relatorio-resultado")?.innerHTML || "";
    const janela = window.open("","","width=1100,height=800");
    if (!janela) return alert("Permita a abertura de janelas para imprimir o relatório.");
    janela.document.write('<!doctype html><html><head><meta charset="utf-8"><title>'+titulo+'</title><style>@page{size:A4 landscape;margin:12mm}body{font-family:Arial;color:#172033;font-size:11px}h1{color:#102a4c}table{width:100%;border-collapse:collapse}th{background:#102a4c;color:white;text-align:left;padding:7px}td{border-bottom:1px solid #ddd;padding:7px}.grid{display:flex;gap:12px}.bg-white{border:1px solid #ddd;padding:10px;margin-bottom:10px}.text-right{text-align:right}.font-bold,.font-semibold,strong{font-weight:700}.text-gray-500{color:#667085}.text-red-600{color:#c33}button{display:none}</style></head><body><h1>'+titulo+'</h1><p>Período: '+dataBRRG(estadoRG.inicio)+' a '+dataBRRG(estadoRG.fim)+'</p>'+conteudo+'</body></html>');
    janela.document.close(); janela.onload=()=>setTimeout(()=>janela.print(),200);
  }

  async function atualizarRG() {
    const botao = document.getElementById("rg-atualizar");
    if (botao) { botao.disabled=true; botao.textContent="Carregando..."; }
    try {
      await carregarDadosRG();
      const reps = [...new Set([...estadoRG.agendamentos.map(i=>i.representanteNome),...estadoRG.clientes.map(i=>i.vinculadoPor)].filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
      const prods = [...new Set(estadoRG.agendamentos.map(i=>i.produtoNome).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
      const rep=document.getElementById("rg-representante"), prod=document.getElementById("rg-produto");
      if(rep) rep.innerHTML=opcoesRG(reps,estadoRG.representante,"Todos os representantes");
      if(prod) prod.innerHTML=opcoesRG(prods,estadoRG.produto,"Todos os produtos");
      const area=document.getElementById("relatorio-resultado");
      if(estadoRG.aba==="agendados") area.innerHTML=renderAgendadosRG(); else await renderInativosRG();
    } catch(e) {
      console.error("Erro nos relatórios gerenciais:",e);
      document.getElementById("relatorio-resultado").innerHTML='<div class="bg-white p-6 text-red-600">Não foi possível carregar o relatório.</div>';
    } finally {
      if(botao){botao.disabled=false;botao.textContent="Atualizar relatório";}
    }
  }

  window.renderRelatoriosGerenciais = async function() {
    cabecalhoRG();
    pageContent.innerHTML = '<div class="bg-white p-3 flex flex-wrap gap-2 mb-4">'+
      '<button id="rg-tab-agendados" class="px-4 py-2 '+(estadoRG.aba==="agendados"?"bg-blue-700 text-white":"bg-gray-100")+'">Produtos agendados</button>'+
      '<button id="rg-tab-inativos" class="px-4 py-2 '+(estadoRG.aba==="inativos"?"bg-blue-700 text-white":"bg-gray-100")+'">Clientes sem comprar</button>'+
      '</div>'+
      '<div class="bg-white p-5 mb-5"><div class="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">'+
      '<label><span class="text-sm block mb-1">'+(estadoRG.aba==="inativos"?"Última compra a partir de (opcional)":"Data inicial")+'</span><input id="rg-inicio" type="date" value="'+escRG(estadoRG.inicio)+'" class="w-full"></label>'+
      '<label><span class="text-sm block mb-1">'+(estadoRG.aba==="inativos"?"Data de referência":"Data final")+'</span><input id="rg-fim" type="date" value="'+escRG(estadoRG.fim)+'" class="w-full"></label>'+
      '<label id="rg-wrap-rep"><span class="text-sm block mb-1">Representante</span><select id="rg-representante" class="w-full"><option value="">Todos os representantes</option></select></label>'+
      '<label id="rg-wrap-prod"><span class="text-sm block mb-1">Produto</span><select id="rg-produto" class="w-full"><option value="">Todos os produtos</option></select></label>'+
      '<label id="rg-wrap-dias" class="'+(estadoRG.aba==="inativos"?"":"hidden")+'"><span class="text-sm block mb-1">Mais de quantos dias?</span><input id="rg-dias" type="number" min="1" value="'+escRG(estadoRG.dias)+'" class="w-full"></label>'+
      '</div><div class="flex flex-wrap gap-2 mt-4"><button id="rg-atualizar" class="bg-blue-700 text-white px-5 py-2">Atualizar relatório</button><button id="rg-imprimir" class="border border-blue-700 text-blue-700 px-5 py-2">Imprimir / PDF</button></div></div>'+
      '<div id="relatorio-resultado"></div>';
    const lerFiltros=()=>{estadoRG.inicio=document.getElementById("rg-inicio").value;estadoRG.fim=document.getElementById("rg-fim").value;estadoRG.representante=document.getElementById("rg-representante").value;estadoRG.produto=document.getElementById("rg-produto").value;estadoRG.dias=Number(document.getElementById("rg-dias")?.value||15);};
    document.getElementById("rg-atualizar").onclick=()=>{lerFiltros();atualizarRG();};
    document.getElementById("rg-imprimir").onclick=imprimirRG;
    document.getElementById("rg-tab-agendados").onclick=()=>{lerFiltros();estadoRG.aba="agendados";if(!estadoRG.inicio)estadoRG.inicio=primeiroDiaRG();window.renderRelatoriosGerenciais();};
    document.getElementById("rg-tab-inativos").onclick=()=>{lerFiltros();estadoRG.aba="inativos";estadoRG.inicio="";window.renderRelatoriosGerenciais();};
    await atualizarRG();
    if(PERFIL==="representante"){const w=document.getElementById("rg-wrap-rep");if(w)w.classList.add("hidden");}
    const prod=document.getElementById("rg-wrap-prod"); if(prod) prod.classList.toggle("hidden",estadoRG.aba==="inativos");
  };
})();
