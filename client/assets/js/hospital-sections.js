import { bindRipple, closeModal, mountSidebar, openModal, showToast } from "./components/ui.js";
import { api, resolveApiDownloadUrl } from "./modules/api.js";

const page = document.body.dataset.page || "dashboard";

mountSidebar("sidebarMount", "hospital", page);
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

const renderSimpleBadge = (text, tone = "normal") => `<span class="badge ${tone}">${text}</span>`;

const loadHospitalProfile = async (form) => {
  try {
    const profile = await api.hospitalProfile();
    const assign = (name, value) => {
      const el = form.querySelector(`[name="${name}"]`);
      if (el) el.value = value || "";
    };
    assign("hospitalName", profile.hospital_name);
    assign("address", profile.address);
    assign("city", profile.city);
    assign("state", profile.state);
    assign("contactPhone", profile.contact_phone || profile.phone);
    assign("contactEmail", profile.contact_email || profile.email);
    assign("logoUrl", profile.logo_url);
    assign("operatingHours", profile.operating_hours_text);
    assign("bloodBankLicenseNumber", profile.blood_bank_license_number);
    assign("latitude", profile.latitude);
    assign("longitude", profile.longitude);

    const status = document.getElementById("verificationStatus");
    if (status) {
      status.innerHTML = renderSimpleBadge(profile.verification_status_text || "pending", profile.verification_status_text === "verified" ? "normal" : "urgent");
    }
  } catch (error) {
    showToast(error.message);
  }
};

const renderProfilePage = async () => {
  const form = document.getElementById("hospitalProfileForm");
  if (!form) return;
  await loadHospitalProfile(form);
  if (form.dataset.boundSubmit === "1") return;
  form.dataset.boundSubmit = "1";
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      await api.hospitalUpdateProfile(payload);
      showToast("Profile updated");
      await loadHospitalProfile(form);
    } catch (error) {
      showToast(error.message);
    }
  });
};

const renderRequestsPage = async () => {
  const listBody = document.getElementById("hospitalRequestsBody");
  const createForm = document.getElementById("hospitalCreateRequestForm");
  if (!listBody || !createForm) return;

  const loadRequests = async () => {
    try {
      const rows = await api.hospitalRequests();
      if (!rows.length) {
        listBody.innerHTML = '<tr><td colspan="9">No requests found.</td></tr>';
        return;
      }
      listBody.innerHTML = rows
        .map(
          (r) => `<tr>
        <td>${r.id}</td>
        <td>${r.blood_group}</td>
        <td>${r.units}</td>
        <td>${r.urgency}</td>
        <td>${r.city}</td>
        <td>${r.status_api || r.status}</td>
        <td>${r.required_by_date ? new Date(r.required_by_date).toLocaleString() : "-"}</td>
        <td>${r.notes_text || "-"}</td>
        <td>
          <div class="btn-group">
            <button class="btn btn-secondary req-status-btn" data-id="${r.id}" data-status="matched">Mark Matched</button>
            <button class="btn btn-secondary req-status-btn" data-id="${r.id}" data-status="completed">Mark Completed</button>
            <button class="btn btn-secondary req-duplicate-btn" data-id="${r.id}">Duplicate</button>
            <button class="btn btn-danger req-cancel-btn" data-id="${r.id}">Cancel</button>
          </div>
        </td>
      </tr>`
        )
        .join("");

      document.querySelectorAll(".req-status-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          try {
            await api.hospitalUpdateRequestStatus(btn.dataset.id, btn.dataset.status);
            showToast("Request updated");
            await loadRequests();
          } catch (error) {
            showToast(error.message);
          }
        });
      });
      document.querySelectorAll(".req-cancel-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          try {
            await api.hospitalCancelRequest(btn.dataset.id);
            showToast("Request cancelled");
            await loadRequests();
          } catch (error) {
            showToast(error.message);
          }
        });
      });
      document.querySelectorAll(".req-duplicate-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          try {
            await api.hospitalDuplicateRequest(btn.dataset.id);
            showToast("Request duplicated");
            await loadRequests();
          } catch (error) {
            showToast(error.message);
          }
        });
      });
    } catch (error) {
      showToast(error.message);
    }
  };

  createForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(createForm).entries());
    payload.units = Number(payload.units);
    try {
      await api.createHospitalRequest(payload);
      showToast("Request created");
      createForm.reset();
      await loadRequests();
    } catch (error) {
      showToast(error.message);
    }
  });

  await loadRequests();
};

