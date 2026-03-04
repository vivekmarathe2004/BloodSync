import { bindRipple, closeModal, mountSidebar, openModal, showToast } from "./components/ui.js";
import { api, resolveApiDownloadUrl } from "./modules/api.js";

const validTabs = new Set(["dashboard", "requests", "history", "activity", "settings"]);
const tabFromUrl = new URLSearchParams(window.location.search).get("tab");
const initialTab = validTabs.has(tabFromUrl) ? tabFromUrl : "dashboard";

mountSidebar("sidebarMount", "admin", initialTab);
bindRipple();

let showTab = (tabName) => {
  document.querySelectorAll(".tab-content").forEach((tab) => {
    tab.style.display = "none";
  });

  document.querySelectorAll(".sidebar a").forEach((link) => {
    link.classList.remove("active");
  });

  const selectedTab = document.getElementById(`${tabName}Tab`);
  if (selectedTab) selectedTab.style.display = "block";

  const activeLink = document.querySelector(`.sidebar a[data-key="${tabName}"]`);
  if (activeLink) activeLink.classList.add("active");
};

document.addEventListener("DOMContentLoaded", () => {
  const sidebarLinks = document.querySelectorAll(".sidebar a");
  sidebarLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      if (link.dataset.tab) e.preventDefault();
      const tabName = link.dataset.tab;
      if (tabName) showTab(tabName);
    });
  });

  showTab(initialTab);
});

document.getElementById("menuToggle")?.addEventListener("click", () => {
  document.getElementById("sidebar")?.classList.toggle("open");
});

let pendingDeleteId = null;
let bloodChartInstance;
let cityChartInstance;
let adminStockTrendChartInstance;
let dashboardCache = null;
let currentRoleFilter = "all";
let activityCache = [];
const ADMIN_SETTINGS_KEY = "bloodsync.admin.settings.v1";

const selectedUsers = new Set();

