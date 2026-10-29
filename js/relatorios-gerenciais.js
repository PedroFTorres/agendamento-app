(() => {
  const escRG = valor => String(valor ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  const normRG = valor => String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase();
  const qtdRG = valor => Math.floor(Number(valor || 0)).toLocaleString("pt-BR");
  const moedaRG = valor => Number(valor || 0).toLocaleString("pt-BR", {style:"currency",currency:"BRL",minimumFractionDigits:2,maximumFractionDigits:2});
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
  const dataCriacaoISORG = valor => {
    const data = valor?.toDate ? valor.toDate() : (valor ? new Date(valor) : null);
    if (!data || Number.isNaN(data.getTime())) return "";
    const local = new Date(data.getTime() - data.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0,10);
  };
  const dataHoraCriacaoBRRG = valor => {
    const data = valor?.toDate ? valor.toDate() : (valor ? new Date(valor) : null);
    return data && !Number.isNaN(data.getTime()) ? data.toLocaleString("pt-BR", {dateStyle:"short",timeStyle:"short"}) : "-";
  };
  const diasEntreRG = (inicio, fim) => {
    if (!inicio || !fim) return null;
    return Math.max(0, Math.floor((new Date(fim + "T12:00:00") - new Date(inicio + "T12:00:00")) / 86400000));
  };

  let estadoRG = { aba:"agendados", inicio:hojeRG(), fim:hojeRG(), representante:"", produto:"", dias:15, agendamentos:[], clientes:[], perfil:"", userId:"" };
  const cacheCepRG = new Map();

  async function confirmarEscopoRG() {
    const user = await waitForAuth();
    const snap = await db.collection("usuarios").where("uid", "==", user.uid).limit(1).get();
    if (snap.empty) throw new Error("Usuário não cadastrado.");
    const dados = snap.docs[0].data() || {};
    estadoRG.userId = user.uid;
    estadoRG.perfil = normRG(dados.perfil);
    if (estadoRG.perfil !== "admin" && estadoRG.perfil !== "representante") {
      throw new Error("Perfil de usuário inválido.");
    }
    return { user, perfil: estadoRG.perfil };
  }

  function cabecalhoRG() {
    const header = document.getElementById("dashboard-header");
    if (header) header.innerHTML = '<h1>Relatórios</h1><p>Indicadores operacionais e acompanhamento da carteira de clientes.</p>';
  }

  async function carregarDadosRG() {
    const { user, perfil } = await confirmarEscopoRG();
    const inicio = estadoRG.inicio || hojeRG();
    const fim = estadoRG.fim || hojeRG();
    const inicioData = new Date(inicio + "T00:00:00");
    const fimData = new Date(fim + "T23:59:59.999");
    let agQuery = db.collection("agendamentos");
    if (estadoRG.aba === "relacao") {
      agQuery = agQuery
        .where("data", ">=", inicio)
        .where("data", "<=", fim);
    } else {
      agQuery = agQuery
        .where("createdAt", ">=", firebase.firestore.Timestamp.fromDate(inicioData))
        .where("createdAt", "<=", firebase.firestore.Timestamp.fromDate(fimData));
    }
    const cliQuery = perfil === "representante"
      ? db.collection("clientes").where("userId", "==", user.uid)
      : db.collection("clientes");
    const [agSnap, cliSnap] = await Promise.all([agQuery.get(), cliQuery.get()]);
    estadoRG.agendamentos = agSnap.docs.map(d => ({id:d.id,...d.data()})).filter(d =>
      perfil !== "representante" || d.userId === user.uid
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
    const lancamentos = dados.length;
    const produtos = new Set(dados.map(i => i.produtoNome).filter(Boolean)).size;
    const agrupado = new Map();
    dados.forEach(item => {
      const criacao = dataCriacaoISORG(item.createdAt) || "Sem data";
      const chave = criacao+"||"+(item.produtoNome || "Não informado");
      const atual = agrupado.get(chave) || {dataCriacao:criacao,produto:item.produtoNome || "Não informado",quantidade:0,agendamentos:0};
      atual.quantidade += Number(item.quantidade || 0);
      atual.agendamentos += 1;
      agrupado.set(chave,atual);
    });
    const linhas = [...agrupado.values()].sort((a,b) => String(a.dataCriacao).localeCompare(String(b.dataCriacao)) || a.produto.localeCompare(b.produto,"pt-BR"));
    return {dados,total,lancamentos,produtos,linhas};
  }

  function renderAgendadosRG() {
    const r = resumoAgendadosRG();
    const corpo = r.linhas.map(item => '<tr><td>'+dataBRRG(item.dataCriacao)+'</td><td class="font-semibold">'+escRG(item.produto)+'</td><td class="text-right">'+qtdRG(item.agendamentos)+'</td><td class="text-right font-bold">'+qtdRG(item.quantidade)+'</td></tr>').join("");
    const porRepresentante = new Map();
    r.dados.forEach(item => {
      const nome = item.representanteNome || "Sem representante";
      porRepresentante.set(nome,(porRepresentante.get(nome)||0)+Number(item.quantidade||0));
    });
    const reps = [...porRepresentante.entries()].sort((a,b)=>b[1]-a[1]).map(([nome,total]) =>
      '<tr><td class="font-semibold">'+escRG(nome)+'</td><td class="text-right font-bold">'+qtdRG(total)+'</td></tr>'
    ).join("");
    const detalhes = [...r.dados].sort((a,b)=>{
      const ta=a.createdAt?.toMillis?a.createdAt.toMillis():0, tb=b.createdAt?.toMillis?b.createdAt.toMillis():0;
      return ta-tb || String(a.clienteNome||"").localeCompare(String(b.clienteNome||""),"pt-BR");
    }).map(item =>
      '<tr><td class="whitespace-nowrap">'+dataHoraCriacaoBRRG(item.createdAt)+'</td><td class="whitespace-nowrap">'+dataBRRG(item.data)+'</td><td>'+escRG(item.pedidoId || item.codigoPedido || "-")+'</td><td>'+escRG(item.clienteNome || "-")+'</td><td>'+escRG(item.produtoNome || "-")+'</td><td>'+escRG(item.representanteNome || "-")+'</td><td class="text-right font-bold">'+qtdRG(item.quantidade)+'</td></tr>'
    ).join("");
    return '<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">'+
      '<div class="bg-white p-5"><p class="text-xs uppercase tracking-wider text-gray-500">Quantidade agendada no período</p><strong class="text-2xl text-blue-900">'+qtdRG(r.total)+'</strong></div>'+
      '<div class="bg-white p-5"><p class="text-xs uppercase tracking-wider text-gray-500">Itens agendados</p><strong class="text-2xl text-blue-900">'+qtdRG(r.lancamentos)+'</strong></div>'+
      '<div class="bg-white p-5"><p class="text-xs uppercase tracking-wider text-gray-500">Produtos diferentes</p><strong class="text-2xl text-blue-900">'+qtdRG(r.produtos)+'</strong></div>'+
      '</div>'+
      '<div class="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">'+
      '<div class="bg-white overflow-hidden"><div class="p-5 border-b"><h3 class="font-bold">Totais por dia em que foram agendados</h3><p class="text-sm text-gray-500">Usa a data em que o registro foi criado no sistema.</p></div><div class="overflow-x-auto"><table><thead><tr><th>Agendado em</th><th>Produto</th><th class="text-right">Itens</th><th class="text-right">Quantidade</th></tr></thead><tbody>'+(corpo || '<tr><td colspan="4" class="text-center text-gray-500">Nenhum agendamento criado no período.</td></tr>')+'</tbody></table></div></div>'+
      '<div class="bg-white overflow-hidden"><div class="p-5 border-b"><h3 class="font-bold">Totais por representante</h3><p class="text-sm text-gray-500">Quantidade lançada por cada representante.</p></div><div class="overflow-x-auto"><table><thead><tr><th>Representante</th><th class="text-right">Quantidade</th></tr></thead><tbody>'+(reps || '<tr><td colspan="2" class="text-center text-gray-500">Nenhum representante encontrado.</td></tr>')+'</tbody></table></div></div>'+
      '</div>'+
      '<div class="bg-white overflow-hidden"><div class="p-5 border-b"><h3 class="font-bold">Pedidos agendados no período</h3><p class="text-sm text-gray-500">“Agendado em” é quando o pedido entrou no sistema. “Carregamento” é a data marcada para o cliente.</p></div><div class="overflow-x-auto"><table><thead><tr><th>Agendado em</th><th>Carregamento</th><th>Pedido</th><th>Cliente</th><th>Produto</th><th>Representante</th><th class="text-right">Quantidade</th></tr></thead><tbody>'+(detalhes || '<tr><td colspan="7" class="text-center text-gray-500">Nenhum agendamento criado no período.</td></tr>')+'</tbody></table></div></div>';
  }

  async function renderRelacaoRG() {
    const area = document.getElementById("relatorio-resultado");
    area.innerHTML = '<div class="bg-white p-8 text-center text-gray-500">Calculando valores e cidades dos agendamentos...</div>';

    const dados = filtrarAgendamentosRG().map(item => ({...item}));
    if (typeof aplicarValoresAgendamentosRelatorio === "function") {
      await aplicarValoresAgendamentosRelatorio(dados, {uid:estadoRG.userId});
    } else {
      dados.forEach(item => {
        item.valorVenda = Number(item.valorVenda || item.valorTotal || 0);
      });
    }

    const clientesPorNome = new Map();
    estadoRG.clientes.forEach(cliente => {
      const chave = normRG(cliente.nome);
      if (!clientesPorNome.has(chave)) clientesPorNome.set(chave, []);
      clientesPorNome.get(chave).push(cliente);
    });
    const clienteDoAgendamento = item => {
      const candidatos = clientesPorNome.get(normRG(item.clienteNome)) || [];
      return candidatos.find(cliente => item.representanteUserId && cliente.userId === item.representanteUserId)
        || candidatos.find(cliente => normRG(cliente.vinculadoPor) === normRG(item.representanteNome))
        || candidatos[0]
        || {};
    };

    const clientesSemCidade = new Map();
    dados.forEach(item => {
      const cliente = clienteDoAgendamento(item);
      const cep = String(cliente.cep || "").replace(/\D/g, "");
      if (!cliente.cidade && !cliente.localidade && cep.length === 8) {
        clientesSemCidade.set(cliente.id || cep, cliente);
      }
    });
    await Promise.all([...clientesSemCidade.values()].map(async cliente => {
      const cep = String(cliente.cep || "").replace(/\D/g, "");
      try {
        let enderecoCep = cacheCepRG.get(cep);
        if (!enderecoCep) {
          const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
          enderecoCep = await resposta.json();
          if (!resposta.ok || enderecoCep.erro) enderecoCep = {};
          cacheCepRG.set(cep, enderecoCep);
        }
        cliente.cidade = cliente.cidade || enderecoCep.localidade || "";
        cliente.uf = cliente.uf || enderecoCep.uf || "";
      } catch (erro) {
        console.warn("Não foi possível completar a cidade pelo CEP:", cep, erro);
      }
    }));

    dados.forEach(item => {
      const cliente = clienteDoAgendamento(item);
      item.cidade = cliente.cidade || cliente.localidade || "";
      item.uf = cliente.uf || "";
    });
    dados.sort((a,b) =>
      String(a.data || "").localeCompare(String(b.data || "")) ||
      String(a.produtoNome || "").localeCompare(String(b.produtoNome || ""),"pt-BR") ||
      String(a.clienteNome || "").localeCompare(String(b.clienteNome || ""),"pt-BR")
    );

    const totalQtd = dados.reduce((s,item)=>s+Number(item.quantidade||0),0);
    const totalValor = dados.reduce((s,item)=>s+Number(item.valorVenda||0),0);
    const totalClientes = new Set(dados.map(item=>normRG(item.clienteNome)).filter(Boolean)).size;
    const corpo = dados.map(item => {
      const cidade = [item.cidade,item.uf].filter(Boolean).join(" / ") || "-";
      return '<tr>'+
        '<td class="whitespace-nowrap">'+dataBRRG(item.data)+'</td>'+
        '<td class="font-semibold">'+escRG(item.clienteNome || "-")+'</td>'+
        '<td>'+escRG(cidade)+'</td>'+
        '<td>'+escRG(item.produtoNome || "-")+'</td>'+
        '<td>'+escRG(item.representanteNome || "-")+'</td>'+
        '<td class="text-right font-bold">'+qtdRG(item.quantidade)+'</td>'+
        '<td class="text-right whitespace-nowrap">'+moedaRG(item.valorVenda)+'</td>'+
      '</tr>';
    }).join("");

    area.innerHTML =
      '<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">'+
        '<div class="bg-white p-5"><p class="text-xs uppercase tracking-wider text-gray-500">Quantidade no período</p><strong class="text-2xl text-blue-900">'+qtdRG(totalQtd)+'</strong></div>'+
        '<div class="bg-white p-5"><p class="text-xs uppercase tracking-wider text-gray-500">Valor total das vendas</p><strong class="text-2xl text-green-700">'+moedaRG(totalValor)+'</strong></div>'+
        '<div class="bg-white p-5"><p class="text-xs uppercase tracking-wider text-gray-500">Clientes</p><strong class="text-2xl text-blue-900">'+qtdRG(totalClientes)+'</strong></div>'+
      '</div>'+
      '<div class="bg-white overflow-hidden">'+
        '<div class="p-5 border-b"><h3 class="font-bold">Relação de agendamentos por carregamento</h3>'+
        '<p class="text-sm text-gray-500">Período de '+dataBRRG(estadoRG.inicio)+' a '+dataBRRG(estadoRG.fim)+'.</p></div>'+
        '<div class="overflow-x-auto"><table><thead><tr>'+
          '<th>Data</th><th>Cliente</th><th>Cidade</th><th>Produto</th><th>Representante</th>'+
          '<th class="text-right">Quantidade</th><th class="text-right">Valor</th>'+
        '</tr></thead><tbody>'+
          (corpo || '<tr><td colspan="7" class="text-center text-gray-500">Nenhum agendamento encontrado no período.</td></tr>')+
        '</tbody></table></div>'+
      '</div>';
  }

  async function calcularInativosRG() {
    const userId = estadoRG.userId;
    const perfil = estadoRG.perfil;
    let histQuery = db.collection("agendamentos");
    if (estadoRG.fim) histQuery = histQuery.where("data", "<=", estadoRG.fim);
    const histSnap = await histQuery.get();
    const historico = histSnap.docs.map(d => d.data()).filter(d => perfil !== "representante" || d.userId === userId);
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
    const titulo = estadoRG.aba === "agendados" ? "Produtos agendados por dia" : (estadoRG.aba === "relacao" ? "Relação de agendamentos por período" : "Clientes sem comprar");
    const conteudo = document.getElementById("relatorio-resultado")?.innerHTML || "";
    const janela = window.open("","","width=1100,height=800");
    if (!janela) return alert("Permita a abertura de janelas para imprimir o relatório.");
    janela.document.write('<!doctype html><html><head><meta charset="utf-8"><title>'+titulo+'</title><style>@page{size:A4 landscape;margin:12mm}body{font-family:Arial;color:#172033;font-size:11px}h1{color:#102a4c}table{width:100%;border-collapse:collapse}th{background:#102a4c;color:white;text-align:left;padding:7px}td{border-bottom:1px solid #ddd;padding:7px}.grid{display:flex;gap:12px}.bg-white{border:1px solid #ddd;padding:10px;margin-bottom:10px}.text-right{text-align:right}.font-bold,.font-semibold,strong{font-weight:700}.text-gray-500{color:#667085}.text-red-600{color:#c33}button{display:none}</style></head><body><h1>'+titulo+'</h1><p>Período: '+dataBRRG(estadoRG.inicio)+' a '+dataBRRG(estadoRG.fim)+'</p>'+conteudo+'</body></html>');
    janela.document.close(); janela.onload=()=>setTimeout(()=>janela.print(),200);
  }

  async function atualizarRG() {
    const botao = document.getElementById("rg-atualizar");
    const area = document.getElementById("relatorio-resultado");
    if (area) area.innerHTML = '<div class="bg-white p-8 text-center text-gray-500">Carregando somente os dados permitidos para este usuário...</div>';
    if (botao) { botao.disabled=true; botao.textContent="Carregando..."; }
    try {
      await carregarDadosRG();
      const reps = [...new Set([...estadoRG.agendamentos.map(i=>i.representanteNome),...estadoRG.clientes.map(i=>i.vinculadoPor)].filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
      const prods = [...new Set(estadoRG.agendamentos.map(i=>i.produtoNome).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
      const rep=document.getElementById("rg-representante"), prod=document.getElementById("rg-produto");
      if(rep) rep.innerHTML=opcoesRG(reps,estadoRG.representante,"Todos os representantes");
      if(prod) prod.innerHTML=opcoesRG(prods,estadoRG.produto,"Todos os produtos");
      const area=document.getElementById("relatorio-resultado");
      if(estadoRG.aba==="agendados") area.innerHTML=renderAgendadosRG();
      else if(estadoRG.aba==="relacao") await renderRelacaoRG();
      else await renderInativosRG();
    } catch(e) {
      console.error("Erro nos relatórios gerenciais:",e);
      document.getElementById("relatorio-resultado").innerHTML='<div class="bg-white p-6 text-red-600">Não foi possível carregar o relatório.</div>';
    } finally {
      if(botao){botao.disabled=false;botao.textContent="Atualizar relatório";}
    }
  }

  window.renderRelatoriosGerenciais = async function() {
    cabecalhoRG();
    pageContent.innerHTML = '<div class="bg-white p-8 text-center text-gray-500">Confirmando acesso e carregando relatório...</div>';
    try {
      await confirmarEscopoRG();
    } catch (e) {
      console.error("Erro ao confirmar acesso ao relatório:", e);
      pageContent.innerHTML = '<div class="bg-white p-6 text-red-600">Não foi possível confirmar seu acesso ao relatório.</div>';
      return;
    }
    const somenteRepresentante = estadoRG.perfil === "representante";
    pageContent.innerHTML = '<div class="bg-white p-3 flex flex-wrap gap-2 mb-4">'+
      '<button id="rg-tab-agendados" class="px-4 py-2 '+(estadoRG.aba==="agendados"?"bg-blue-700 text-white":"bg-gray-100")+'">Agendamentos realizados</button>'+
      '<button id="rg-tab-relacao" class="px-4 py-2 '+(estadoRG.aba==="relacao"?"bg-blue-700 text-white":"bg-gray-100")+'">Relação por carregamento</button>'+
      '<button id="rg-tab-inativos" class="px-4 py-2 '+(estadoRG.aba==="inativos"?"bg-blue-700 text-white":"bg-gray-100")+'">Clientes sem comprar</button>'+
      '</div>'+
      '<div class="bg-white p-5 mb-5"><div class="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">'+
      '<label><span class="text-sm block mb-1">'+(estadoRG.aba==="inativos"?"Última compra a partir de (opcional)":"Data inicial")+'</span><input id="rg-inicio" type="date" value="'+escRG(estadoRG.inicio)+'" class="w-full"></label>'+
      '<label><span class="text-sm block mb-1">'+(estadoRG.aba==="inativos"?"Data de referência":"Data final")+'</span><input id="rg-fim" type="date" value="'+escRG(estadoRG.fim)+'" class="w-full"></label>'+
      '<label id="rg-wrap-rep" class="'+(somenteRepresentante?"hidden":"")+'"><span class="text-sm block mb-1">Representante</span><select id="rg-representante" class="w-full"><option value="">Todos os representantes</option></select></label>'+
      '<label id="rg-wrap-prod"><span class="text-sm block mb-1">Produto</span><select id="rg-produto" class="w-full"><option value="">Todos os produtos</option></select></label>'+
      '<label id="rg-wrap-dias" class="'+(estadoRG.aba==="inativos"?"":"hidden")+'"><span class="text-sm block mb-1">Mais de quantos dias?</span><input id="rg-dias" type="number" min="1" value="'+escRG(estadoRG.dias)+'" class="w-full"></label>'+
      '</div><div class="flex flex-wrap gap-2 mt-4"><button id="rg-atualizar" class="bg-blue-700 text-white px-5 py-2">Atualizar relatório</button><button id="rg-imprimir" class="border border-blue-700 text-blue-700 px-5 py-2">Imprimir / PDF</button></div></div>'+
      '<div id="relatorio-resultado"></div>';
    const lerFiltros=()=>{estadoRG.inicio=document.getElementById("rg-inicio").value;estadoRG.fim=document.getElementById("rg-fim").value;estadoRG.representante=document.getElementById("rg-representante").value;estadoRG.produto=document.getElementById("rg-produto").value;estadoRG.dias=Number(document.getElementById("rg-dias")?.value||15);};
    document.getElementById("rg-atualizar").onclick=()=>{lerFiltros();atualizarRG();};
    document.getElementById("rg-imprimir").onclick=imprimirRG;
    document.getElementById("rg-tab-agendados").onclick=()=>{lerFiltros();estadoRG.aba="agendados";if(!estadoRG.inicio)estadoRG.inicio=hojeRG();window.renderRelatoriosGerenciais();};
    document.getElementById("rg-tab-relacao").onclick=()=>{lerFiltros();estadoRG.aba="relacao";if(!estadoRG.inicio)estadoRG.inicio=hojeRG();if(!estadoRG.fim)estadoRG.fim=hojeRG();window.renderRelatoriosGerenciais();};
    document.getElementById("rg-tab-inativos").onclick=()=>{lerFiltros();estadoRG.aba="inativos";estadoRG.inicio="";window.renderRelatoriosGerenciais();};
    await atualizarRG();
    const prod=document.getElementById("rg-wrap-prod"); if(prod) prod.classList.toggle("hidden",estadoRG.aba==="inativos");
  };
})();