const renderAppointmentsPage = async () => {
  const body = document.getElementById("hospitalAppointmentsBody");
  if (!body) return;
  const rescheduleForm = document.getElementById("rescheduleAppointmentForm");
  const closeRescheduleBtn = document.getElementById("closeRescheduleAppointmentModal");
  if (closeRescheduleBtn && !closeRescheduleBtn.dataset.bound) {
    closeRescheduleBtn.dataset.bound = "1";
    closeRescheduleBtn.addEventListener("click", () => closeModal("rescheduleAppointmentModal"));
  }
  if (rescheduleForm && !rescheduleForm.dataset.bound) {
    rescheduleForm.dataset.bound = "1";
    rescheduleForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = Object.fromEntries(new FormData(rescheduleForm).entries());
      const appointmentId = payload.appointmentId;
      delete payload.appointmentId;
      try {
        await api.hospitalUpdateAppointment(appointmentId, { slotAt: payload.slotAt, status: "rescheduled" });
        showToast("Appointment rescheduled");
        closeModal("rescheduleAppointmentModal");
        await renderAppointmentsPage();
      } catch (error) {
        showToast(error.message);
      }
    });
  }
  try {
    const rows = await api.hospitalAppointments();
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="8">No appointments found.</td></tr>';
      return;
    }
    body.innerHTML = rows
      .map(
        (a) => `<tr>
      <td>${a.id}</td>
      <td>${a.donor_name || "-"}</td>
      <td>${a.blood_group || "-"}</td>
      <td>${a.city || "-"}</td>
      <td>${new Date(a.slot_at).toLocaleString()}</td>
      <td>${a.status}</td>
      <td>${a.notes || "-"}</td>
      <td>
        <div class="btn-group">
          <button class="btn btn-secondary appt-reschedule-btn" data-id="${a.id}" data-slot="${new Date(a.slot_at).toISOString()}">Reschedule</button>
          <button class="btn btn-secondary appt-status-btn" data-id="${a.id}" data-status="confirmed">Arrived</button>
          <button class="btn btn-secondary appt-status-btn" data-id="${a.id}" data-status="completed">Completed</button>
          <button class="btn btn-danger appt-status-btn" data-id="${a.id}" data-status="cancelled">Cancel</button>
        </div>
      </td>
    </tr>`
      )
      .join("");

    document.querySelectorAll(".appt-status-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await api.hospitalUpdateAppointment(btn.dataset.id, { status: btn.dataset.status });
          showToast("Appointment updated");
          await renderAppointmentsPage();
        } catch (error) {
          showToast(error.message);
        }
      });
    });
    document.querySelectorAll(".appt-reschedule-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idField = document.getElementById("rescheduleAppointmentId");
        const slotField = document.getElementById("rescheduleSlotAt");
        if (!idField || !slotField) return;
        idField.value = btn.dataset.id;
        const currentSlot = btn.dataset.slot ? new Date(btn.dataset.slot) : new Date();
        const isoLocal = new Date(currentSlot.getTime() - currentSlot.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
        slotField.value = isoLocal;
        openModal("rescheduleAppointmentModal");
      });
    });
  } catch (error) {
    showToast(error.message);
  }
};

const renderInventoryPage = async () => {
  const adjustForm = document.getElementById("hospitalStockAdjustForm");
  const stockBody = document.getElementById("hospitalStockBody");
  const txBody = document.getElementById("hospitalStockTxBody");
  const alerts = document.getElementById("hospitalLowStockAlerts");
  if (!adjustForm || !stockBody || !txBody || !alerts) return;

  document.getElementById("hospitalExportStockBtn")?.addEventListener("click", () => {
    window.open(resolveApiDownloadUrl("/api/hospital/stock/transactions/export"), "_blank");
  });

  adjustForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(adjustForm).entries());
    payload.deltaUnits = Number(payload.deltaUnits);
    payload.thresholdUnits = Number(payload.thresholdUnits || 0);
    try {
      await api.hospitalAdjustStock(payload);
      showToast("Stock adjusted");
      adjustForm.reset();
      await renderInventoryPage();
    } catch (error) {
      showToast(error.message);
    }
  });

  try {
    const data = await api.hospitalDashboard();
    const stock = data.stock || [];
    stockBody.innerHTML = stock.length
      ? stock
          .map(
            (s) => `<tr>
        <td>${s.blood_group}</td>
        <td>${s.units_available}</td>
        <td>${s.threshold_units}</td>
        <td>${Number(s.units_available) <= Number(s.threshold_units) ? renderSimpleBadge("Low", "urgent") : renderSimpleBadge("Healthy", "normal")}</td>
      </tr>`
          )
          .join("")
      : '<tr><td colspan="4">No stock records found.</td></tr>';

    const low = data.lowStockAlerts || [];
    alerts.innerHTML = low.length
      ? low.map((a) => `<span class="badge urgent" style="margin-right:8px;">${a.blood_group} (${a.units_available}/${a.threshold_units})</span>`).join("")
      : renderSimpleBadge("No low stock alerts", "normal");

    const tx = data.stockTransactions || [];
    txBody.innerHTML = tx.length
      ? tx
          .map(
            (t) => `<tr>
        <td>${new Date(Number(t.created_at_ts) * 1000).toLocaleString()}</td>
        <td>${t.blood_group}</td>
        <td>${t.action_text}</td>
        <td>${t.units_changed > 0 ? `+${t.units_changed}` : t.units_changed}</td>
        <td>${t.units_before}</td>
        <td>${t.units_after}</td>
        <td>${t.notes_text || "-"}</td>
      </tr>`
          )
          .join("")
      : '<tr><td colspan="7">No stock transactions found.</td></tr>';
  } catch (error) {
    showToast(error.message);
  }
};

