// 🔥 CHANNEL SYSTEM WITH SUPABASE

const express = require("express");
const cors = require("cors");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;

// 🔐 ENV VARIABLES (ضعها في Render)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// 🔗 Connect Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Middlewares
app.use(cors());
app.use(express.json());

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));

// =============================
// 📌 REGISTER CHANNEL
// =============================
app.post("/api/channels/register", async (req, res) => {
  const { channel, email, discord } = req.body;

  if (!channel || !email) {
    return res.status(400).json({ error: "Missing data" });
  }

  const { error } = await supabase
    .from("channels")
    .insert([{ channel, email, discord }]);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ success: true });
});

// =============================
// 📌 GET ALL CHANNELS (ADMIN)
// =============================
app.get("/api/channels", async (req, res) => {
  const { data, error } = await supabase
    .from("channels")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

// =============================
// ✅ APPROVE CHANNEL
// =============================
app.post("/api/channels/approve", async (req, res) => {
  const { id } = req.body;

  const { error } = await supabase
    .from("channels")
    .update({ status: "approved" })
    .eq("id", id);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ success: true });
});

// =============================
// ❌ REJECT CHANNEL
// =============================
app.post("/api/channels/reject", async (req, res) => {
  const { id } = req.body;

  const { error } = await supabase
    .from("channels")
    .update({ status: "rejected" })
    .eq("id", id);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

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
