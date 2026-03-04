import { bindRipple, mountSidebar, showToast } from "./components/ui.js";
import { api } from "./modules/api.js";

mountSidebar("sidebarMount", "donor", "camps");
bindRipple();
const formatCampDateRange = (camp) => {
  const start = camp.start_date_text || camp.camp_date_text || "";
  const end = camp.end_date_text || start;
  if (!start) return "-";
  return start === end ? start : `${start} to ${end}`;
};

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

const renderUpcoming = (rows) => {
  const el = document.getElementById("upcomingDonorCamps");
  if (!el) return;
  if (!rows.length) {
    el.innerHTML = '<article class="glass-card card"><h3 class="h3">No upcoming camps</h3></article>';
    return;
  }
  el.innerHTML = rows
    .map(
      (camp) => `
    <article class="glass-card card">
      <h3 class="h3">${camp.camp_name}</h3>
      <p class="meta">${camp.location_text}</p>
      <p class="meta">${formatCampDateRange(camp)} | ${camp.start_time_text} - ${camp.end_time_text}</p>
      <p class="meta">Available Slots: ${camp.available_slots ?? camp.expected_donors}</p>
      <button class="btn btn-primary register-camp-btn" data-id="${camp.id}" ${Number(camp.available_slots || 0) <= 0 ? "disabled" : ""}>
        ${Number(camp.available_slots || 0) <= 0 ? "Full" : "Register"}
      </button>
    </article>`
    )
    .join("");

  document.querySelectorAll(".register-camp-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await api.donorRegisterCamp(btn.dataset.id);
        showToast("Registered");
        await load();
      } catch (error) {
        showToast(error.message);
      }
    });
  });
};

const renderRegistrations = (rows) => {
  const el = document.getElementById("myCampRegistrations");
  if (!el) return;
  if (!rows.length) {
    el.innerHTML = '<tr><td colspan="5">No registrations yet.</td></tr>';
    return;
  }
  el.innerHTML = rows
    .map(
      (row) => `
    <tr>
      <td>${row.camp_name}</td>
      <td>${formatCampDateRange(row)}</td>
      <td>${row.location_text}</td>
      <td><span class="badge ${row.status_text === "registered" ? "normal" : "urgent"}">${row.status_text}</span></td>
      <td>${row.status_text === "registered" ? `<button class="btn btn-danger cancel-camp-btn" data-id="${row.camp_id}">Cancel</button>` : "-"}</td>
    </tr>`
    )
    .join("");

  document.querySelectorAll(".cancel-camp-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await api.donorCancelCampRegistration(btn.dataset.id);
        showToast("Registration cancelled");
        await load();
      } catch (error) {
        showToast(error.message);
      }
    });
  });
};

const load = async () => {
  try {
    const [upcoming, history] = await Promise.all([api.donorUpcomingCamps(), api.donorCampRegistrations()]);
    renderUpcoming(upcoming);
    renderRegistrations(history);
  } catch (error) {
    showToast(error.message);
  }
};

load();
