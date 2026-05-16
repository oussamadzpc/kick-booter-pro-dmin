// ============================================================
// KICK BOOSTER PRO — WEB SERVER (Registration + Admin + Stats)
// ============================================================

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3000;

// ===== ENV VARIABLES =====
const SUPABASE_URL = process.env.SUPABASE_URL || "https://xqwzguqbqiwaduraasjn.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const ADMIN_SECRET = process.env.ADMIN_SECRET || process.env.ADMIN_KEY || "2107";

if (!SUPABASE_KEY) {
  console.error("FATAL: SUPABASE_KEY is required");
  process.exit(1);
}

// ===== SUPABASE REST HELPERS =====
function getHeaders() {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation"
  };
}

async function supabaseGet(table, query = "") {
  const url = `${SUPABASE_URL}/rest/v1/${table}${query ? "?" + query : ""}`;
  const r = await fetch(url, { headers: getHeaders() });
  if (!r.ok) throw new Error(`Supabase GET error: ${r.status}`);
  return r.json();
}

async function supabasePost(table, data) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST", headers: getHeaders(), body: JSON.stringify(data)
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message || `Supabase POST error: ${r.status}`);
  }
  return r.json();
}

async function supabasePatch(table, query, data) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: "PATCH", headers: getHeaders(), body: JSON.stringify(data)
  });
  if (!r.ok) throw new Error(`Supabase PATCH error: ${r.status}`);
  return r.json();
}

// ===== RATE LIMITING =====
const rateLimits = new Map();
const RATE_LIMIT_WINDOW = 60000;
const RATE_LIMIT_MAX = 500;
const MAX_RATE_LIMIT_ENTRIES = 10000;

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimits.get(ip);
  if (!record || now - record.resetTime > RATE_LIMIT_WINDOW) {
    rateLimits.set(ip, { count: 1, resetTime: now });
    return true;
  }
  if (record.count >= RATE_LIMIT_MAX) return false;
  record.count++;
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimits) {
    if (now - record.resetTime > RATE_LIMIT_WINDOW * 2) rateLimits.delete(ip);
  }
  if (rateLimits.size > MAX_RATE_LIMIT_ENTRIES) {
    const sorted = [...rateLimits.entries()].sort((a, b) => a[1].resetTime - b[1].resetTime);
    sorted.slice(0, sorted.length - MAX_RATE_LIMIT_ENTRIES).forEach(([ip]) => rateLimits.delete(ip));
  }
}, 300000);

app.use((req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress || "unknown";
  if (!checkRateLimit(ip)) return res.status(429).json({ error: "Rate limit exceeded" });
  next();
});

// ===== STATIC FILES (public first, then root fallback) =====
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname), { index: false, dotfiles: "ignore" }));

// ===== ROOT & ADMIN PAGES =====
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

// ===== MIDDLEWARE: ADMIN AUTH =====
function adminAuth(req, res, next) {
  const key = req.headers["x-admin-key"] || req.query.key || req.body.key;
  if (!key || key !== ADMIN_SECRET) {
    return res.status(403).json({ ok: false, error: "Access denied" });
  }
  next();
}

// ===== PUBLIC: REGISTER CHANNEL =====
app.post("/api/channels/register", async (req, res) => {
  try {
    const { channel, email, discord } = req.body;
    if (!channel || !email) return res.status(400).json({ ok: false, error: "Missing required fields" });

    const existing = await supabaseGet("channels", `or=(email.eq.${email},channel.eq.${channel})&limit=1`);
    if (existing && existing.length > 0) {
      return res.status(409).json({ ok: false, error: "already_exists" });
    }

    const data = await supabasePost("channels", {
      channel: String(channel).trim().toLowerCase(),
      email: String(email).trim().toLowerCase(),
      discord: discord || "",
      status: "pending",
      hidden: false,
      created_at: new Date().toISOString()
    });

    res.json({ ok: true, id: data?.[0]?.id });
  } catch (err) {
    console.error("Register error:", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ===== PUBLIC: CHECK STATUS =====
app.post("/api/channels/status", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ status: "error" });

    const data = await supabaseGet("channels", `email=eq.${email}&order=created_at.desc&limit=1`);
    if (!data || !data.length) return res.json({ status: "not_found" });

    const c = data[0];
    res.json({
      status: c.status,
      channel: c.channel,
      approved: c.status === "approved",
      rejected: c.status === "rejected"
    });
  } catch (err) {
    res.json({ status: "error" });
  }
});

