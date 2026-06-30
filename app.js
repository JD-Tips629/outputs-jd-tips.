const state = {
  tips: [],
  vip: localStorage.getItem("jdTips.vip") === "true",
  filter: "all",
  wallet: 0,
  history: [],
  performance: {
    greens: 0,
    reds: 0,
    total: 0,
    accuracy: 0,
  },
  analytics: {
    total: 0,
    today: 0,
    mobile: 0,
    desktop: 0,
    lastVisit: null,
  },
  paymentRequests: [],
  admin: false,
  paymentConfig: {
    mbway: "+351 929 298 302",
    whatsapp: "244955523337",
    iban: "PT50 0007 0000 0085 3052 8242 3",
    holder: "JD-Tips",
  },
};

const sections = document.querySelectorAll(".section");
const navButtons = document.querySelectorAll(".nav-item");
const tipsGrid = document.querySelector("#tipsGrid");
const toast = document.querySelector("#toast");
const membershipLabel = document.querySelector("#membershipLabel");
const membershipText = document.querySelector("#membershipText");
const quickVipBtn = document.querySelector("#quickVipBtn");
const todayCount = document.querySelector("#todayCount");
const profitMetric = document.querySelector("#profitMetric");
const accuracyMetric = document.querySelector("#accuracyMetric");
const greenMetric = document.querySelector("#greenMetric");
const quickWhatsappLink = document.querySelector("#quickWhatsappLink");
const walletTotal = document.querySelector("#walletTotal");
const historyList = document.querySelector("#historyList");
const mbwayNumber = document.querySelector("#mbwayNumber");
const ibanNumber = document.querySelector("#ibanNumber");
const accountHolder = document.querySelector("#accountHolder");
const adminPayments = document.querySelector("#adminPayments");
const adminResults = document.querySelector("#adminResults");
const adminPendingCount = document.querySelector("#adminPendingCount");
const adminProfitTotal = document.querySelector("#adminProfitTotal");
const adminVisitTotal = document.querySelector("#adminVisitTotal");
const adminVisitToday = document.querySelector("#adminVisitToday");
const adminVisitMobile = document.querySelector("#adminVisitMobile");
const adminVisitDesktop = document.querySelector("#adminVisitDesktop");
const adminLastVisit = document.querySelector("#adminLastVisit");
const tipForm = document.querySelector("#tipForm");
const tipFormTitle = document.querySelector("#tipFormTitle");
const tipFormHint = document.querySelector("#tipFormHint");
const tipSubmitBtn = document.querySelector("#tipSubmitBtn");
const cancelEditBtn = document.querySelector("#cancelEditBtn");
const editingTipId = document.querySelector("#editingTipId");
const brandAccess = document.querySelector("#brandAccess");
const adminLogin = document.querySelector("#adminLogin");
const adminLoginForm = document.querySelector("#adminLoginForm");
const adminPasswordInput = document.querySelector("#adminPasswordInput");
const closeAdminLoginBtn = document.querySelector("#closeAdminLoginBtn");
const adminLogoutBtn = document.querySelector("#adminLogoutBtn");
const resultsHistoryList = document.querySelector("#resultsHistoryList");
let brandTapCount = 0;
let brandTapTimer;

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(data.error || "Erro no servidor");
  return data;
}

function money(value) {
  return `${Number(value || 0).toLocaleString("pt-PT")} \u20ac`;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("pt-PT");
}

