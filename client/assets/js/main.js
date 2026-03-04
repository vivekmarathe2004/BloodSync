import { bindRipple, mountFooter, mountNavbar } from "./components/ui.js";
import { animateCounter, initReveal } from "./modules/animations.js";

mountNavbar("navbarMount", "guest");
mountFooter();
bindRipple();
initReveal();

const defaultCounters = {
  donors: 0,
  donations: 0,
  activeRequests: 0,
};

const formatCampDateRange = (camp) => {
  const start = camp.start_date_text || camp.camp_date_text || "";
  const end = camp.end_date_text || start;
  if (!start) return "-";
  return start === end ? start : `${start} to ${end}`;
};

const renderLandingCamps = (rows = []) => {
  const campsGrid = document.getElementById("landingCampsGrid");
  if (!campsGrid) return;

  if (!rows.length) {
    campsGrid.innerHTML =
      '<article class="glass-card card"><h3 class="h3">No camps</h3><p class="meta">No upcoming camps found.</p></article>';
    return;
  }

  campsGrid.innerHTML = rows
    .slice(0, 3)
    .map(
      (camp) => `
      <article class="glass-card card">
        <h3 class="h3">${camp.camp_name}</h3>
        <p class="meta">${camp.location_text}</p>
        <p class="meta">${formatCampDateRange(camp)} | ${camp.start_time_text} - ${camp.end_time_text}</p>
        <p class="meta">Available Slots: ${camp.available_slots ?? camp.expected_donors ?? 0}</p>
        <div class="badge normal">${camp.status_text}</div>
      </article>`
    )
    .join("");
};

const renderAvailability = (rows = []) => {
  const availabilityGrid = document.getElementById("availabilityGrid");
  if (!availabilityGrid) return;

  if (!rows.length) {
    availabilityGrid.innerHTML =
      '<article class="glass-card card"><h3 class="h3">No Data</h3><p class="meta">No live availability records found</p></article>';
    return;
  }

  availabilityGrid.innerHTML = rows
    .map(
      (row) => `
      <article class="glass-card card">
        <h3 class="h3">${row.blood_group}</h3>
        <p class="meta">${row.available_donors} eligible donors</p>
      </article>`
    )
    .join("");
};

const loadLandingData = async () => {
  try {
    const endpoints = ["/api/public/landing", "http://localhost:5000/api/public/landing"];
    let data = null;

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, { cache: "no-store" });
        if (!response.ok) continue;
        data = await response.json();
        break;
      } catch (error) {
        // Try the next endpoint.
      }
    }

    if (!data) throw new Error("Failed to load landing data");

    animateCounter("#counterDonors", data.counters?.donors ?? defaultCounters.donors);
    animateCounter("#counterDonations", data.counters?.donations ?? defaultCounters.donations);
    animateCounter("#counterRequests", data.counters?.activeRequests ?? defaultCounters.activeRequests);
    renderAvailability(data.bloodAvailability || []);

    const campEndpoints = ["/api/public/camps", "http://localhost:5000/api/public/camps"];
    let camps = [];
    for (const endpoint of campEndpoints) {
      try {
        const response = await fetch(endpoint, { cache: "no-store" });
        if (!response.ok) continue;
        camps = await response.json();
        break;
      } catch (error) {
        // Try the next endpoint.
      }
    }
    renderLandingCamps(Array.isArray(camps) ? camps : []);
  } catch (error) {
    animateCounter("#counterDonors", defaultCounters.donors);
    animateCounter("#counterDonations", defaultCounters.donations);
    animateCounter("#counterRequests", defaultCounters.activeRequests);
    renderAvailability([]);
    renderLandingCamps([]);
  }
};

loadLandingData();
