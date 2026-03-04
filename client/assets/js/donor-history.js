import { bindRipple, mountSidebar, showToast } from "./components/ui.js";
import { api, resolveApiDownloadUrl } from "./modules/api.js";

mountSidebar("sidebarMount", "donor", "history");
bindRipple();

document.getElementById("menuToggle")?.addEventListener("click", () => {
  document.getElementById("sidebar")?.classList.toggle("open");
});

let page = 1;
const perPage = 8;
let historyCache = [];
const filterState = { search: "", dateFrom: "", dateTo: "" };

const toDateText = (value) => {
  if (!value) return "-";
  if (typeof value === "string") return value.slice(0, 10);
  return value?.toISOString?.().slice(0, 10) || "-";
};

const renderPage = () => {
  const start = (page - 1) * perPage;
  const rows = historyCache.slice(start, start + perPage);
  const body = document.getElementById("historyBody");
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="7" class="text-center">No history found.</td></tr>';
    return;
  }
  body.innerHTML = rows
    .map(
      (h) => `
    <tr>
      <td>${h.id}</td>
      <td>${h.blood_group}</td>
      <td>${h.city || "-"}</td>
      <td>${h.hospital_name || "-"}</td>
      <td>${toDateText(h.donation_date)}</td>
      <td><span class="badge normal">${h.status}</span></td>
      <td>${Number(h.id) < 1000000 ? `<button class="btn btn-secondary cert-btn" data-id="${h.id}">View</button>` : "-"}</td>
    </tr>`
    )
    .join("");

  document.querySelectorAll(".cert-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      window.open(resolveApiDownloadUrl(`/api/donor/certificate/${btn.dataset.id}`), "_blank");
    });
  });
};

document.getElementById("prevPage")?.addEventListener("click", () => {
  page = Math.max(1, page - 1);
  renderPage();
});

document.getElementById("nextPage")?.addEventListener("click", () => {
  page += 1;
  if ((page - 1) * perPage >= historyCache.length) page -= 1;
  renderPage();
});

document.getElementById("applyHistoryFilters")?.addEventListener("click", () => {
  filterState.search = (document.getElementById("searchHistory")?.value || "").trim();
  filterState.dateFrom = document.getElementById("historyDateFrom")?.value || "";
  filterState.dateTo = document.getElementById("historyDateTo")?.value || "";
  page = 1;
  load();
});

document.getElementById("exportHistoryBtn")?.addEventListener("click", () => {
  const q = new URLSearchParams();
  if (filterState.search) q.set("search", filterState.search);
  if (filterState.dateFrom) q.set("dateFrom", filterState.dateFrom);
  if (filterState.dateTo) q.set("dateTo", filterState.dateTo);
  const suffix = q.toString() ? `?${q.toString()}` : "";
  window.open(resolveApiDownloadUrl(`/api/donor/history/export${suffix}`), "_blank");
});

document.querySelector('[data-action="logout"]')?.addEventListener("click", async (e) => {
  e.preventDefault();
  try {
    await api.logout();
  } finally {
    window.location.href = "/pages/login.html";
  }
});

const load = async () => {
  try {
    const data = await api.donorDashboard(filterState);
    historyCache = data.donationHistory || [];
    renderPage();
  } catch (error) {
    showToast(error.message);
  }
};

load();