function formatDateTime(value) {
  if (!value) return "sem registo";
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatStart(value) {
  if (!value) return "Horario a confirmar";
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function toDateInputValue(value) {
  const date = value ? new Date(value) : new Date();
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}

function getActiveTips() {
  return state.tips
    .filter((tip) => tip.status === "active")
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
}

function getResultTips() {
  return state.tips
    .filter((tip) => tip.status === "green" || tip.status === "red")
    .sort((a, b) => new Date(b.settledAt || b.createdAt) - new Date(a.settledAt || a.createdAt));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2600);
}

function setSection(sectionId) {
  if (sectionId === "admin" && !state.admin) {
    openAdminLogin();
    return;
  }
  sections.forEach((section) => section.classList.toggle("active", section.id === sectionId));
  navButtons.forEach((button) => button.classList.toggle("active", button.dataset.section === sectionId));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openAdminLogin() {
  adminLogin.classList.remove("hidden");
  adminPasswordInput.focus();
}

function closeAdminLogin() {
  adminLogin.classList.add("hidden");
  adminPasswordInput.value = "";
}

function renderAdminAccess() {
  document.querySelectorAll(".admin-only").forEach((element) => {
    element.classList.toggle("hidden", !state.admin);
  });
  if (!state.admin && document.querySelector("#admin").classList.contains("active")) {
    setSection("dashboard");
  }
}

function updateMembership() {
  membershipLabel.textContent = state.vip ? "VIP ativo" : "Free";
  membershipText.textContent = state.vip
    ? "Tens acesso a todos os palpites premium."
    : "Ativa o VIP para ver palpites premium.";
  quickVipBtn.textContent = state.vip ? "VIP desbloqueado" : "Entrar no VIP";
  document.querySelector("#openVipBtn").textContent = state.vip ? "VIP ativo" : "Assinar VIP";
}

function tipCard(tip) {
  const isLocked = tip.access === "vip" && !state.vip;
  const market = isLocked ? "Palpite VIP bloqueado" : tip.market;
  const odd = isLocked ? "--" : tip.odd;
  const statusLabel = tip.status === "active" ? "Ativo" : tip.status.toUpperCase();
  const button = isLocked
    ? `<button class="primary unlock" data-section-target="vip" type="button">Desbloquear VIP</button>`
    : "";
  const adminActions =
    state.admin && tip.status === "active"
      ? `<div class="result-actions">
          <input class="result-amount" data-tip-id="${tip.id}" type="number" min="0" step="0.01" placeholder="Valor opcional \u20ac" />
          <button class="primary mark-result" data-tip-id="${tip.id}" data-result="green" type="button">Green</button>
          <button class="danger mark-result" data-tip-id="${tip.id}" data-result="red" type="button">Red</button>
        </div>`
      : "";
  const editActions = state.admin
    ? `<div class="tip-actions">
        <button class="ghost edit-tip" data-tip-id="${tip.id}" type="button">Editar</button>
        <button class="danger delete-tip" data-tip-id="${tip.id}" type="button">Apagar</button>
      </div>`
    : "";

  return `
    <article class="tips-card ${isLocked ? "locked" : ""}">
      <small>${tip.access.toUpperCase()} | ${formatStart(tip.startTime)} | ${statusLabel}</small>
      <h3>${tip.homeTeam || tip.match} vs ${tip.awayTeam || ""}</h3>
      <div class="pick ${isLocked ? "blurred" : ""}">${market}</div>
      <div class="meta">
        <span>Odd</span>
        <strong>${odd}</strong>
      </div>
      ${tip.status !== "active" ? `<span class="status-badge ${tip.status}">${tip.status.toUpperCase()}</span>` : ""}
      ${tip.resultAmount ? `<p class="result-money">Resultado: + ${money(tip.resultAmount)}</p>` : ""}
      ${button}
      ${adminActions}
      ${editActions}
    </article>
  `;
}

function renderTips() {
  const visibleTips = state.tips.filter((tip) => state.filter === "all" || tip.access === state.filter);
  tipsGrid.innerHTML = visibleTips.length
    ? visibleTips.map(tipCard).join("")
    : `<article class="tips-card"><h3>Nenhum palpite publicado ainda.</h3><p>Quando o admin publicar, aparece aqui.</p></article>`;
  if (todayCount) todayCount.textContent = String(getActiveTips().length);
}

function compactTip(tip) {
  return `
    <div class="feed-item">
      <div>
        <strong>${tip.match}</strong>
        <p>${formatStart(tip.startTime)} | ${tip.market} | Odd ${tip.odd}</p>
      </div>
      <span class="status-badge ${tip.status}">${tip.status === "active" ? tip.access.toUpperCase() : tip.status.toUpperCase()}</span>
    </div>
  `;
}

function resultTip(tip) {
  const amount = tip.resultAmount ? ` | + ${money(tip.resultAmount)}` : "";
  return `
    <div class="feed-item">
      <div>
        <strong>${tip.match}</strong>
        <p>${tip.market} | Odd ${tip.odd}${amount}</p>
      </div>
      <span class="status-badge ${tip.status}">${tip.status.toUpperCase()}</span>
    </div>
  `;
}

function renderSocialFeed() {
  const results = getResultTips();
  resultsHistoryList.innerHTML = results.length
    ? results.map(resultTip).join("")
    : `<div class="feed-item"><p>Nenhum resultado marcado ainda.</p></div>`;
}

function resetTipForm() {
  editingTipId.value = "";
  tipFormTitle.textContent = "Novo palpite";
  tipFormHint.textContent = "Guardado no servidor";
  tipSubmitBtn.textContent = "Publicar";
  cancelEditBtn.classList.add("hidden");
  tipForm.reset();
}

function startTipEdit(tipId) {
  const tip = state.tips.find((item) => item.id === tipId);
  if (!tip) return;
  editingTipId.value = tip.id;
  document.querySelector("#homeTeamInput").value = tip.homeTeam || tip.match.split(" vs ")[0] || "";
  document.querySelector("#awayTeamInput").value = tip.awayTeam || tip.match.split(" vs ")[1] || "";
  document.querySelector("#startTimeInput").value = toDateInputValue(tip.startTime);
  document.querySelector("#marketInput").value = tip.market;
  document.querySelector("#oddInput").value = tip.odd;
  document.querySelector("#accessInput").value = tip.access;
  tipFormTitle.textContent = "Editar palpite";
  tipFormHint.textContent = "Guarda as alteracoes ou cancela a edicao";
  tipSubmitBtn.textContent = "Guardar alteracoes";
  cancelEditBtn.classList.remove("hidden");
  setSection("tips");
  tipForm.scrollIntoView({ behavior: "smooth", block: "center" });
}

function renderWallet() {
  if (profitMetric) profitMetric.textContent = formatNumber(state.performance.reds);
  walletTotal.textContent = money(state.wallet);
  historyList.innerHTML =
    getResultTips().length === 0
      ? `<li><span>Nenhum resultado registado ainda</span><strong>0 \u20ac</strong></li>`
      : getResultTips()
          .map((tip) => {
            const amount = tip.resultAmount ? `+ ${money(tip.resultAmount)}` : "Sem valor";
            return `<li><span>${tip.match} | ${tip.status.toUpperCase()}</span><strong>${amount}</strong></li>`;
          })
          .join("");
}

function renderPerformanceStats() {
  const fallbackResults = getResultTips();
  const fallbackGreens = fallbackResults.filter((tip) => tip.status === "green").length;
  const fallbackReds = fallbackResults.filter((tip) => tip.status === "red").length;
  const greens = state.performance.greens || fallbackGreens;
  const reds = state.performance.reds || fallbackReds;
  const total = state.performance.total || greens + reds;
  const accuracy = total ? Math.round((greens / total) * 100) : 0;

  if (accuracyMetric) accuracyMetric.textContent = `${accuracy}%`;
  if (greenMetric) greenMetric.textContent = formatNumber(greens);
  if (profitMetric) profitMetric.textContent = formatNumber(reds);
}

function renderWhatsappLink() {
  if (!quickWhatsappLink) return;
  const message = "Ola JD-Tips, quero saber mais sobre os palpites VIP.";
  quickWhatsappLink.href = `https://wa.me/${state.paymentConfig.whatsapp}?text=${encodeURIComponent(message)}`;
}

function renderAdmin() {
  const pending = state.paymentRequests.filter((request) => request.status !== "Pago");
  adminPendingCount.textContent = `${pending.length} pendentes`;
  adminProfitTotal.textContent = money(state.wallet);
  if (adminVisitTotal) adminVisitTotal.textContent = formatNumber(state.analytics.total);
  if (adminVisitToday) adminVisitToday.textContent = formatNumber(state.analytics.today);
  if (adminVisitMobile) adminVisitMobile.textContent = formatNumber(state.analytics.mobile);
  if (adminVisitDesktop) adminVisitDesktop.textContent = formatNumber(state.analytics.desktop);
  if (adminLastVisit) adminLastVisit.textContent = `Ultima visita: ${formatDateTime(state.analytics.lastVisit)}`;

  adminPayments.innerHTML =
    state.paymentRequests.length === 0
      ? `<div class="admin-item"><p>Nenhum pedido VIP recebido ainda.</p></div>`
      : state.paymentRequests
          .map(
            (request) => `
              <div class="admin-item">
                <strong>${request.name} - ${request.plan}</strong>
                <p>${request.method} | ${request.contact} | Ref: ${request.reference}</p>
                <p>${request.date} | Estado: ${request.status || "Pendente"}</p>
                <div class="admin-actions">
                  <button class="primary mark-paid" data-request-id="${request.id}" type="button">Marcar pago</button>
                  <button class="ghost copy-vip-code" type="button">Copiar codigo VIP</button>
                  <button class="danger delete-request" data-request-id="${request.id}" type="button">Apagar</button>
                </div>
              </div>
            `
          )
          .join("");

  adminResults.innerHTML =
    getResultTips().length === 0
      ? `<div class="admin-item"><p>Nenhum resultado registado ainda.</p></div>`
      : getResultTips()
          .map((tip) => `<div class="admin-item"><strong>${tip.status.toUpperCase()} - ${tip.match}</strong><p>${tip.resultAmount ? money(tip.resultAmount) : "Sem valor financeiro"}</p></div>`)
          .join("");
}

function subscribe(plan) {
  document.querySelector("#paymentPlan").value = plan;
  document.querySelector("#paymentReference").value = `JDVIP-${Date.now().toString().slice(-5)}`;
  showToast(`Plano ${plan} selecionado. Usa MB WAY ou IBAN e confirma o pagamento.`);
  setSection("vip");
  document.querySelector("#paymentPanel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderPaymentConfig() {
  mbwayNumber.textContent = state.paymentConfig.mbway;
  ibanNumber.textContent = state.paymentConfig.iban;
  accountHolder.textContent = `Titular: ${state.paymentConfig.holder}`;
}

async function recordVisit() {
  if (sessionStorage.getItem("jdTips.visitTracked") === "true") return;
  sessionStorage.setItem("jdTips.visitTracked", "true");
  const device = window.matchMedia("(max-width: 760px)").matches ? "mobile" : "desktop";
  try {
    await api("/api/analytics/visit", {
      method: "POST",
      body: JSON.stringify({ device, path: window.location.pathname || "/" }),
    });
  } catch {
    sessionStorage.removeItem("jdTips.visitTracked");
  }
}

async function loadPublicData() {
  const [config, tips, stats] = await Promise.all([
    api("/api/config"),
    api("/api/tips"),
    api("/api/stats"),
  ]);
  state.paymentConfig = config;
  state.tips = tips;
  state.wallet = stats.wallet;
  state.history = stats.history;
  state.performance = stats.performance || state.performance;
}

async function loadAdminData() {
  if (!state.admin) return;
  const [requests, analytics] = await Promise.all([
    api("/api/payment-requests"),
    api("/api/analytics"),
  ]);
  state.paymentRequests = requests;
  state.analytics = analytics;
}

async function refreshAll() {
  await loadPublicData();
  if (state.admin) await loadAdminData();
  renderPaymentConfig();
  renderWhatsappLink();
  renderTips();
  renderSocialFeed();
  renderPerformanceStats();
  renderWallet();
  renderAdmin();
}

document.addEventListener("click", async (event) => {
  const navButton = event.target.closest("[data-section]");
  const targetButton = event.target.closest("[data-section-target]");
  const subscribeButton = event.target.closest(".subscribe");

  if (navButton) setSection(navButton.dataset.section);
  if (targetButton) setSection(targetButton.dataset.sectionTarget);
  if (subscribeButton) subscribe(subscribeButton.dataset.plan);

  const copyButton = event.target.closest(".copy-btn");
  if (copyButton) {
    const target = document.querySelector(`#${copyButton.dataset.copyTarget}`);
    navigator.clipboard?.writeText(target.textContent.trim());
    showToast("Dados copiados.");
  }

  const copyVipCode = event.target.closest(".copy-vip-code");
  if (copyVipCode) {
    const data = await api("/api/admin/vip-code");
    navigator.clipboard?.writeText(data.vipCode);
    showToast("Codigo VIP copiado.");
  }

  const markPaid = event.target.closest(".mark-paid");
  if (markPaid) {
    await api(`/api/payment-requests/${markPaid.dataset.requestId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "Pago" }),
    });
    await refreshAll();
    showToast("Pagamento marcado como pago. Envia o codigo VIP ao cliente.");
  }

  const deleteRequest = event.target.closest(".delete-request");
  if (deleteRequest) {
    await api(`/api/payment-requests/${deleteRequest.dataset.requestId}`, { method: "DELETE" });
    await refreshAll();
    showToast("Pedido removido.");
  }

  const editTip = event.target.closest(".edit-tip");
  if (editTip) {
    if (!state.admin) return openAdminLogin();
    startTipEdit(editTip.dataset.tipId);
  }

  const deleteTip = event.target.closest(".delete-tip");
  if (deleteTip) {
    if (!state.admin) return openAdminLogin();
    const deleted = state.tips.find((item) => item.id === deleteTip.dataset.tipId);
    await api(`/api/tips/${deleteTip.dataset.tipId}`, { method: "DELETE" });
    await refreshAll();
    if (editingTipId.value === deleteTip.dataset.tipId) resetTipForm();
    showToast(`Palpite ${deleted?.match || ""} apagado.`);
  }

  const markResult = event.target.closest(".mark-result");
  if (markResult) {
    if (!state.admin) return openAdminLogin();
    const amountInput = document.querySelector(`.result-amount[data-tip-id="${markResult.dataset.tipId}"]`);
    await api(`/api/tips/${markResult.dataset.tipId}/result`, {
      method: "PATCH",
      body: JSON.stringify({
        status: markResult.dataset.result,
        amount: amountInput?.value || "",
      }),
    });
    await refreshAll();
    showToast(`Palpite marcado como ${markResult.dataset.result.toUpperCase()}.`);
  }
});

document.querySelectorAll(".segment").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".segment").forEach((segment) => segment.classList.remove("active"));
    button.classList.add("active");
    state.filter = button.dataset.filter;
    renderTips();
  });
});

tipForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.admin) return openAdminLogin();

  const tipData = {
    homeTeam: document.querySelector("#homeTeamInput").value.trim(),
    awayTeam: document.querySelector("#awayTeamInput").value.trim(),
    startTime: new Date(document.querySelector("#startTimeInput").value).toISOString(),
    market: document.querySelector("#marketInput").value.trim(),
    odd: Number(document.querySelector("#oddInput").value).toFixed(2),
    access: document.querySelector("#accessInput").value,
  };

  if (editingTipId.value) {
    await api(`/api/tips/${editingTipId.value}`, {
      method: "PUT",
      body: JSON.stringify(tipData),
    });
    showToast("Palpite atualizado com sucesso.");
  } else {
    await api("/api/tips", {
      method: "POST",
      body: JSON.stringify(tipData),
    });
    showToast("Palpite publicado no feed.");
  }

  await refreshAll();
  resetTipForm();
});

cancelEditBtn.addEventListener("click", resetTipForm);

document.querySelector("#walletForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.admin) return openAdminLogin();
  const amount = Number(document.querySelector("#walletAmount").value);
  await api("/api/results", {
    method: "POST",
    body: JSON.stringify({ amount }),
  });
  await refreshAll();
  event.target.reset();
  showToast("Ganho adicionado a carteira.");
});

document.querySelector("#paymentForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const request = {
    plan: document.querySelector("#paymentPlan").value,
    name: document.querySelector("#clientName").value.trim(),
    contact: document.querySelector("#clientContact").value.trim(),
    method: document.querySelector("#paymentMethod").value,
    reference: document.querySelector("#paymentReference").value.trim(),
  };
  const savedRequest = await api("/api/payment-requests", {
    method: "POST",
    body: JSON.stringify(request),
  });
  if (state.admin) {
    await loadAdminData();
    renderAdmin();
  }
  const message = [
    "Pedido VIP JD-Tips",
    `Plano: ${savedRequest.plan}`,
    `Nome: ${savedRequest.name}`,
    `Contacto: ${savedRequest.contact}`,
    `Metodo: ${savedRequest.method}`,
    `Referencia: ${savedRequest.reference}`,
    `Data: ${savedRequest.date}`,
  ].join("\n");
  window.open(`https://wa.me/${state.paymentConfig.whatsapp}?text=${encodeURIComponent(message)}`, "_blank");
  event.target.reset();
  showToast("Pedido preparado no WhatsApp. Confirma o pagamento e envia o codigo VIP ao cliente.");
});

document.querySelector("#unlockForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const code = document.querySelector("#vipCodeInput").value.trim();
  try {
    await api("/api/vip/unlock", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
    state.vip = true;
    localStorage.setItem("jdTips.vip", "true");
    updateMembership();
    renderTips();
    event.target.reset();
    showToast("VIP desbloqueado com sucesso.");
    setSection("tips");
  } catch (error) {
    showToast(error.message);
  }
});

document.querySelector("#themeBtn").addEventListener("click", () => {
  document.body.classList.toggle("dark");
  document.querySelector("#themeBtn").textContent = document.body.classList.contains("dark")
    ? "Modo claro"
    : "Modo escuro";
});

quickVipBtn.addEventListener("click", () => setSection("vip"));
document.querySelector("#openVipBtn").addEventListener("click", () => setSection("vip"));

brandAccess.addEventListener("click", () => {
  window.clearTimeout(brandTapTimer);
  brandTapCount += 1;
  brandTapTimer = window.setTimeout(() => {
    brandTapCount = 0;
  }, 1600);
  if (brandTapCount >= 5) {
    brandTapCount = 0;
    openAdminLogin();
  }
});

adminLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ password: adminPasswordInput.value }),
    });
    state.admin = true;
    closeAdminLogin();
    await refreshAll();
    renderAdminAccess();
    showToast("Admin desbloqueado.");
    setSection("admin");
  } catch (error) {
    showToast(error.message);
  }
});

closeAdminLoginBtn.addEventListener("click", closeAdminLogin);

adminLogoutBtn.addEventListener("click", async () => {
  await api("/api/admin/logout", { method: "POST" });
  state.admin = false;
  resetTipForm();
  renderAdminAccess();
  renderTips();
  showToast("Admin bloqueado.");
  setSection("dashboard");
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}

async function init() {
  try {
    await recordVisit();
    await loadPublicData();
    const session = await api("/api/admin/me");
    state.admin = session.admin;
    await loadAdminData();
    renderPaymentConfig();
    renderWhatsappLink();
    renderAdminAccess();
    updateMembership();
    renderTips();
    renderSocialFeed();
    renderPerformanceStats();
    renderWallet();
    renderAdmin();
  } catch (error) {
    showToast("Nao foi possivel ligar ao backend. Inicia com npm start.");
  }
}

init();
