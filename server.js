const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const DB_FILE = path.join(ROOT, "data", "db.json");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "JDADMIN2026";
const VIP_CODE = process.env.VIP_CODE || "JDVIP2026";
const PAYMENT_CONFIG = {
  mbway: process.env.MBWAY || "+351 929 298 302",
  whatsapp: process.env.WHATSAPP || "244955523337",
  iban: process.env.IBAN || "PT50 0007 0000 0085 3052 8242 3",
  holder: process.env.ACCOUNT_HOLDER || "JD-Tips",
};
const sessions = new Map();

const EMPTY_DB = {
  followers: [],
  tips: [],
  paymentRequests: [],
  history: [],
  analytics: {
    visits: [],
  },
  wallet: 0,
};

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

function readDb() {
  if (!fs.existsSync(path.dirname(DB_FILE))) {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    writeDb(EMPTY_DB);
  }
  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  db.followers = Array.isArray(db.followers) ? db.followers : [];
  db.tips = Array.isArray(db.tips) ? db.tips.map(normalizeTip) : [];
  db.paymentRequests = Array.isArray(db.paymentRequests) ? db.paymentRequests : [];
  db.history = Array.isArray(db.history) ? db.history : [];
  db.analytics = db.analytics && typeof db.analytics === "object" ? db.analytics : { visits: [] };
  db.analytics.visits = Array.isArray(db.analytics.visits) ? db.analytics.visits : [];
  db.wallet = Number(db.wallet || 0);
  return db;
}

function writeDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function sendJson(res, status, data, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers });
  res.end(JSON.stringify(data));
}

function parseCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

function isAdmin(req) {
  const sessionId = parseCookies(req).jd_admin_session;
  return Boolean(sessionId && sessions.has(sessionId));
}

function requireAdmin(req, res) {
  if (isAdmin(req)) return true;
  sendJson(res, 401, { error: "Acesso admin necessario." });
  return false;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Pedido demasiado grande."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("JSON invalido."));
      }
    });
  });
}

function safeStaticPath(urlPath) {
  const cleanPath = decodeURIComponent(urlPath === "/" ? "/index.html" : urlPath);
  const filePath = path.join(ROOT, cleanPath);
  if (!filePath.startsWith(ROOT)) return null;
  return filePath;
}

function splitMatch(match) {
  const parts = String(match || "").split(/\s+vs\s+/i);
  return {
    homeTeam: parts[0]?.trim() || String(match || "Equipa casa").trim(),
    awayTeam: parts[1]?.trim() || "Equipa visitante",
  };
}

function normalizeTip(tip) {
  const teams = splitMatch(tip.match);
  const homeTeam = String(tip.homeTeam || teams.homeTeam).trim();
  const awayTeam = String(tip.awayTeam || teams.awayTeam).trim();
  return {
    id: tip.id || crypto.randomUUID(),
    homeTeam,
    awayTeam,
    match: String(tip.match || `${homeTeam} vs ${awayTeam}`).trim(),
    startTime: tip.startTime || new Date().toISOString(),
    market: String(tip.market || "").trim(),
    odd: Number(tip.odd || 1).toFixed(2),
    access: tip.access === "vip" ? "vip" : "free",
    confidence: tip.confidence || (tip.access === "vip" ? "Alta" : "Media"),
    status: ["active", "green", "red"].includes(tip.status) ? tip.status : "active",
    resultAmount: tip.resultAmount === null || tip.resultAmount === undefined ? null : Number(tip.resultAmount),
    createdAt: tip.createdAt || new Date().toISOString(),
    settledAt: tip.settledAt || null,
  };
}

function buildTip(body, existing = {}) {
  const homeTeam = String(body.homeTeam || splitMatch(body.match).homeTeam || existing.homeTeam || "").trim();
  const awayTeam = String(body.awayTeam || splitMatch(body.match).awayTeam || existing.awayTeam || "").trim();
  return normalizeTip({
    ...existing,
    homeTeam,
    awayTeam,
    match: `${homeTeam} vs ${awayTeam}`,
    startTime: body.startTime || existing.startTime || new Date().toISOString(),
    market: String(body.market || existing.market || "").trim(),
    odd: Number(body.odd || existing.odd || 1).toFixed(2),
    access: body.access === "vip" ? "vip" : "free",
    confidence: body.access === "vip" ? "Alta" : "Media",
    status: existing.status || "active",
  });
}

