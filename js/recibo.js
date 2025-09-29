// ================== RECIBO ==================
// Conversor de número -> extenso (pt-BR) para moeda
function numeroParaExtensoBRL(valor) {
  valor = Number(valor || 0);

  let inteiro = Math.floor(valor);
  let cent = Math.round((valor - inteiro) * 100);
  if (cent === 100) { inteiro += 1; cent = 0; }

  if (inteiro === 0 && cent === 0) return "zero real";

  const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  const especiais = ["dez","onze","doze","treze","quatorze","quinze","dezesseis","dezessete","dezoito","dezenove"];
  const dezenas = ["", "", "vinte","trinta","quarenta","cinquenta","sessenta","setenta","oitenta","noventa"];
  const centenas = ["","cento","duzentos","trezentos","quatrocentos","quinhentos","seiscentos","setecentos","oitocentos","novecentos"];

  function trioParaExtenso(n) {
    n = n % 1000;
    if (n === 0) return "";

    const c = Math.floor(n / 100);
    const d = Math.floor((n % 100) / 10);
    const u = n % 10;

    let partes = [];
    if (n === 100) return "cem";
    if (c > 0) partes.push(centenas[c]);

    if (d === 1) {
      partes.push(especiais[u]);
    } else {
      if (d > 1) partes.push(dezenas[d]);
      if (u > 0) partes.push(unidades[u]);
    }

    // Junta com "e" quando cabível
    return partes.join(" e ");
  }

  const escalasSing = ["", "mil", "milhão", "bilhão", "trilhão"];
  const escalasPlural = ["", "mil", "milhões", "bilhões", "trilhões"];

  function inteiroParaExtenso(n) {
    if (n === 0) return "";

    const grupos = [];
    let i = 0;
    while (n > 0) {
      grupos.push(n % 1000);
      n = Math.floor(n / 1000);
      i++;
    }

    const partes = [];
    for (let idx = grupos.length - 1; idx >= 0; idx--) {
      const g = grupos[idx];
      if (g === 0) continue;

      let ext = trioParaExtenso(g);
      const escalaIdx = idx;
      const singular = g === 1;

      if (escalaIdx > 0) {
        if (escalaIdx === 1) {
          // mil: não usamos "um mil"
          ext = singular && ext === "um" ? "mil" : (ext ? `${ext} mil` : "mil");
        } else {
          ext += ` ${singular ? escalasSing[escalaIdx] : escalasPlural[escalaIdx]}`;
        }
      }
      partes.push(ext);
    }

    // Insere "e" apenas entre os dois últimos blocos quando apropriado
    if (partes.length > 1) {
      const last = partes.pop();
      return partes.join(", ") + " e " + last;
    }
    return partes[0] || "";
  }

  const parteInteira = inteiroParaExtenso(inteiro);
  const rotuloReal = inteiro === 1 ? "real" : "reais";

  let resultado = parteInteira ? `${parteInteira} ${rotuloReal}` : "";

  if (cent > 0) {
    const centavosExt = trioParaExtenso(cent);
    const rotuloCent = cent === 1 ? "centavo" : "centavos";
    resultado = resultado
      ? `${resultado} e ${centavosExt} ${rotuloCent}`
      : `${centavosExt} ${rotuloCent}`;
  }

  return resultado;
}

function renderRecibo() {
  pageContent.innerHTML = `
    <h2 class="text-xl font-bold mb-4">Recibo</h2>
    <form id="recibo-form" class="bg-white p-4 rounded shadow space-y-3">
      <input id="recibo-cliente" class="border p-2 rounded w-full" placeholder="Nome do cliente" required>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
        <input id="recibo-valor" type="number" step="0.01" class="border p-2 rounded w-full" placeholder="Valor (R$)" required>
        <input id="recibo-ref" class="border p-2 rounded w-full" placeholder="Referente a (opcional)">
      </div>
      <button class="bg-green-600 text-white p-2 rounded w-full">Gerar Recibo (PDF)</button>
    </form>
  `;

  document.getElementById("recibo-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const cliente = document.getElementById("recibo-cliente").value.trim();
    const valorNum = parseFloat(document.getElementById("recibo-valor").value);
    const ref = document.getElementById("recibo-ref").value.trim();

    if (!cliente || isNaN(valorNum)) {
      alert("Preencha o nome e um valor válido.");
      return;
    }

    const valorMoeda = valorNum.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const valorExtenso = numeroParaExtensoBRL(valorNum);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // ===== LOGO =====
    try {
      const logo = await fetch("img/logo.png").then(r => r.blob()).then(b => new Promise(res => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result);
        reader.readAsDataURL(b);
      }));
      doc.addImage(logo, "PNG", 14, 10, 30, 30);
    } catch {
      console.warn("Logo não encontrada em img/logo.png");
    }

    // ===== CABEÇALHO EMPRESA =====
    doc.setFontSize(14);
    doc.text("CERÂMICA FORTES LTDA.", 50, 20);
    doc.setFontSize(9);
    doc.text("BR 316 KM 05 S/N – Timon(MA) – CEP 65.630-000 – Cx. Postal 26", 50, 26);
    doc.text("Fone: (99) 3118-3700 Fax: (99) 3118-3701", 50, 31);
    doc.text("E-mail: fortes@fortes.com.br   HomePage: www.fortes.com.br", 50, 36);
    doc.text("CNPJ 06.849.988/0001-44 – I. E. 12.095.413-3", 50, 41);

    // ===== TÍTULO =====
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("RECIBO", 105, 60, { align: "center" });

    // ===== CORPO =====
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    const hoje = new Date().toLocaleDateString("pt-BR");

    const y0 = 80;
    doc.text(`Recebemos de: ${cliente}`, 20, y0);
    doc.text(`A importância de: ${valorMoeda} (${valorExtenso})`, 20, y0 + 10);
    doc.text(`Referente a: ${ref || "_________________________________________"}`, 20, y0 + 20);
    doc.text(`Data: ${hoje}`, 20, y0 + 30);

    // ===== ASSINATURA =====
    doc.line(60, y0 + 60, 150, y0 + 60);
    doc.text("Assinatura", 105, y0 + 66, { align: "center" });

    // Salvar (atenção: use crases/backticks aqui)
    doc.save(`recibo-${cliente}.pdf`);
  });
}