const readAdminSettings = () => {
  try {
    const raw = window.localStorage.getItem(ADMIN_SETTINGS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_) {
    return {};
  }
};

const writeAdminSettings = (payload) => {
  try {
    window.localStorage.setItem(ADMIN_SETTINGS_KEY, JSON.stringify(payload || {}));
    return true;
  } catch (_) {
    return false;
  }
};

const applyAdminSettings = () => {
  const settings = readAdminSettings();
  const roleFilterEl = document.getElementById("roleFilter");
  const activitySearchEl = document.getElementById("activitySearchInput");
  if (roleFilterEl && ["all", "donor", "hospital", "admin"].includes(String(settings.roleFilter || ""))) {
    roleFilterEl.value = settings.roleFilter;
    currentRoleFilter = settings.roleFilter;
  }
  if (activitySearchEl && typeof settings.activitySearch === "string") {
    activitySearchEl.value = settings.activitySearch;
  }
};

const renderDashboardInsights = (data) => {
  const target = document.getElementById("dashboardInsights");
  if (!target) return;

  const topBlood = data?.charts?.bloodGroup?.[0];
  const topCity = data?.charts?.city?.[0];
  const hotspots = (data?.heatmap || []).slice(0, 3);

  target.innerHTML = `
    <div class="insight-item">
      <span class="meta">Top Blood Group</span>
      <strong>${topBlood ? `${topBlood.blood_group} (${topBlood.count})` : "N/A"}</strong>
    </div>
    <div class="insight-item">
      <span class="meta">Top City</span>
      <strong>${topCity ? `${topCity.city} (${topCity.count})` : "N/A"}</strong>
    </div>
    <div class="insight-item">
      <span class="meta">Demand Hotspots</span>
      <div class="insight-hotspots">
        ${
          hotspots.length
            ? hotspots
                .map((h) => `<span class="badge urgent">${h.city} ${h.blood_group} (${h.demand_count})</span>`)
                .join("")
            : '<span class="meta">No active hotspot</span>'
        }
      </div>
    </div>
  `;
};

const renderCharts = (charts) => {
  const groupCtx = document.getElementById("bloodChart");
  const cityCtx = document.getElementById("cityChart");
  if (!groupCtx || !cityCtx || !window.Chart) return;

  if (bloodChartInstance) bloodChartInstance.destroy();
  if (cityChartInstance) cityChartInstance.destroy();

  bloodChartInstance = new Chart(groupCtx, {
    type: "bar",
    data: {
      labels: charts.bloodGroup.map((x) => x.blood_group),
      datasets: [{ data: charts.bloodGroup.map((x) => x.count), backgroundColor: "#e63946" }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
    },
  });

  cityChartInstance = new Chart(cityCtx, {
    type: "pie",
    data: {
      labels: charts.city.map((x) => x.city),
      datasets: [{ data: charts.city.map((x) => x.count), backgroundColor: ["#e63946", "#f4a261", "#2a9d8f", "#4361ee", "#ef476f", "#06d6a0", "#ffd166", "#118ab2"] }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
    },
  });
};

const isUserActive = (u) => Number(u.is_active) === 1 && Number(u.deleted_at_ts || 0) === 0;
const statusLabel = (u) => (isUserActive(u) ? "Active" : "Suspended");
const roleLabel = (u) => (Number(u.is_super_admin || 0) === 1 ? "super_admin" : u.role);

const render = (data) => {
  document.getElementById("usersStat").textContent = data.stats.total_users;
  document.getElementById("donorsStat").textContent = data.stats.total_donors;
  document.getElementById("hospitalsStat").textContent = data.stats.total_hospitals;
  document.getElementById("requestsStat").textContent = data.stats.total_requests;

  const filteredUsers = currentRoleFilter === "all" ? data.users : data.users.filter((u) => u.role === currentRoleFilter);

  const table = document.getElementById("usersBody");
  table.innerHTML = filteredUsers
    .map(
      (u) => `
    <tr>
      <td><input class="select-user" data-id="${u.id}" type="checkbox" ${selectedUsers.has(String(u.id)) ? "checked" : ""} /></td>
      <td>${u.name}</td>
      <td>${u.email}</td>
      <td>${roleLabel(u)}</td>
      <td><span class="badge ${isUserActive(u) ? "normal" : "urgent"}">${statusLabel(u)}</span></td>
      <td>${u.city || "-"}</td>
      <td>
        <div class="btn-group">
          <button class="btn btn-secondary view-btn" data-id="${u.id}" style="min-width:110px">View</button>
          <button class="btn btn-secondary suspend-btn" data-id="${u.id}" data-active="${isUserActive(u) ? 1 : 0}" style="min-width:110px">
            ${isUserActive(u) ? "Suspend" : "Activate"}
          </button>
          <button class="btn btn-secondary role-btn" data-id="${u.id}" data-role="${u.role}" style="min-width:110px">Role</button>
          ${u.role === "donor" ? `<button class="btn btn-secondary restrict-btn" data-id="${u.id}" style="min-width:110px">Restriction</button>` : ""}
          <button class="btn btn-danger delete-btn" data-id="${u.id}" style="min-width:110px">Delete</button>
        </div>
      </td>
    </tr>`
    )
    .join("");

  document.querySelectorAll(".select-user").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) selectedUsers.add(String(checkbox.dataset.id));
      else selectedUsers.delete(String(checkbox.dataset.id));
    });
  });

  document.querySelectorAll(".view-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const user = filteredUsers.find((u) => String(u.id) === String(btn.dataset.id));
      if (!user) return;
      const card = document.getElementById("userInfoCard");
      if (card) {
        card.innerHTML = `
          <p><strong>Name:</strong> ${user.name}</p>
          <p><strong>Email:</strong> ${user.email}</p>
          <p><strong>Role:</strong> ${roleLabel(user)}</p>
          <p><strong>Status:</strong> ${statusLabel(user)}</p>
          <p><strong>City:</strong> ${user.city || "-"}</p>
          <p><strong>Phone:</strong> ${user.phone || "-"}</p>
          <p><strong>Joined:</strong> ${user.created_at ? new Date(user.created_at).toLocaleString() : "-"}</p>
        `;
      }
      openModal("userInfoModal");
    });
  });

  document.querySelectorAll(".suspend-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const userId = btn.dataset.id;
      const shouldActivate = Number(btn.dataset.active) !== 1;
      try {
        await api.adminSetUserStatus(userId, shouldActivate);
        showToast(shouldActivate ? "User activated" : "User suspended");
        await load();
      } catch (error) {
        showToast(error.message);
      }
    });
  });

  document.querySelectorAll(".role-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const user = filteredUsers.find((u) => String(u.id) === String(btn.dataset.id));
      if (!user) return;
      if (user.role === "admin") {
        showToast("Admin role changes are restricted.");
        return;
      }
      document.getElementById("roleUserId").value = user.id;
      document.getElementById("nextRole").value = user.role === "donor" ? "hospital" : "donor";
      syncRoleModalFields();
      openModal("roleModal");
    });
  });

  document.querySelectorAll(".restrict-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const user = filteredUsers.find((u) => String(u.id) === String(btn.dataset.id));
      if (!user) return;
      const restrictionStatus = window.prompt(
        "Set donor restriction: eligible | temporarily_not_eligible | permanently_restricted",
        "eligible"
      );
      if (!restrictionStatus) return;
      try {
        await api.adminSetDonorRestriction(user.id, restrictionStatus.trim());
        showToast("Donor restriction updated");
        await load();
      } catch (error) {
        showToast(error.message);
      }
    });
  });

  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      pendingDeleteId = btn.dataset.id;
      openModal("deleteModal");
    });
  });

  renderCharts(data.charts);
  renderDashboardInsights(data);
};

