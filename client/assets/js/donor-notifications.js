import { bindRipple, mountSidebar, showToast } from "./components/ui.js";
import { api } from "./modules/api.js";

mountSidebar("sidebarMount", "donor", "notifications");
bindRipple();

document.getElementById("menuToggle")?.addEventListener("click", () => {
  document.getElementById("sidebar")?.classList.toggle("open");
});

const toDateText = (value) => {
  if (!value) return "-";
  if (typeof value === "string") return value.slice(0, 19).replace("T", " ");
  return value?.toISOString?.().slice(0, 19).replace("T", " ") || "-";
};

const load = async () => {
  try {
    const data = await api.donorNotifications();
    document.getElementById("unreadCount").textContent = Number(data.unreadCount || 0);
    const body = document.getElementById("notificationsBody");
    if (!data.notifications.length) {
      body.innerHTML = '<tr><td colspan="5" class="text-center">No notifications.</td></tr>';
      return;
    }
    body.innerHTML = data.notifications
      .map(
        (n) => `
      <tr>
        <td>${toDateText(n.created_at)}</td>
        <td>${n.type || "-"}</td>
        <td>${n.title || "-"}</td>
        <td>${n.message || "-"}</td>
        <td>${Number(n.is_read) === 1 ? "Read" : `<button class="btn btn-secondary notif-read-btn" data-id="${n.id}">Mark Read</button>`}</td>
      </tr>`
      )
      .join("");

    document.querySelectorAll(".notif-read-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await api.donorMarkNotificationRead(btn.dataset.id);
          await load();
        } catch (error) {
          showToast(error.message);
        }
      });
    });
  } catch (error) {
    showToast(error.message);
  }
};

document.getElementById("markAllReadBtn")?.addEventListener("click", async () => {
  try {
    await api.donorMarkAllNotificationsRead();
    showToast("All marked as read");
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

load();