function getPerformance(db) {
  const resultsById = new Map();
  db.history.forEach((item) => {
    if (item.status === "green" || item.status === "red") {
      resultsById.set(item.id || crypto.randomUUID(), item);
    }
  });
  db.tips
    .filter((tip) => tip.status === "green" || tip.status === "red")
    .forEach((tip) => resultsById.set(tip.id, tip));
  const results = Array.from(resultsById.values());
  const greens = results.filter((item) => item.status === "green").length;
  const reds = results.filter((item) => item.status === "red").length;
  const total = greens + reds;
  return {
    greens,
    reds,
    total,
    accuracy: total ? Math.round((greens / total) * 100) : 0,
  };
}

function getAnalyticsSummary(db) {
  const visits = db.analytics.visits;
  const todayKey = new Date().toISOString().slice(0, 10);
  const today = visits.filter((visit) => String(visit.createdAt || "").slice(0, 10) === todayKey);
  const mobile = visits.filter((visit) => visit.device === "mobile").length;
  const desktop = visits.filter((visit) => visit.device === "desktop").length;
  const lastVisit = visits[0]?.createdAt || null;
  return {
    total: visits.length,
    today: today.length,
    mobile,
    desktop,
    lastVisit,
  };
}

async function handleApi(req, res, url) {
  try {
    if (req.method === "GET" && url.pathname === "/api/config") {
      return sendJson(res, 200, PAYMENT_CONFIG);
    }

    if (req.method === "GET" && url.pathname === "/api/admin/me") {
      return sendJson(res, 200, { admin: isAdmin(req) });
    }

    if (req.method === "POST" && url.pathname === "/api/admin/login") {
      const body = await readBody(req);
      if (body.password !== ADMIN_PASSWORD) {
        return sendJson(res, 401, { error: "Palavra-passe incorreta." });
      }
      const sessionId = crypto.randomUUID();
      sessions.set(sessionId, { createdAt: Date.now() });
      return sendJson(res, 200, { ok: true }, {
        "Set-Cookie": `jd_admin_session=${encodeURIComponent(sessionId)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`,
      });
    }

    if (req.method === "POST" && url.pathname === "/api/admin/logout") {
      const sessionId = parseCookies(req).jd_admin_session;
      if (sessionId) sessions.delete(sessionId);
      return sendJson(res, 200, { ok: true }, {
        "Set-Cookie": "jd_admin_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
      });
    }

    if (req.method === "GET" && url.pathname === "/api/admin/vip-code") {
      if (!requireAdmin(req, res)) return;
      return sendJson(res, 200, { vipCode: VIP_CODE });
    }

    if (req.method === "GET" && url.pathname === "/api/tips") {
      return sendJson(res, 200, readDb().tips);
    }

    if (req.method === "POST" && url.pathname === "/api/analytics/visit") {
      const body = await readBody(req);
      const db = readDb();
      const device = body.device === "desktop" ? "desktop" : "mobile";
      db.analytics.visits.unshift({
        id: crypto.randomUUID(),
        device,
        path: String(body.path || "/").slice(0, 160),
        createdAt: new Date().toISOString(),
      });
      db.analytics.visits = db.analytics.visits.slice(0, 5000);
      writeDb(db);
      return sendJson(res, 201, { ok: true });
    }

    if (req.method === "GET" && url.pathname === "/api/analytics") {
      if (!requireAdmin(req, res)) return;
      return sendJson(res, 200, getAnalyticsSummary(readDb()));
    }

    if (req.method === "GET" && url.pathname === "/api/followers") {
      return sendJson(res, 200, { count: readDb().followers.length });
    }

    if (req.method === "POST" && url.pathname === "/api/followers") {
      const body = await readBody(req);
      const db = readDb();
      const followerId = String(body.followerId || crypto.randomUUID()).trim();
      if (!db.followers.some((follower) => follower.id === followerId)) {
        db.followers.push({
          id: followerId,
          createdAt: new Date().toISOString(),
        });
        writeDb(db);
      }
      return sendJson(res, 201, { followerId, count: db.followers.length });
    }

    if (req.method === "POST" && url.pathname === "/api/tips") {
      if (!requireAdmin(req, res)) return;
      const body = await readBody(req);
      const db = readDb();
      const tip = buildTip(body, {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      });
      db.tips.unshift(tip);
      writeDb(db);
      return sendJson(res, 201, tip);
    }

    const tipMatch = url.pathname.match(/^\/api\/tips\/([^/]+)$/);
    if (tipMatch && req.method === "PUT") {
      if (!requireAdmin(req, res)) return;
      const body = await readBody(req);
      const db = readDb();
      const index = db.tips.findIndex((tip) => tip.id === tipMatch[1]);
      if (index === -1) return sendJson(res, 404, { error: "Palpite nao encontrado." });
      db.tips[index] = buildTip(body, db.tips[index]);
      writeDb(db);
      return sendJson(res, 200, db.tips[index]);
    }

    const tipResultMatch = url.pathname.match(/^\/api\/tips\/([^/]+)\/result$/);
    if (tipResultMatch && req.method === "PATCH") {
      if (!requireAdmin(req, res)) return;
      const body = await readBody(req);
      const db = readDb();
      const tip = db.tips.find((item) => item.id === tipResultMatch[1]);
      if (!tip) return sendJson(res, 404, { error: "Palpite nao encontrado." });
      const previousAmount = Number(tip.resultAmount || 0);
      const nextAmount = body.amount === "" || body.amount === null || body.amount === undefined ? null : Number(body.amount || 0);
      tip.status = body.status === "red" ? "red" : "green";
      tip.resultAmount = Number.isFinite(nextAmount) ? nextAmount : null;
      tip.settledAt = new Date().toISOString();
      db.wallet = Number(db.wallet || 0) - previousAmount + Number(tip.resultAmount || 0);
      db.history = db.tips
        .filter((item) => item.status === "green" || item.status === "red")
        .map((item) => ({
          id: item.id,
          amount: Number(item.resultAmount || 0),
          status: item.status,
          match: item.match,
          date: item.settledAt
            ? new Date(item.settledAt).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" })
            : new Date().toLocaleDateString("pt-PT"),
        }));
      writeDb(db);
      return sendJson(res, 200, tip);
    }

    if (tipMatch && req.method === "DELETE") {
      if (!requireAdmin(req, res)) return;
      const db = readDb();
      db.tips = db.tips.filter((tip) => tip.id !== tipMatch[1]);
      writeDb(db);
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "GET" && url.pathname === "/api/payment-requests") {
      if (!requireAdmin(req, res)) return;
      return sendJson(res, 200, readDb().paymentRequests);
    }

    if (req.method === "POST" && url.pathname === "/api/payment-requests") {
      const body = await readBody(req);
      const db = readDb();
      const request = {
        id: crypto.randomUUID(),
        plan: String(body.plan || "Semanal"),
        name: String(body.name || "").trim(),
        contact: String(body.contact || "").trim(),
        method: String(body.method || "MB WAY"),
        reference: String(body.reference || "").trim(),
        status: "Pendente",
        date: new Date().toLocaleString("pt-PT"),
      };
      db.paymentRequests.unshift(request);
      writeDb(db);
      return sendJson(res, 201, request);
    }

    const paymentMatch = url.pathname.match(/^\/api\/payment-requests\/([^/]+)$/);
    if (paymentMatch && req.method === "PATCH") {
      if (!requireAdmin(req, res)) return;
      const body = await readBody(req);
      const db = readDb();
      const request = db.paymentRequests.find((item) => item.id === paymentMatch[1]);
      if (!request) return sendJson(res, 404, { error: "Pedido nao encontrado." });
      request.status = body.status === "Pago" ? "Pago" : "Pendente";
      writeDb(db);
      return sendJson(res, 200, request);
    }

    if (paymentMatch && req.method === "DELETE") {
      if (!requireAdmin(req, res)) return;
      const db = readDb();
      db.paymentRequests = db.paymentRequests.filter((item) => item.id !== paymentMatch[1]);
      writeDb(db);
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "GET" && url.pathname === "/api/stats") {
      const db = readDb();
      return sendJson(res, 200, { wallet: db.wallet || 0, history: db.history || [], performance: getPerformance(db) });
    }

    if (req.method === "POST" && url.pathname === "/api/results") {
      if (!requireAdmin(req, res)) return;
      const body = await readBody(req);
      const amount = Number(body.amount || 0);
      const db = readDb();
      db.wallet = Number(db.wallet || 0) + amount;
      db.history = db.history || [];
      db.history.unshift({
        id: crypto.randomUUID(),
        amount,
        date: new Date().toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" }),
      });
      writeDb(db);
      return sendJson(res, 201, { wallet: db.wallet, history: db.history });
    }

    if (req.method === "POST" && url.pathname === "/api/vip/unlock") {
      const body = await readBody(req);
      if (body.code !== VIP_CODE) return sendJson(res, 401, { error: "Codigo VIP invalido." });
      return sendJson(res, 200, { ok: true });
    }

    return sendJson(res, 404, { error: "API nao encontrada." });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "Erro interno." });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith("/api/")) {
    await handleApi(req, res, url);
    return;
  }

  const filePath = safeStaticPath(url.pathname);
  if (!filePath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`JD-Tips backend ativo em http://localhost:${PORT}`);
});
