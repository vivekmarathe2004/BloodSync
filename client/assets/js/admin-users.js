import { bindRipple, closeModal, mountSidebar, openModal, showToast } from "./components/ui.js";
import { api } from "./modules/api.js";

mountSidebar("sidebarMount", "admin", "users");
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

let pendingDeleteId = null;
let dashboardCache = null;
let currentRoleFilter = "all";
const selectedUsers = new Set();

const isUserActive = (u) => Number(u.is_active) === 1 && Number(u.deleted_at_ts || 0) === 0;
const statusLabel = (u) => (isUserActive(u) ? "Active" : "Suspended");
const roleLabel = (u) => (Number(u.is_super_admin || 0) === 1 ? "super_admin" : u.role);

const syncRoleModalFields = () => {
  const nextRole = document.getElementById("nextRole")?.value;
  const donorFields = document.getElementById("donorFields");
  const hospitalFields = document.getElementById("hospitalFields");
  if (!donorFields || !hospitalFields) return;
  donorFields.style.display = nextRole === "donor" ? "block" : "none";
  hospitalFields.style.display = nextRole === "hospital" ? "block" : "none";
};

const renderUsers = (users) => {
  const filteredUsers = currentRoleFilter === "all" ? users : users.filter((u) => u.role === currentRoleFilter);
  const table = document.getElementById("usersBody");
  if (!table) return;
  table.innerHTML = filteredUsers
    .map(
      (u) => `
    <tr>
      <td><input class="select-user" data-id="${u.id}" type="checkbox" ${selectedUsers.has(String(u.id)) ? "checked" : ""} /></td>
      <td>${u.name}</td>
      <td>${u.email}</td>
      <td>${roleLabel(u)}</td>
      <td><span class="badge ${isUserActive(u) ? "normal" : "urgent"}">${statusLabel(u)}</span></td>
      <td>${u.city || "-"}</td>
      <td>
        <div class="btn-group">
          <button class="btn btn-secondary view-btn" data-id="${u.id}" style="min-width:110px">View</button>
          <button class="btn btn-secondary suspend-btn" data-id="${u.id}" data-active="${isUserActive(u) ? 1 : 0}" style="min-width:110px">
            ${isUserActive(u) ? "Suspend" : "Activate"}
          </button>
          <button class="btn btn-secondary role-btn" data-id="${u.id}" data-role="${u.role}" style="min-width:110px">Role</button>
          ${u.role === "donor" ? `<button class="btn btn-secondary restrict-btn" data-id="${u.id}" style="min-width:110px">Restriction</button>` : ""}
          <button class="btn btn-danger delete-btn" data-id="${u.id}" style="min-width:110px">Delete</button>
        </div>
      </td>
    </tr>`
    )
    .join("");

  document.querySelectorAll(".view-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const user = filteredUsers.find((u) => String(u.id) === String(btn.dataset.id));
      if (!user) return;
      const card = document.getElementById("userInfoCard");
      if (card) {
        card.innerHTML = `
          <p><strong>Name:</strong> ${user.name}</p>
          <p><strong>Email:</strong> ${user.email}</p>
          <p><strong>Role:</strong> ${roleLabel(user)}</p>
          <p><strong>Status:</strong> ${statusLabel(user)}</p>
          <p><strong>City:</strong> ${user.city || "-"}</p>
          <p><strong>Phone:</strong> ${user.phone || "-"}</p>
          <p><strong>Joined:</strong> ${user.created_at ? new Date(user.created_at).toLocaleString() : "-"}</p>
        `;
      }
      openModal("userInfoModal");
    });
  });

  document.querySelectorAll(".select-user").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) selectedUsers.add(String(checkbox.dataset.id));
      else selectedUsers.delete(String(checkbox.dataset.id));
    });
  });

  document.querySelectorAll(".suspend-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const userId = btn.dataset.id;
      const shouldActivate = Number(btn.dataset.active) !== 1;
      try {
        await api.adminSetUserStatus(userId, shouldActivate);
        showToast(shouldActivate ? "User activated" : "User suspended");
        await loadUsers();
      } catch (error) {
        showToast(error.message);
      }
    });
  });

  document.querySelectorAll(".role-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const user = filteredUsers.find((u) => String(u.id) === String(btn.dataset.id));
      if (!user) return;
      if (user.role === "admin") {
        showToast("Admin role changes are restricted.");
        return;
      }
      document.getElementById("roleUserId").value = user.id;
      document.getElementById("nextRole").value = user.role === "donor" ? "hospital" : "donor";
      syncRoleModalFields();
      openModal("roleModal");
    });
  });

  document.querySelectorAll(".restrict-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const user = filteredUsers.find((u) => String(u.id) === String(btn.dataset.id));
      if (!user) return;
      const restrictionStatus = window.prompt(
        "Set donor restriction: eligible | temporarily_not_eligible | permanently_restricted",
        "eligible"
      );
      if (!restrictionStatus) return;
      try {
        await api.adminSetDonorRestriction(user.id, restrictionStatus.trim());
        showToast("Donor restriction updated");
        await loadUsers();
      } catch (error) {
        showToast(error.message);
      }
    });
  });

  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      pendingDeleteId = btn.dataset.id;
      openModal("deleteModal");
    });
  });
};

