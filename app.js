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
