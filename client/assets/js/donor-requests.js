import { bindRipple, mountSidebar, showToast } from "./components/ui.js";
import { api } from "./modules/api.js";

mountSidebar("sidebarMount", "donor", "requests");
bindRipple();

document.getElementById("menuToggle")?.addEventListener("click", () => {
  document.getElementById("sidebar")?.classList.toggle("open");
});

let filterState = {
  bloodGroup: "",
  maxDistanceKm: "",
  sortByUrgency: "0",
};

const renderRequests = (rows) => {
  const requests = document.getElementById("requestsGrid");
  if (!rows.length) {
    requests.innerHTML = '<article class="glass-card card"><p class="meta">No matching requests found.</p></article>';
    return;
  }
  requests.innerHTML = rows
    .map(
      (r) => `
    <article class="glass-card card">
      <div class="meta">${r.city}${r.distance_km ? ` | ${Number(r.distance_km).toFixed(1)} km` : ""}</div>
      <h3 class="h3">${r.blood_group} | ${r.units} units</h3>
      <div class="badge ${r.urgency}">${r.urgency}</div>
      ${Number(r.high_match_badge || 0) === 1 ? '<p class="meta">High Match</p>' : ""}
      ${Number(r.emergency_highlight || 0) === 1 ? '<p class="meta">Emergency</p>' : ""}
      <div class="btn-group" style="margin-top:8px;">
        <button class="btn btn-secondary req-decline-btn" data-id="${r.id}">Decline</button>
        <button class="btn btn-primary req-accept-btn" data-id="${r.id}">Accept</button>
      </div>
    </article>`
    )
    .join("");

  document.querySelectorAll(".req-accept-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!window.confirm("Accept this request?")) return;
      try {
        await api.donorRespondToRequest(btn.dataset.id, "accept");
        showToast("Request accepted");
        await load();
      } catch (error) {
        showToast(error.message);
      }
    });
  });
  document.querySelectorAll(".req-decline-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!window.confirm("Decline this request?")) return;
      try {
        await api.donorRespondToRequest(btn.dataset.id, "decline");
        showToast("Request declined");
        await load();
      } catch (error) {
        showToast(error.message);
      }
    });
  });
};

document.getElementById("applyRequestFilters")?.addEventListener("click", () => {
  filterState.bloodGroup = document.getElementById("filterBloodGroup")?.value || "";
  filterState.maxDistanceKm = document.getElementById("filterDistanceKm")?.value || "";
  filterState.sortByUrgency = document.getElementById("sortUrgency")?.checked ? "1" : "0";
  load();
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
    document.getElementById("eligibility").textContent = data.profile.eligibility_badge || "Eligible";
    renderRequests(data.nearbyRequests || []);
  } catch (error) {
    showToast(error.message);
  }
};

load();
