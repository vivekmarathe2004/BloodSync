import { bindRipple, closeModal, mountSidebar, openModal, showToast } from "./components/ui.js";
import { api } from "./modules/api.js";

const role = document.body.dataset.role === "hospital" ? "hospital" : "admin";
mountSidebar("sidebarMount", role, "camps");
bindRipple();

document.getElementById("menuToggle")?.addEventListener("click", () => {
  document.getElementById("sidebar")?.classList.toggle("open");
});

document.querySelector('[data-action="logout"]')?.addEventListener("click", async (e) => {
  e.preventDefault();
  try {
    await api.logout();
  } finally {
    window.location.href = "/pages/login.html";
  }
});

const endpoints = {
  listCamps: role === "admin" ? api.adminCamps : api.hospitalCamps,
  createCamp: role === "admin" ? api.adminCreateCamp : api.hospitalCreateCamp,
  updateCamp: role === "admin" ? api.adminUpdateCamp : api.hospitalUpdateCamp,
  deleteCamp: role === "admin" ? api.adminDeleteCamp : api.hospitalDeleteCamp,
  campDashboard: role === "admin" ? api.adminCampDashboard : api.hospitalCampDashboard,
  markAttendance: role === "admin" ? api.adminCampAttendance : api.hospitalCampAttendance,
  analytics: role === "admin" ? api.adminCampsAnalytics : null,
};

const campsById = new Map();
const MAX_CAMP_DAYS = 14;
let pendingDeleteCampId = "";

const getCampDateRange = (camp) => {
  const start = camp.start_date_text || camp.start_date_text_fallback || camp.camp_date_text || "";
  const end = camp.end_date_text || camp.end_date_text_fallback || start;
  return { start, end };
};

const formatCampDateRange = (camp) => {
  const { start, end } = getCampDateRange(camp);
  if (!start) return "-";
  return start === end ? start : `${start} to ${end}`;
};

const validateDateRange = (startDate, endDate) => {
  if (!startDate || !endDate) return "Start date and end date are required.";
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "Invalid date range.";
  if (end < start) return "End date cannot be before start date.";
  const dayMs = 24 * 60 * 60 * 1000;
  const duration = Math.floor((end - start) / dayMs) + 1;
  if (duration > MAX_CAMP_DAYS) return `Camp duration cannot exceed ${MAX_CAMP_DAYS} days.`;
  return "";
};

const renderAnalytics = (stats) => {
  if (!stats) return;
  const total = document.getElementById("statTotalCamps");
  const units = document.getElementById("statUnits");
  const location = document.getElementById("statLocation");
  const attendance = document.getElementById("statAttendance");
  if (!total || !units || !location || !attendance) return;
  total.textContent = stats.totalCampsConducted;
  units.textContent = stats.totalBloodUnitsCollectedFromCamps;
  location.textContent = stats.mostActiveCampLocation;
  attendance.textContent = `${stats.averageAttendanceRate}%`;
};

const renderManagedCamps = (rows) => {
  const visibleRows = (rows || []).filter((camp) => String(camp.status_text || "").toLowerCase() !== "cancelled");
  campsById.clear();
  visibleRows.forEach((camp) => campsById.set(String(camp.id), camp));
  const tbody = document.getElementById("managedCampsBody");
  if (!tbody) return;
  if (!visibleRows.length) {
    tbody.innerHTML = '<tr><td colspan="6">No camps found.</td></tr>';
    return;
  }
  tbody.innerHTML = visibleRows
    .map(
      (camp) => `
    <tr>
      <td>${camp.camp_name}</td>
      <td>${formatCampDateRange(camp)}</td>
      <td><span class="badge">${camp.status_text}</span></td>
      <td>${camp.location_text}</td>
      <td>${camp.organizer_name || "-"} (${camp.organizer_role_text || "-"})</td>
      <td>
        <div class="btn-group">
          <button class="btn btn-secondary open-camp-btn" data-id="${camp.id}">Open</button>
          <button class="btn btn-secondary edit-camp-btn" data-id="${camp.id}">Edit</button>
          <button class="btn btn-danger delete-camp-btn" data-id="${camp.id}">Delete</button>
        </div>
      </td>
    </tr>`
    )
    .join("");

  document.querySelectorAll(".open-camp-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await loadCampDashboard(btn.dataset.id);
    });
  });
  document.querySelectorAll(".edit-camp-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const camp = campsById.get(String(btn.dataset.id));
      if (!camp) return;
      document.getElementById("editCampId").value = camp.id;
      document.getElementById("editCampName").value = camp.camp_name || "";
      document.getElementById("editLocation").value = camp.location_text || "";
      const { start, end } = getCampDateRange(camp);
      document.getElementById("editStartDate").value = start || "";
      document.getElementById("editEndDate").value = end || "";
      document.getElementById("editStartTime").value = camp.start_time_text || "";
      document.getElementById("editEndTime").value = camp.end_time_text || "";
      document.getElementById("editExpectedDonors").value = Number(camp.expected_donors || 0);
      document.getElementById("editStatus").value = camp.status_text || "upcoming";
      document.getElementById("editDescription").value = camp.description_text || "";
      openModal("editCampModal");
    });
  });
  document.querySelectorAll(".delete-camp-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      pendingDeleteCampId = String(btn.dataset.id || "");
      openModal("deleteCampModal");
    });
  });
};

