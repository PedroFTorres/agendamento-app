<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Agendamento - Painel</title>

  <!-- Tailwind (CDN) -->
  <script src="https://cdn.tailwindcss.com"></script>

  <!-- FullCalendar CSS -->
  <link href="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.8/index.global.min.css" rel="stylesheet">

  <style>
    body { font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; }
    .sidebar { width: 260px; }
    .content { margin-left: 260px; }
    @media (max-width: 900px) {
      .sidebar { position: relative; width: 100%; }
      .content { margin-left: 0; }
    }
    /* Print tweaks for the PDF-like print view */
    @media print {
      .no-print { display: none !important; }
      body { background: white; color: black; }
    }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">

  <div class="flex">

    <!-- SIDEBAR -->
    <aside class="sidebar fixed left-0 top-0 h-full bg-white border-r shadow-sm p-6">
      <h2 class="text-xl font-bold mb-6">Meu Painel</h2>
      <nav class="space-y-2">
        <button class="nav-btn w-full text-left px-3 py-2 rounded hover:bg-gray-100" data-page="dashboard">Dashboard</button>
        <button class="nav-btn w-full text-left px-3 py-2 rounded hover:bg-gray-100" data-page="agendamentos">Agendamentos</button>
        <button class="nav-btn w-full text-left px-3 py-2 rounded hover:bg-gray-100" data-page="clientes">Clientes</button>
        <button class="nav-btn w-full text-left px-3 py-2 rounded hover:bg-gray-100" data-page="representantes">Representantes</button>
        <button class="nav-btn w-full text-left px-3 py-2 rounded hover:bg-gray-100" data-page="produtos">Produtos</button>
        <button class="nav-btn w-full text-left px-3 py-2 rounded hover:bg-gray-100" data-page="relatorios">Relatórios</button>
      </nav>

      <div class="mt-auto pt-6">
        <div class="text-sm text-gray-500 mb-2">Usuário:</div>
        <div id="user-email-display" class="font-mono bg-gray-100 px-2 py-1 rounded text-sm mb-3">-</div>
        <button id="logout-button" class="w-full bg-red-600 text-white py-2 rounded">Sair</button>
      </div>
    </aside>

    <!-- CONTENT -->
    <main class="content flex-1 min-h-screen p-8">

      <!-- Top bar / title -->
      <header class="mb-6">
        <h1 id="page-title" class="text-2xl font-bold">Dashboard</h1>
      </header>

      <!-- Pages -->
      <section id="dashboard" class="page">
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div class="col-span-2">
            <div id="calendar" class="bg-white rounded shadow p-4"></div>
          </div>
          <div class="space-y-4">
            <div class="bg-white p-4 rounded shadow">
              <h3 class="font-semibold mb-2">Resumo Rápido</h3>
              <div class="grid grid-cols-2 gap-3">
                <div class="p-3 bg-gray-50 rounded">
                  <div class="text-sm text-gray-500">Clientes</div>
                  <div id="card-clients" class="text-2xl font-bold">0</div>
                </div>
                <div class="p-3 bg-gray-50 rounded">
                  <div class="text-sm text-gray-500">Produtos</div>
                  <div id="card-products" class="text-2xl font-bold">0</div>
                </div>
                <div class="p-3 bg-gray-50 rounded">
                  <div class="text-sm text-gray-500">Representantes</div>
                  <div id="card-reps" class="text-2xl font-bold">0</div>
                </div>
                <div class="p-3 bg-gray-50 rounded">
                  <div class="text-sm text-gray-500">Agendamentos</div>
                  <div id="card-appts" class="text-2xl font-bold">0</div>
                </div>
              </div>
            </div>

            <div class="bg-white p-4 rounded shadow">
              <h3 class="font-semibold mb-2">Ranking - Representantes</h3>
              <canvas id="chart-reps" height="250"></canvas>
            </div>

            <div class="bg-white p-4 rounded shadow">
              <h3 class="font-semibold mb-2">Ranking - Clientes</h3>
              <canvas id="chart-clients" height="250"></canvas>
            </div>
          </div>
        </div>
      </section>

      <!-- Agendamentos page -->
      <section id="agendamentos" class="page hidden">
        <div class="bg-white p-4 rounded shadow mb-6">
          <h3 class="text-lg font-semibold mb-3">Novo Agendamento</h3>
          <form id="appt-form" class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select id="appt-client" required class="p-2 border rounded"></select>
            <select id="appt-rep" required class="p-2 border rounded"></select>
            <select id="appt-product" required class="p-2 border rounded"></select>
            <input type="number" id="appt-qty" placeholder="Quantidade" class="p-2 border rounded" required />
            <input type="date" id="appt-date" class="p-2 border rounded" required />
            <div class="flex items-center space-x-2">
              <button id="appt-save" class="bg-green-600 text-white px-4 py-2 rounded">Salvar</button>
              <button id="appt-clear" type="button" class="bg-gray-200 px-4 py-2 rounded">Limpar</button>
            </div>
          </form>
        </div>

        <div class="bg-white p-4 rounded shadow">
          <h3 class="text-lg font-semibold mb-3">Lista de Agendamentos</h3>
          <div id="appts-list" class="space-y-3"></div>
        </div>
      </section>

      <!-- Clientes page -->
      <section id="clientes" class="page hidden">
        <div class="bg-white p-4 rounded shadow mb-6">
          <h3 class="text-lg font-semibold">Clientes</h3>
          <form id="client-form" class="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            <input id="client-name" placeholder="Nome" class="p-2 border rounded" required />
            <input id="client-whatsapp" placeholder="WhatsApp" class="p-2 border rounded" required />
            <div>
              <button class="bg-blue-600 text-white px-4 py-2 rounded" type="submit">Salvar</button>
            </div>
          </form>

          <div class="mt-4">
            <label class="block mb-2 font-medium">Importar clientes (.xlsx)</label>
            <input id="client-file" type="file" accept=".xlsx,.xls" class="p-2 border rounded" />
            <p class="text-sm text-gray-500 mt-1">Cabeçalho: <strong>Nome</strong> e <strong>WhatsApp</strong>.</p>
          </div>

          <ul id="client-list" class="mt-4 space-y-2"></ul>
        </div>
      </section>

      <!-- Representantes page -->
      <section id="representantes" class="page hidden">
        <div class="bg-white p-4 rounded shadow mb-6">
          <h3 class="text-lg font-semibold">Representantes</h3>
          <form id="rep-form" class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <input id="rep-name" placeholder="Nome" class="p-2 border rounded" required />
            <div>
              <button class="bg-blue-600 text-white px-4 py-2 rounded" type="submit">Salvar</button>
            </div>
          </form>
          <ul id="rep-list" class="mt-4 space-y-2"></ul>
        </div>
      </section>

      <!-- Produtos page -->
      <section id="produtos" class="page hidden">
        <div class="bg-white p-4 rounded shadow mb-6">
          <h3 class="text-lg font-semibold">Produtos</h3>
          <form id="product-form" class="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            <input id="product-name" placeholder="Nome" class="p-2 border rounded" required />
            <input id="product-category" placeholder="Categoria" class="p-2 border rounded" required />
            <input id="product-price" placeholder="Preço" type="number" class="p-2 border rounded" required />
            <input id="product-image-url" placeholder="URL imagem (opcional)" class="p-2 border rounded md:col-span-2" />
            <div>
              <button class="bg-blue-600 text-white px-4 py-2 rounded" type="submit">Salvar</button>
            </div>
          </form>
          <ul id="product-list" class="mt-4 space-y-2"></ul>
        </div>
      </section>

      <!-- Relatórios page -->
      <section id="relatorios" class="page hidden">
        <div class="bg-white p-4 rounded shadow mb-6">
          <h3 class="text-lg font-semibold">Relatórios</h3>
          <form id="report-form" class="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
            <input type="date" id="report-start" class="p-2 border rounded" />
            <input type="date" id="report-end" class="p-2 border rounded" />
            <select id="report-client" class="p-2 border rounded"><option value="">Todos os clientes</option></select>
            <select id="report-rep" class="p-2 border rounded"><option value="">Todos os representantes</option></select>
            <div class="md:col-span-4 mt-3">
              <button id="generate-pdf" class="bg-indigo-600 text-white px-4 py-2 rounded">Gerar PDF</button>
            </div>
          </form>
        </div>

        <div id="report-preview" class="bg-white p-4 rounded shadow">
          <h4 class="font-semibold mb-3">Preview (tabela)</h4>
          <div id="report-table" class="overflow-auto"></div>
          <div id="report-totals" class="mt-4"></div>
        </div>
      </section>

    </main>
  </div>

  <!-- LIBS -->
  <!-- FullCalendar -->
  <script src="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.8/index.global.min.js"></script>
  <!-- Chart.js -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.3.0/dist/chart.umd.min.js"></script>
  <!-- jsPDF + autoTable -->
  <script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/jspdf-autotable@3.5.25/dist/jspdf.plugin.autotable.min.js"></script>

  <!-- App (module) -->
  <script type="module" src="app.js"></script>
</body>
</html>
