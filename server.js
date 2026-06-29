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