const renderCampDashboard = (data) => {
  const meta = document.getElementById("selectedCampMeta");
  if (meta) meta.textContent = `${data.camp.camp_name} | ${formatCampDateRange(data.camp)} | ${data.camp.location_text}`;

  const metrics = document.getElementById("campMetrics");
  if (metrics) {
    metrics.innerHTML = `
      <article class="glass-card card stat"><div class="meta">Registered</div><div class="value">${data.metrics.totalRegisteredDonors}</div></article>
      <article class="glass-card card stat"><div class="meta">Checked-In</div><div class="value">${data.metrics.checkedInDonors}</div></article>
      <article class="glass-card card stat"><div class="meta">Units Collected</div><div class="value">${data.metrics.totalUnitsCollected}</div></article>
      <article class="glass-card card stat"><div class="meta">No Shows</div><div class="value">${data.metrics.noShows}</div></article>
    `;
  }

  const tbody = document.getElementById("campDonorsBody");
  if (!tbody) return;
  if (!data.donors.length) {
    tbody.innerHTML = '<tr><td colspan="7">No registered donors yet.</td></tr>';
    return;
  }
  tbody.innerHTML = data.donors
    .map(
      (donor) => `
    <tr>
      <td>${donor.name}</td>
      <td>${donor.email}</td>
      <td>${donor.status_text}</td>
      <td>${Number(donor.arrived_flag) === 1 ? "Yes" : "No"}</td>
      <td>${Number(donor.donated_flag) === 1 ? "Yes" : "No"}</td>
      <td>${donor.units_collected || 0}</td>
      <td>
        <button class="btn btn-secondary mark-arrived-btn" data-camp="${data.camp.id}" data-donor="${donor.donor_user_id}">Arrived</button>
        <button class="btn btn-primary mark-donated-btn" data-camp="${data.camp.id}" data-donor="${donor.donor_user_id}">Donated</button>
      </td>
    </tr>`
    )
    .join("");

  document.querySelectorAll(".mark-arrived-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await endpoints.markAttendance(btn.dataset.camp, {
          donorUserId: Number(btn.dataset.donor),
          arrivedFlag: 1,
          donatedFlag: 0,
          unitsCollected: 0,
        });
        showToast("Marked arrived");
        await loadCampDashboard(btn.dataset.camp);
      } catch (error) {
        showToast(error.message);
      }
    });
  });

  document.querySelectorAll(".mark-donated-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await endpoints.markAttendance(btn.dataset.camp, {
          donorUserId: Number(btn.dataset.donor),
          arrivedFlag: 1,
          donatedFlag: 1,
          unitsCollected: 1,
        });
        showToast("Marked donated");
        await loadCampDashboard(btn.dataset.camp);
      } catch (error) {
        showToast(error.message);
      }
    });
  });
};

const loadCampDashboard = async (campId) => {
  try {
    const data = await endpoints.campDashboard(campId);
    renderCampDashboard(data);
  } catch (error) {
    showToast(error.message);
  }
};

const load = async () => {
  try {
    const camps = await endpoints.listCamps();
    renderManagedCamps(camps);
    if (role === "admin" && endpoints.analytics) {
      const stats = await endpoints.analytics();
      renderAnalytics(stats);
    }
  } catch (error) {
    showToast(error.message);
  }
};

document.getElementById("createCampForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(e.target).entries());
  const dateError = validateDateRange(payload.startDate, payload.endDate);
  if (dateError) {
    showToast(dateError);
    return;
  }
  try {
    await endpoints.createCamp(payload);
    showToast("Camp created");
    e.target.reset();
    await load();
  } catch (error) {
    showToast(error.message);
  }
});

document.getElementById("closeEditCampModal")?.addEventListener("click", () => closeModal("editCampModal"));
document.getElementById("closeDeleteCampModal")?.addEventListener("click", () => {
  pendingDeleteCampId = "";
  closeModal("deleteCampModal");
});
document.getElementById("cancelDeleteCampBtn")?.addEventListener("click", () => {
  pendingDeleteCampId = "";
  closeModal("deleteCampModal");
});
document.getElementById("confirmDeleteCampBtn")?.addEventListener("click", async () => {
  if (!pendingDeleteCampId) {
    closeModal("deleteCampModal");
    return;
  }
  try {
    await endpoints.deleteCamp(pendingDeleteCampId);
    showToast("Camp deleted");
    pendingDeleteCampId = "";
    closeModal("deleteCampModal");
    await load();
  } catch (error) {
    showToast(error.message);
  }
});
document.getElementById("editCampForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(e.target).entries());
  const dateError = validateDateRange(payload.startDate, payload.endDate);
  if (dateError) {
    showToast(dateError);
    return;
  }
  const campId = payload.campId;
  delete payload.campId;
  try {
    await endpoints.updateCamp(campId, payload);
    showToast("Camp updated");
    closeModal("editCampModal");
    await load();
  } catch (error) {
    showToast(error.message);
  }
});

load();
