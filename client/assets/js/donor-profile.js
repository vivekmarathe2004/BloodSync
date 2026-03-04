import { bindRipple, mountSidebar, showToast } from "./components/ui.js";
import { api } from "./modules/api.js";

mountSidebar("sidebarMount", "donor", "profile");
bindRipple();

document.getElementById("menuToggle")?.addEventListener("click", () => {
  document.getElementById("sidebar")?.classList.toggle("open");
});

const render = (data) => {
  const profile = data.profile || {};
  document.getElementById("profileName").value = profile.name || "";
  document.getElementById("profileBloodGroup").value = profile.blood_group || "";
  document.getElementById("profileWeight").value = profile.weight_kg || "";
  document.getElementById("profilePhone").value = profile.phone || "";
  document.getElementById("profileCity").value = profile.city || "";
  document.getElementById("preferredLocation").value = profile.preferred_location_text || "";
  document.getElementById("maxTravelKm").value = profile.max_travel_km || 25;
  document.getElementById("profilePhotoUrl").value = profile.profile_photo_url || "";
  document.getElementById("healthInfo").value = profile.health_info || "";

  const target = Number(data?.engagement?.yearlyGoalTarget || 3);
  const completed = Number(data?.engagement?.yearlyGoalCompleted || 0);
  document.getElementById("goalProgress").textContent = `${completed}/${target}`;
  document.getElementById("monthlyTopDonor").textContent = data?.engagement?.monthlyTopDonor || "N/A";
  document.getElementById("badgeList").textContent = (data?.achievements?.badges || []).join(", ") || "-";
  const leaderboard = document.getElementById("leaderboardList");
  const rows = data?.engagement?.leaderboard || [];
  leaderboard.innerHTML = rows.length
    ? rows.map((r) => `<p>#${r.rank} ${r.name} - ${r.donations} donations</p>`).join("")
    : "<p>No leaderboard data.</p>";
};

document.getElementById("profileForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(e.target).entries());
  try {
    await api.donorUpdateProfile(payload);
    showToast("Profile updated");
    await load();
  } catch (error) {
    showToast(error.message);
  }
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
    const data = await api.donorDashboard();
    render(data);
  } catch (error) {
    showToast(error.message);
  }
};

load();
