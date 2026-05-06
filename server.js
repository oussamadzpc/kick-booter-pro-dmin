// 🔥 FINAL SECURE CHANNEL SYSTEM (PRO VERSION)

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
// 🌍 TRACK VISITORS (NEW 🔥)
// =============================
app.post("/api/track", async (req, res) => {
  try {
    // 🧠 جلب IP الحقيقي
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket.remoteAddress ||
      "unknown";

    // 🌍 جلب الدولة
    let country = "Unknown";

    try {
      const response = await fetch("https://ipapi.co/json/");
      const data = await response.json();
      country = data.country_name || "Unknown";
    } catch (e) {
      console.log("Country fetch failed");
    }

    // 🚫 منع السبام (نفس IP خلال 10 ثواني)
    const { data: recent } = await supabase
      .from("visitors")
      .select("id")
      .eq("ip", ip)
      .gte("created_at", new Date(Date.now() - 10000).toISOString())
      .limit(1);

    if (recent && recent.length > 0) {
      return res.json({ skipped: true });
    }

    // 💾 تسجيل الزائر
    const { error } = await supabase.from("visitors").insert([
      {
        ip,
        country
      }
    ]);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.json({ success: false });
  }
});

// =============================
// 📌 REGISTER CHANNEL
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
      .insert([{
        channel,
        email,
        discord,
        status: "pending",
        hidden: false
      }]);

    if (error) throw error;

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// =============================
// 📌 GET CHANNELS (FILTER HIDDEN)
// =============================
app.get("/api/channels", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("channels")
      .select("*")
      .eq("hidden", false)
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
// 🗑️ HIDE CHANNEL
// =============================
app.post("/api/channels/hide", async (req, res) => {
  try {
    const { id } = req.body;

    const { error } = await supabase
      .from("channels")
      .update({ hidden: true })
      .eq("id", id);

    if (error) throw error;

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// =============================
// 🔍 CHECK STATUS
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