const renderAnalyticsPage = async () => {
  const activeEl = document.getElementById("anaActiveRequests");
  if (!activeEl) return;
  try {
    const data = await api.hospitalDashboard();
    const analytics = data.analytics || {};
    document.getElementById("anaActiveRequests").textContent = analytics.activeRequestsCount ?? 0;
    document.getElementById("anaTotalDonations").textContent = analytics.totalDonationsReceived ?? 0;
    document.getElementById("anaMonthlyUnits").textContent = analytics.monthlyUnitsCollected ?? 0;
    document.getElementById("anaEmergency").textContent = analytics.emergencyRequestsCount ?? 0;
    document.getElementById("anaFulfillment").textContent = `${analytics.requestFulfillmentPercentage ?? 0}%`;

    const urgentPanel = document.getElementById("urgentAttentionPanel");
    const urgentCritical = data.urgentAttention?.criticalOpenRequests || [];
    const urgentStock = data.urgentAttention?.lowStockAlerts || [];
    urgentPanel.innerHTML = `
      <div class="meta">Critical open requests: ${urgentCritical.length}</div>
      <div class="meta">Low stock groups: ${urgentStock.length}</div>
    `;

    if (window.Chart) {
      const demandCanvas = document.getElementById("hospitalDemandChart");
      if (demandCanvas) {
        const demand = analytics.bloodGroupDemandDistribution || [];
        new Chart(demandCanvas, {
          type: "bar",
          data: {
            labels: demand.map((d) => d.blood_group),
            datasets: [{ label: "Demand", data: demand.map((d) => Number(d.count || 0)), backgroundColor: "#e63946" }],
          },
          options: { responsive: true, plugins: { legend: { display: false } } },
        });
      }

      const trendCanvas = document.getElementById("hospitalDonationTrendChart");
      if (trendCanvas) {
        const trend = analytics.donationTrend || [];
        new Chart(trendCanvas, {
          type: "line",
          data: {
            labels: trend.map((d) => d.month),
            datasets: [{ label: "Units", data: trend.map((d) => Number(d.units || 0)), borderColor: "#2a9d8f", tension: 0.25 }],
          },
          options: { responsive: true },
        });
      }
    }
  } catch (error) {
    showToast(error.message);
  }
};

const renderDashboardPage = async () => {
  try {
    const data = await api.hospitalDashboard();
    document.getElementById("dashHospitalName").textContent = data.hospital?.hospital_name || "Hospital";
    document.getElementById("dashActiveRequests").textContent = data.analytics?.activeRequestsCount ?? 0;
    document.getElementById("dashEmergency").textContent = data.analytics?.emergencyRequestsCount ?? 0;
    document.getElementById("dashLowStock").textContent = (data.lowStockAlerts || []).length;
    document.getElementById("dashRequestsLink").href = "/hospital/requests.html";
    document.getElementById("dashInventoryLink").href = "/hospital/inventory.html";
    document.getElementById("dashAppointmentsLink").href = "/hospital/appointments.html";
  } catch (error) {
    showToast(error.message);
  }
};

const init = async () => {
  if (page === "profile") return renderProfilePage();
  if (page === "requests") return renderRequestsPage();
  if (page === "appointments") return renderAppointmentsPage();
  if (page === "inventory") return renderInventoryPage();
  if (page === "analytics") return renderAnalyticsPage();
  if (page === "dashboard") return renderDashboardPage();
};

init();
