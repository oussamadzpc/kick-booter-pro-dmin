// 🔥 FINAL SECURE CHANNEL SYSTEM (FULL VERSION)

const express = require("express");
const cors = require("cors");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;

// 🔐 ENV VARIABLES
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

// 🔗 Connect Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// =============================
// 🧱 MIDDLEWARES
// =============================
app.use(cors());
app.use(express.json());

// =============================
// 🔐 ADMIN PROTECTION
// =============================
app.use("/admin", (req, res, next) => {
  const key = req.query.key;

  if (!key || key !== ADMIN_SECRET) {
    return res.status(403).send("Access Denied");
  }

  next();
});

// =============================
// 🌐 STATIC FILES
// =============================
app.use(express.static(path.join(__dirname, "public")));

// =============================
// 📌 REGISTER CHANNEL (FIXED)
// =============================
app.post("/api/channels/register", async (req, res) => {
  try {
    const { channel, email, discord } = req.body;

    if (!channel || !email) {
      return res.status(400).json({ error: "Missing data" });
    }

    // 🔥 منع التكرار
    const { data: existing } = await supabase
      .from("channels")
      .select("id")
      .or(`email.eq.${email},channel.eq.${channel}`)
      .maybeSingle();

    if (existing) {
      return res.json({ error: "already_exists" });
    }

    const { error } = await supabase
      .from("channels")
      .insert([{ channel, email, discord, status: "pending" }]);

    if (error) throw error;

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// =============================
// 📌 GET ALL CHANNELS (ADMIN)
// =============================
app.get("/api/channels", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("channels")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// =============================
// ✅ APPROVE CHANNEL
// =============================
app.post("/api/channels/approve", async (req, res) => {
  try {
    const { id } = req.body;

    const { error } = await supabase
      .from("channels")
      .update({ status: "approved" })
      .eq("id", id);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// =============================
// ❌ REJECT CHANNEL
// =============================
app.post("/api/channels/reject", async (req, res) => {
  try {
    const { id } = req.body;

    const { error } = await supabase
      .from("channels")
      .update({ status: "rejected" })
      .eq("id", id);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// =============================
// 🔍 CHECK STATUS (FIXED)
// =============================
app.post("/api/channels/status", async (req, res) => {
  try {
    const { email } = req.body;

    const { data, error } = await supabase
      .from("channels")
      .select("status")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return res.json({ status: "error" });
    }

    if (!data) {
      return res.json({ status: "not_found" });
    }

    res.json({ status: data.status });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// =============================
// 🌐 ADMIN PAGE
// =============================
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// =============================
// 🚀 START SERVER
// =============================
app.listen(PORT, () => {
  console.log("🔥 Server running on port " + PORT);
});
