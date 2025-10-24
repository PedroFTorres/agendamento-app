import express from "express";
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from "@whiskeysockets/baileys";
import cors from "cors";
import qrcode from "qrcode";

const app = express();
app.use(cors());
app.use(express.json());

let sock;
let qrDataUrl = null;

async function startSock() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    printQRInTerminal: false,
    auth: state,
    browser: ["Render-WhatsApp", "Chrome", "1.0"],
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      qrDataUrl = await qrcode.toDataURL(qr);
      console.log("📱 Escaneie o QR Code via link /qrcode");
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log("❌ Conexão encerrada. Reconnect:", shouldReconnect);
      if (shouldReconnect) startSock();
    } else if (connection === "open") {
      console.log("✅ Conectado ao WhatsApp!");
    }
  });
}

startSock();

// Mostrar QR Code no navegador
app.get("/qrcode", (req, res) => {
  if (qrDataUrl) {
    res.send(`<h1>Escaneie o QR Code abaixo:</h1><img src="${qrDataUrl}" />`);
  } else {
    res.send("Nenhum QR Code disponível. Já conectado ✅");
  }
});

app.get("/", (req, res) => {
  res.send("Servidor WhatsApp Online ✅");
});

// Rota de envio de mensagens
app.post("/send", async (req, res) => {
  const { numbers, message } = req.body;
  const results = [];

  if (!sock) {
    return res.status(500).json({ error: "Sessão WhatsApp não iniciada" });
  }

  for (const number of numbers) {
    try {
      await sock.sendMessage(`${number}@s.whatsapp.net`, { text: message });
      results.push({ number, status: "success" });
    } catch (err) {
      console.log("Erro ao enviar:", err.message);
      results.push({ number, status: "failed" });
    }
  }

  res.json(results);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Servidor WhatsApp rodando na porta " + PORT));
