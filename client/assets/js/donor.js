import { bindRipple, mountSidebar, showToast } from "./components/ui.js";
import { api } from "./modules/api.js";
import { initReveal } from "./modules/animations.js";

mountSidebar("sidebarMount", "donor", "dashboard");
bindRipple();
initReveal();

document.getElementById("menuToggle")?.addEventListener("click", () => {
  document.getElementById("sidebar")?.classList.toggle("open");
});

let filterState = {
  bloodGroup: "",
  maxDistanceKm: "",
  sortByUrgency: "0",
};

const toDateText = (value) => {
  if (!value) return "-";
  if (typeof value === "string") return value.slice(0, 10);
  return value?.toISOString?.().slice(0, 10) || "-";
};

const renderRequests = (rows) => {
  const requests = document.getElementById("requestsGrid");
  if (!requests) return;
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

const renderDashboard = (data) => {
  document.getElementById("totalDonations").textContent = data.stats.totalDonations;
  document.getElementById("totalUnits").textContent = data.stats.totalBloodUnits;
  document.getElementById("donationStreak").textContent = data.stats.streak;
  document.getElementById("eligibility").textContent = data.profile.eligibility_badge || "Eligible";
  document.getElementById("nextEligible").textContent = `${data.nextEligibleInDays} days`;
  document.getElementById("nextEligibleDate").textContent = data.nextEligibleDate || "-";
  document.getElementById("lastDonationDate").textContent = toDateText(data.profile.last_donation_date);
  renderRequests(data.nearbyRequests || []);
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
    const data = await api.donorDashboard({
      bloodGroup: filterState.bloodGroup,
      maxDistanceKm: filterState.maxDistanceKm,
      sortByUrgency: filterState.sortByUrgency,
    });
    renderDashboard(data);
  } catch (error) {
    showToast(error.message);
  }
};

load();