const loadRequests = async () => {
  try {
    const requests = await api.getAllRequests();
    const tbody = document.getElementById("requestsBody");

    if (requests.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center">No requests found</td></tr>';
      return;
    }

    tbody.innerHTML = requests
      .map(
        (req) => `
      <tr>
        <td>${req.hospital_name}</td>
        <td><span class="badge">${req.blood_group}</span></td>
        <td>${req.units}</td>
        <td><span class="badge urgency-${req.urgency}">${req.urgency}</span></td>
        <td>${req.city}</td>
        <td><span class="badge status-${req.status}">${req.status}</span></td>
        <td>${new Date(req.created_at).toLocaleDateString()}</td>
      </tr>
    `
      )
      .join("");
  } catch (error) {
    const tbody = document.getElementById("requestsBody");
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Failed to load requests</td></tr>';
    showToast("Failed to load requests");
  }
};

const loadHistory = async () => {
  try {
    const history = await api.getDonationHistory();
    const tbody = document.getElementById("historyBody");

    if (history.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center">No donation history found</td></tr>';
      return;
    }

    tbody.innerHTML = history
      .map(
        (item) => `
      <tr>
        <td>${item.donor_name}</td>
        <td>${item.hospital_name}</td>
        <td><span class="badge">${item.blood_group}</span></td>
        <td>${new Date(item.donation_date).toLocaleDateString()}</td>
        <td><span class="badge status-${item.status}">${item.status}</span></td>
      </tr>
    `
      )
      .join("");
  } catch (error) {
    const tbody = document.getElementById("historyBody");
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">Failed to load history</td></tr>';
    showToast("Failed to load history");
  }
};

const renderActivity = (rows, search = "") => {
  const tbody = document.getElementById("activityBody");
  if (!tbody) return;
  const q = (search || "").toLowerCase().trim();
  const filtered = q
    ? rows.filter(
        (r) =>
          String(r.action || "").toLowerCase().includes(q) ||
          String(r.actor_name || "").toLowerCase().includes(q) ||
          String(r.entity_type || "").toLowerCase().includes(q)
      )
    : rows;

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">No activity found</td></tr>';
    return;
  }

  tbody.innerHTML = filtered
    .map((item) => {
      const ts = item.created_at ? new Date(item.created_at).toLocaleString() : "-";
      const details =
        item.details && typeof item.details === "object"
          ? Object.entries(item.details)
              .slice(0, 3)
              .map(([k, v]) => `${k}:${v}`)
              .join(", ")
          : "-";
      return `
      <tr>
        <td>${ts}</td>
        <td>${item.actor_name || "System"}</td>
        <td>${item.action || "-"}</td>
        <td>${item.entity_type || "-"}#${item.entity_id || "-"}</td>
        <td>${details}</td>
      </tr>`;
    })
    .join("");
};

const loadActivity = async () => {
  try {
    activityCache = await api.adminActivity();
    renderActivity(activityCache, document.getElementById("activitySearchInput")?.value || "");
  } catch (error) {
    const tbody = document.getElementById("activityBody");
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center">Failed to load activity</td></tr>';
    showToast("Failed to load activity");
  }
};

const loadAdminStockTrend = async () => {
  const canvas = document.getElementById("adminStockTrendChart");
  if (!canvas || !window.Chart) return;
  try {
    const rows = await api.adminStockTrends(30);
    if (adminStockTrendChartInstance) adminStockTrendChartInstance.destroy();
    adminStockTrendChartInstance = new Chart(canvas, {
      type: "line",
      data: {
        labels: rows.map((r) => r.day_text),
        datasets: [
          {
            label: "Net Units Changed",
            data: rows.map((r) => Number(r.net_units_changed || 0)),
            borderColor: "#2a9d8f",
            backgroundColor: "rgba(42,157,143,0.2)",
            fill: true,
            tension: 0.25,
          },
        ],
      },
      options: { responsive: true },
    });
  } catch (error) {
    showToast("Failed to load stock trend");
  }
};

const originalShowTab = showTab;
showTab = (tabName) => {
  originalShowTab(tabName);

  if (tabName === "requests") loadRequests();
  else if (tabName === "history") loadHistory();
  else if (tabName === "activity") loadActivity();
  else if (tabName === "settings") loadAdminStockTrend();
};

