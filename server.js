require("dotenv").config();
const express = require("express");
const session = require("express-session");
const SQLiteStore = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET;

if (!ADMIN_USERNAME || !ADMIN_PASSWORD || !SESSION_SECRET) {
  console.error("Missing ADMIN_USERNAME, ADMIN_PASSWORD, or SESSION_SECRET in environment.");
  process.exit(1);
}
if (ADMIN_PASSWORD.length < 12 || SESSION_SECRET.length < 32) {
  console.error("Use an admin password of at least 12 characters and SESSION_SECRET of at least 32 characters.");
  process.exit(1);
}

const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });
const db = new SQLiteStore(path.join(dataDir, "shipments.sqlite"));
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS shipments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tracking_code TEXT NOT NULL UNIQUE,
    item TEXT NOT NULL,
    recipient TEXT NOT NULL,
    destination TEXT NOT NULL,
    status TEXT NOT NULL,
    notes TEXT DEFAULT '',
    expected_delivery TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shipment_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    note TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY(shipment_id) REFERENCES shipments(id) ON DELETE CASCADE
  );
`);

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(session({
  name: "gld_admin_session",
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 8
  }
}));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again later." }
});

const STATUSES = [
  "Shipment registered",
  "Picked up",
  "In transit",
  "Arrived at sorting facility",
  "Customs clearance",
  "Out for delivery",
  "Delivered",
  "Delivery exception"
];

const now = () => new Date().toISOString();
const clean = (v, max = 500) => String(v ?? "").trim().slice(0, max);
const isValidStatus = (s) => STATUSES.includes(s);
const makeTrackingCode = () => "GLD" + "-" + crypto.randomBytes(4).toString("hex").toUpperCase();

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.isAdmin) return res.status(401).json({ error: "Please log in as administrator." });
  next();
}

app.post("/api/admin/login", loginLimiter, async (req, res) => {
  const username = clean(req.body.username, 80);
  const password = String(req.body.password || "");
  const userOK = username === ADMIN_USERNAME;
  const passOK = await bcrypt.compare(password, await bcrypt.hash(ADMIN_PASSWORD, 10));
  if (!userOK || !passOK) return res.status(401).json({ error: "Incorrect username or password." });
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: "Could not create secure session." });
    req.session.isAdmin = true;
    req.session.username = ADMIN_USERNAME;
    res.json({ ok: true });
  });
});

app.post("/api/admin/logout", requireAdmin, (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/admin/me", requireAdmin, (req, res) => res.json({ username: req.session.username }));

app.get("/api/statuses", (req, res) => res.json({ statuses: STATUSES }));

app.get("/api/track/:code", (req, res) => {
  const code = clean(req.params.code, 40).toUpperCase();
  if (!code) return res.status(400).json({ error: "Enter a tracking code." });
  const shipment = db.prepare(`
    SELECT tracking_code, item, recipient, destination, status, notes, expected_delivery, created_at, updated_at
    FROM shipments WHERE tracking_code = ?
  `).get(code);
  if (!shipment) return res.status(404).json({ error: "We couldn't find a shipment with that tracking code. Please check it and try again." });
  const history = db.prepare(`
    SELECT status, note, created_at FROM status_history
    WHERE shipment_id = (SELECT id FROM shipments WHERE tracking_code = ?)
    ORDER BY id DESC
  `).all(code);
  res.json({ shipment, history });
});

app.get("/api/admin/shipments", requireAdmin, (req, res) => {
  const rows = db.prepare("SELECT * FROM shipments ORDER BY id DESC").all();
  res.json({ shipments: rows });
});

app.post("/api/admin/shipments", requireAdmin, (req, res) => {
  const item = clean(req.body.item, 160);
  const recipient = clean(req.body.recipient, 120);
  const destination = clean(req.body.destination, 180);
  const status = clean(req.body.status, 80);
  const notes = clean(req.body.notes, 1000);
  const expected = clean(req.body.expected_delivery, 30);
  let tracking = clean(req.body.tracking_code, 40).toUpperCase();
  if (!item || !recipient || !destination || !isValidStatus(status)) {
    return res.status(400).json({ error: "Item, recipient, destination and a valid status are required." });
  }
  if (!tracking) tracking = makeTrackingCode();
  if (!/^[A-Z0-9-]{5,40}$/.test(tracking)) return res.status(400).json({ error: "Tracking code must contain 5–40 letters, numbers or hyphens." });
  const timestamp = now();
  try {
    const result = db.prepare(`
      INSERT INTO shipments (tracking_code,item,recipient,destination,status,notes,expected_delivery,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).run(tracking,item,recipient,destination,status,notes,expected,timestamp,timestamp);
    db.prepare("INSERT INTO status_history (shipment_id,status,note,created_at) VALUES (?,?,?,?)")
      .run(result.lastInsertRowid,status,notes,timestamp);
    res.status(201).json({ ok: true, tracking_code: tracking });
  } catch (e) {
    if (String(e.message).includes("UNIQUE")) return res.status(409).json({ error: "That tracking code is already in use. Choose another." });
    res.status(500).json({ error: "Could not save shipment." });
  }
});

app.put("/api/admin/shipments/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const current = db.prepare("SELECT * FROM shipments WHERE id = ?").get(id);
  if (!current) return res.status(404).json({ error: "Shipment not found." });
  const status = clean(req.body.status, 80);
  const notes = clean(req.body.notes, 1000);
  const expected = clean(req.body.expected_delivery, 30);
  if (!isValidStatus(status)) return res.status(400).json({ error: "Choose a valid shipment status." });
  const timestamp = now();
  db.prepare("UPDATE shipments SET status=?, notes=?, expected_delivery=?, updated_at=? WHERE id=?")
    .run(status, notes, expected, timestamp, id);
  if (status !== current.status || notes !== current.notes) {
    db.prepare("INSERT INTO status_history (shipment_id,status,note,created_at) VALUES (?,?,?,?)")
      .run(id,status,notes,timestamp);
  }
  res.json({ ok: true });
});

app.delete("/api/admin/shipments/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  db.prepare("DELETE FROM status_history WHERE shipment_id=?").run(id);
  const result = db.prepare("DELETE FROM shipments WHERE id=?").run(id);
  if (!result.changes) return res.status(404).json({ error: "Shipment not found." });
  res.json({ ok: true });
});

app.use(express.static(path.join(__dirname, "public")));
app.get("/admin", (req, res) => res.sendFile(path.join(__dirname, "public", "admin.html")));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => console.log(`Global Logistics Delivery Company running on port ${PORT}`));
