import express from "express";
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from "@whiskeysockets/baileys";
import cors from "cors";
import qrcode from "qrcode-terminal";

const app = express();
app.use(cors());
app.use(express.json());

let sock;

const start = async () => {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");
  sock = makeWASocket({
    printQRInTerminal: true,
    auth: state,
  });

  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log("Conexão encerrada. Reconectando...", shouldReconnect);
      if (shouldReconnect) start();
    } else if (connection === "open") {
      console.log("✅ Conectado ao WhatsApp com sucesso!");
    }
  });
};

start();

app.get("/", (req, res) => {
  res.send("Servidor WhatsApp Online ✅");
});

app.post("/send", async (req, res) => {
  const { numbers, message } = req.body;
  const results = [];

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
