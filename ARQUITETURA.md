# Organização do aplicativo

Este documento registra qual arquivo é responsável por cada área. A intenção é impedir que uma tela seja implementada novamente em outro arquivo e substituída silenciosamente no navegador.

## Núcleo

- `js/firebase.js`: configuração e acesso ao Firebase.
- `js/auth.js`: autenticação e espera pela sessão.
- `js/crud.js`: clientes, usuários, calendário, dashboard, relatórios gerais e navegação.

## Módulos de negócio

- `js/pedidos-filtros.js`: única implementação da tela e do cadastro de pedidos.
- `js/pedidos.js`: aprovação, edição, cancelamento, exclusão, PDF e WhatsApp dos pedidos.
- `js/precos-prazo-pedidos.js`: cálculo e congelamento de preços por prazo e edição de produtos.
- `js/precos-clientes.js`: preços especiais por cliente.
- `js/relatorio-comissoes.js`: vendas e comissões.
- `js/relatorio-diario-valores.js`: resumo diário e impressão dos agendamentos.
- `js/producao.js`: produção.
- `js/containers-v2.js`: controle atual de contêineres.
- `js/ficha-atendimento.js`: fichas de atendimento.
- `js/notas.js`: bloco de anotações.
- `js/notificacoes.js`: notificações internas e do dispositivo.
- `js/recibo.js`: recibos.

## Extensões controladas

Alguns módulos ainda ampliam funções do núcleo. Essas extensões são carregadas depois de `crud.js` e devem ser alteradas com cuidado:

- `agendamento-modal-fechar.js` fornece a edição atual de agendamentos.
- `relatorio-diario-valores.js` fornece o resumo diário atual.
- `precos-prazo-pedidos.js` aplica valores aos pedidos e produtos.

## Verificação

Execute `node scripts/verificar-app.js` antes de publicar. O comando verifica a sintaxe de todos os scripts carregados, referências inexistentes e o retorno acidental da tela antiga de pedidos em `crud.js`.