const load = async (search = "") => {
  try {
    const data = await api.adminDashboard(search);
    dashboardCache = data;
    render(data);
  } catch (error) {
    showToast(error.message);
  }
};

const syncRoleModalFields = () => {
  const nextRole = document.getElementById("nextRole")?.value;
  const donorFields = document.getElementById("donorFields");
  const hospitalFields = document.getElementById("hospitalFields");
  if (!donorFields || !hospitalFields) return;
  donorFields.style.display = nextRole === "donor" ? "block" : "none";
  hospitalFields.style.display = nextRole === "hospital" ? "block" : "none";
};

document.getElementById("selectAllUsers")?.addEventListener("change", (e) => {
  const checked = e.target.checked;
  document.querySelectorAll(".select-user").forEach((input) => {
    input.checked = checked;
    if (checked) selectedUsers.add(String(input.dataset.id));
    else selectedUsers.delete(String(input.dataset.id));
  });
});

document.getElementById("searchInput")?.addEventListener("input", (e) => load(e.target.value));
document.getElementById("roleFilter")?.addEventListener("change", (e) => {
  currentRoleFilter = e.target.value;
  if (dashboardCache) render(dashboardCache);
});
document.getElementById("cancelDelete")?.addEventListener("click", () => closeModal("deleteModal"));
document.getElementById("confirmDelete")?.addEventListener("click", async () => {
  if (!pendingDeleteId) return;
  try {
    await api.deleteUser(pendingDeleteId);
    showToast("User deleted");
    closeModal("deleteModal");
    await load();
  } catch (error) {
    showToast(error.message);
  }
});

document.getElementById("openAddAdminModal")?.addEventListener("click", () => openModal("addAdminModal"));
document.getElementById("closeAddAdminModal")?.addEventListener("click", () => closeModal("addAdminModal"));
document.getElementById("addAdminForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(e.target).entries());
  try {
    await api.adminCreateUserAdmin(payload);
    showToast("Admin created");
    closeModal("addAdminModal");
    e.target.reset();
    await load();
  } catch (error) {
    showToast(error.message);
  }
});

document.getElementById("closeRoleModal")?.addEventListener("click", () => closeModal("roleModal"));
document.getElementById("closeUserInfoModal")?.addEventListener("click", () => closeModal("userInfoModal"));
document.getElementById("nextRole")?.addEventListener("change", syncRoleModalFields);
document.getElementById("changeRoleForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(e.target).entries());
  const userId = payload.userId;
  delete payload.userId;
  try {
    await api.adminChangeUserRole(userId, payload);
    showToast("Role updated");
    closeModal("roleModal");
    e.target.reset();
    await load();
  } catch (error) {
    showToast(error.message);
  }
});

const runBulkAction = async (action) => {
  if (!selectedUsers.size) {
    showToast("Select users first");
    return;
  }
  try {
    await api.adminBulkUserAction({ action, userIds: [...selectedUsers] });
    showToast("Bulk action completed");
    selectedUsers.clear();
    document.getElementById("selectAllUsers").checked = false;
    await load();
  } catch (error) {
    showToast(error.message);
  }
};

document.getElementById("bulkSuspendBtn")?.addEventListener("click", () => runBulkAction("suspend"));
document.getElementById("bulkActivateBtn")?.addEventListener("click", () => runBulkAction("activate"));
document.getElementById("bulkDeleteBtn")?.addEventListener("click", () => runBulkAction("delete"));
document.getElementById("refreshActivityBtn")?.addEventListener("click", () => loadActivity());
document.getElementById("activitySearchInput")?.addEventListener("input", (e) => {
  renderActivity(activityCache, e.target.value);
});

document.getElementById("refreshDashboardBtn")?.addEventListener("click", () => location.reload());
document.getElementById("saveSettingsBtn")?.addEventListener("click", () => {
  const payload = {
    roleFilter: document.getElementById("roleFilter")?.value || "all",
    activitySearch: document.getElementById("activitySearchInput")?.value || "",
  };
  const saved = writeAdminSettings(payload);
  if (saved) {
    currentRoleFilter = payload.roleFilter;
    if (dashboardCache) render(dashboardCache);
    if (activityCache.length) renderActivity(activityCache, payload.activitySearch);
    showToast("Settings saved");
    return;
  }
  showToast("Failed to save settings");
});
document.getElementById("exportSystemStockTxBtn")?.addEventListener("click", () => {
  window.open(resolveApiDownloadUrl("/api/admin/stock/transactions/export"), "_blank");
});
document.querySelector('[data-action="logout"]')?.addEventListener("click", async (e) => {
  e.preventDefault();
  try {
    await api.logout();
  } finally {
    window.location.href = "/pages/login.html";
  }
});

applyAdminSettings();
load();
