import { bindRipple, mountNavbar, showToast } from "./components/ui.js";
import { api } from "./modules/api.js";

mountNavbar("navbarMount", "guest");
bindRipple();

const grid = document.getElementById("publicCampsGrid");
const formatCampDateRange = (camp) => {
  const start = camp.start_date_text || camp.camp_date_text || "";
  const end = camp.end_date_text || start;
  if (!start) return "-";
  return start === end ? start : `${start} to ${end}`;
};

const render = (camps) => {
  if (!grid) return;
  if (!camps.length) {
    grid.innerHTML = '<article class="glass-card card"><h3 class="h3">No camps</h3><p class="meta">No upcoming camps found.</p></article>';
    return;
  }

  grid.innerHTML = camps
    .map(
      (camp) => `
    <article class="glass-card card">
      <h3 class="h3">${camp.camp_name}</h3>
      <p class="meta">${camp.location_text}</p>
      <p class="meta">${formatCampDateRange(camp)} | ${camp.start_time_text} - ${camp.end_time_text}</p>
      <p class="meta">Organizer: ${camp.organizer_name} (${camp.organizer_role_text})</p>
      <p class="meta">Expected Donors: ${camp.expected_donors}</p>
      <p class="meta">Available Slots: ${camp.available_slots ?? camp.expected_donors}</p>
      <div class="badge normal">${camp.status_text}</div>
    </article>`
    )
    .join("");
};

const load = async () => {
  try {
    const camps = await api.publicCamps();
    render(camps);
  } catch (error) {
    showToast(error.message);
  }
};

load();
