// 🔥 BASIC SERVER - CHANNEL SYSTEM (START FROM SCRATCH)

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));

// 🔥 Temporary in-memory storage (replace later with DB)
let channels = [];

// =============================
// 📌 REGISTER CHANNEL
// =============================
app.post("/api/channels/register", (req, res) => {
  const { channel, email, discord } = req.body;

  if (!channel || !email) {
    return res.status(400).json({ error: "Missing data" });
  }

  const newChannel = {
    id: Date.now(),
    channel,
    email,
    discord,
    status: "pending",
    createdAt: new Date()
  };

  channels.push(newChannel);

  res.json({ success: true });
});

// =============================
// 📌 GET ALL CHANNELS (ADMIN)
// =============================
app.get("/api/channels", (req, res) => {
  res.json(channels);
});

// =============================
// ✅ APPROVE CHANNEL
// =============================
app.post("/api/channels/approve", (req, res) => {
  const { id } = req.body;
  const channel = channels.find(c => c.id == id);

  if (!channel) return res.status(404).json({ error: "Not found" });

  channel.status = "approved";
  res.json({ success: true });
});

// =============================
// ❌ REJECT CHANNEL
// =============================
app.post("/api/channels/reject", (req, res) => {
  const { id } = req.body;
  const channel = channels.find(c => c.id == id);

  if (!channel) return res.status(404).json({ error: "Not found" });

  channel.status = "rejected";
  res.json({ success: true });
});

// =============================
// 🌐 ROUTES
// =============================
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public/admin.html"));
});

// =============================
// 🚀 START SERVER
// =============================
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});