const loadUsers = async (search = document.getElementById("searchInput")?.value || "") => {
  try {
    const data = await api.adminDashboard(search);
    dashboardCache = data;
    renderUsers(data.users || []);
  } catch (error) {
    showToast(error.message);
  }
};

const runBulkAction = async (action) => {
  if (!selectedUsers.size) {
    showToast("Select users first");
    return;
  }
  try {
    await api.adminBulkUserAction({ action, userIds: [...selectedUsers] });
    showToast("Bulk action completed");
    selectedUsers.clear();
    document.getElementById("selectAllUsers").checked = false;
    await loadUsers();
  } catch (error) {
    showToast(error.message);
  }
};

document.getElementById("searchInput")?.addEventListener("input", (e) => loadUsers(e.target.value));
document.getElementById("roleFilter")?.addEventListener("change", (e) => {
  currentRoleFilter = e.target.value;
  if (dashboardCache) renderUsers(dashboardCache.users || []);
});
document.getElementById("selectAllUsers")?.addEventListener("change", (e) => {
  const checked = e.target.checked;
  document.querySelectorAll(".select-user").forEach((input) => {
    input.checked = checked;
    if (checked) selectedUsers.add(String(input.dataset.id));
    else selectedUsers.delete(String(input.dataset.id));
  });
});
document.getElementById("bulkSuspendBtn")?.addEventListener("click", () => runBulkAction("suspend"));
document.getElementById("bulkActivateBtn")?.addEventListener("click", () => runBulkAction("activate"));
document.getElementById("bulkDeleteBtn")?.addEventListener("click", () => runBulkAction("delete"));

document.getElementById("cancelDelete")?.addEventListener("click", () => closeModal("deleteModal"));
document.getElementById("confirmDelete")?.addEventListener("click", async () => {
  if (!pendingDeleteId) return;
  try {
    await api.deleteUser(pendingDeleteId);
    showToast("User deleted");
    closeModal("deleteModal");
    await loadUsers();
  } catch (error) {
    showToast(error.message);
  }
});

document.getElementById("openAddAdminModal")?.addEventListener("click", () => openModal("addAdminModal"));
document.getElementById("closeAddAdminModal")?.addEventListener("click", () => closeModal("addAdminModal"));
document.getElementById("addAdminForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(e.target).entries());
  try {
    await api.adminCreateUserAdmin(payload);
    showToast("Admin created");
    closeModal("addAdminModal");
    e.target.reset();
    await loadUsers();
  } catch (error) {
    showToast(error.message);
  }
});

document.getElementById("closeRoleModal")?.addEventListener("click", () => closeModal("roleModal"));
document.getElementById("closeUserInfoModal")?.addEventListener("click", () => closeModal("userInfoModal"));
document.getElementById("nextRole")?.addEventListener("change", syncRoleModalFields);
document.getElementById("changeRoleForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(e.target).entries());
  const userId = payload.userId;
  delete payload.userId;
  try {
    await api.adminChangeUserRole(userId, payload);
    showToast("Role updated");
    closeModal("roleModal");
    e.target.reset();
    await loadUsers();
  } catch (error) {
    showToast(error.message);
  }
});

loadUsers();
