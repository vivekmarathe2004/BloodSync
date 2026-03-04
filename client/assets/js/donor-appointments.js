import { bindRipple, mountSidebar, showToast } from "./components/ui.js";
import { api } from "./modules/api.js";

mountSidebar("sidebarMount", "donor", "appointments");
bindRipple();

document.getElementById("menuToggle")?.addEventListener("click", () => {
  document.getElementById("sidebar")?.classList.toggle("open");
});

const renderAppointments = async () => {
  const body = document.getElementById("appointmentsBody");
  try {
    const rows = await api.donorAppointments();
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="5" class="text-center">No appointments.</td></tr>';
      return;
    }
    body.innerHTML = rows
      .map(
        (a) => `
      <tr>
        <td>${a.id}</td>
        <td>${a.hospital_name || a.hospital_id || "-"}</td>
        <td>${a.slot_at ? new Date(a.slot_at).toLocaleString() : "-"}</td>
        <td>${a.status || "-"}</td>
        <td>
          <button class="btn btn-secondary appt-res-btn" data-id="${a.id}">Reschedule</button>
          <button class="btn btn-danger appt-can-btn" data-id="${a.id}">Cancel</button>
        </td>
      </tr>`
      )
      .join("");

    document.querySelectorAll(".appt-res-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const slotAt = window.prompt("Enter new slot (YYYY-MM-DDTHH:mm)");
        if (!slotAt) return;
        try {
          await api.donorRescheduleAppointment(btn.dataset.id, slotAt);
          showToast("Appointment rescheduled");
          await renderAppointments();
        } catch (error) {
          showToast(error.message);
        }
      });
    });
    document.querySelectorAll(".appt-can-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!window.confirm("Cancel appointment?")) return;
        try {
          await api.donorCancelAppointment(btn.dataset.id);
          showToast("Appointment cancelled");
          await renderAppointments();
        } catch (error) {
          showToast(error.message);
        }
      });
    });
  } catch (error) {
    body.innerHTML = '<tr><td colspan="5" class="text-center">Failed to load appointments.</td></tr>';
    showToast(error.message);
  }
};

document.getElementById("appointmentForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(e.target).entries());
  payload.requestId = Number(payload.requestId);
  try {
    await api.donorBookAppointment(payload);
    showToast("Appointment booked");
    e.target.reset();
    await renderAppointments();
  } catch (error) {
    showToast(error.message);
  }
});

document.getElementById("screeningForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const raw = Object.fromEntries(new FormData(e.target).entries());
  const riskLevel =
    raw.fever14d === "yes" || raw.surgery6m === "yes" || raw.travelHistory === "yes" || Number(raw.hemoglobin || 0) < 12.5
      ? "medium"
      : "low";
  try {
    await api.donorSubmitQuestionnaire({ answers: raw, riskLevel });
    showToast("Screening submitted");
    e.target.reset();
  } catch (error) {
    showToast(error.message);
  }
});

document.getElementById("feedbackForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(e.target).entries());
  payload.hospitalId = Number(payload.hospitalId);
  payload.rating = Number(payload.rating);
  if (payload.donationId) payload.donationId = Number(payload.donationId);
  try {
    await api.donorSubmitFeedback(payload);
    showToast("Feedback submitted");
    e.target.reset();
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

renderAppointments();
