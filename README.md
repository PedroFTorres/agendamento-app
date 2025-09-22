# Agendamento App (Versão Modular)

## Estrutura
- login.html → tela de login/cadastro
- index.html → painel com CRUD
- js/firebase.js → inicialização do Firebase
- js/auth.js → autenticação (login/cadastro/logout)
- js/crud.js → CRUD de clientes, representantes e produtos

## Como rodar
1. Configure o Firebase no `js/firebase.js` (coloque sua apiKey e dados corretos).
2. Abra `login.html` com Live Server.
3. Cadastre-se e faça login.
4. Após login, será redirecionado para `index.html`.

## Próximos passos
- Adicionar `agendamento.js` (calendário).
- Adicionar `relatorios.js` (gráficos + PDF).