// ===== PUBLIC: GET ALL CHANNELS =====
app.get("/api/channels", async (req, res) => {
  try {
    const data = await supabaseGet("channels", "hidden=eq.false&order=created_at.desc");
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== ADMIN: VERIFY =====
app.post("/admin/verify", (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_SECRET) {
    return res.json({ ok: true, valid: true });
  }
  return res.status(403).json({ ok: false, valid: false });
});

// ===== ADMIN: APPROVE =====
app.post("/api/channels/approve", adminAuth, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ ok: false });
    await supabasePatch("channels", `id=eq.${id}`, { status: "approved" });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ===== ADMIN: REJECT =====
app.post("/api/channels/reject", adminAuth, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ ok: false });
    await supabasePatch("channels", `id=eq.${id}`, { status: "rejected" });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ===== ADMIN: HIDE =====
app.post("/api/channels/hide", adminAuth, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ ok: false });
    await supabasePatch("channels", `id=eq.${id}`, { hidden: true, status: "rejected" });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ===== ADMIN: BULK APPROVE =====
app.post("/api/channels/bulk-approve", adminAuth, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ ok: false });
    for (const id of ids) {
      await supabasePatch("channels", `id=eq.${id}`, { status: "approved" });
    }
    res.json({ ok: true, count: ids.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ===== ADMIN: BULK REJECT =====
app.post("/api/channels/bulk-reject", adminAuth, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ ok: false });
    for (const id of ids) {
      await supabasePatch("channels", `id=eq.${id}`, { status: "rejected" });
    }
    res.json({ ok: true, count: ids.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ===== VISITOR TRACKING =====
app.post("/api/track", async (req, res) => {
  try {
    const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress || "unknown";
    let country = "Unknown";
    try {
      const geo = await fetch(`https://ipapi.co/${ip}/json/`).then(r => r.json());
      country = geo.country_name || "Unknown";
    } catch (e) { /* ignore */ }

    const recent = await supabaseGet("visitors", `ip=eq.${ip}&created_at=gte.${new Date(Date.now() - 10000).toISOString()}&limit=1`);
    if (recent && recent.length > 0) return res.json({ skipped: true });

    await supabasePost("visitors", { ip, country, created_at: new Date().toISOString() });
    res.json({ success: true });
  } catch (err) {
    console.error("Track error:", err.message);
    res.json({ success: false });
  }
});

// ===== GET VISITORS =====
app.get("/api/visitors", async (req, res) => {
  try {
    const data = await supabaseGet("visitors", "order=created_at.desc&limit=1000");
    res.json(data || []);
  } catch (err) {
    res.json([]);
  }
});

// ===== STATS =====
app.get("/api/stats", async (req, res) => {
  try {
    const [channels, visitors] = await Promise.all([
      supabaseGet("channels", "select=*"),
      supabaseGet("visitors", "select=*")
    ]);

    const approved = (channels || []).filter(c => c.status === "approved" && !c.hidden).length;
    const pending = (channels || []).filter(c => c.status === "pending" && !c.hidden).length;
    const rejected = (channels || []).filter(c => c.status === "rejected" || c.hidden).length;
    const total = (channels || []).length;

    const countries = {};
    (visitors || []).forEach(v => { countries[v.country] = (countries[v.country] || 0) + 1; });
    let topCountry = "-";
    let maxCount = 0;
    for (const c in countries) { if (countries[c] > maxCount) { maxCount = countries[c]; topCountry = c; } }

    res.json({
      total, approved, pending, rejected,
      visitors: (visitors || []).length,
      topCountry,
      countries
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== HEALTH CHECK =====
app.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString(), uptime: process.uptime() });
});

// ===== 404 =====
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ===== START =====
app.listen(PORT, () => {
  console.log("Kick Booster Pro Web Server running on port " + PORT);
  console.log("Features: Registration | Admin Panel | Visitor Tracking | Stats | Rate Limiting");
});
