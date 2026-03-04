export const mountNavbar = (targetId, role = "guest") => {
  const target = document.getElementById(targetId);
  if (!target) return;

  const linksByRole = {
    guest: [
      { href: "/camps.html", label: "Camps" },
      { href: "/pages/login.html", label: "Login" },
      { href: "/pages/register.html", label: "Register" },
    ],
    donor: [
      { href: "/pages/donor-dashboard.html", label: "Dashboard" },
      { href: "/pages/login.html", label: "Logout" },
    ],
    hospital: [
      { href: "/pages/hospital-dashboard.html", label: "Dashboard" },
      { href: "/pages/login.html", label: "Logout" },
    ],
    admin: [
      { href: "/pages/admin-dashboard.html", label: "Dashboard" },
      { href: "/pages/login.html", label: "Logout" },
    ],
  };

  target.innerHTML = `
    <header class="navbar">
      <div class="container navbar-inner">
        <a class="brand" href="/">
          <span class="brand-pill">O-</span>
          BloodSync
        </a>
        <nav class="nav-links">
          ${linksByRole[role]
            .map((item) => `<a href="${item.href}" class="meta">${item.label}</a>`)
            .join("")}
        </nav>
      </div>
    </header>
  `;
};

export const mountFooter = (targetId = "footerMount") => {
  let target = document.getElementById(targetId);
  if (!target) {
    target = document.createElement("div");
    target.id = targetId;
    document.body.appendChild(target);
  }

  target.innerHTML = `
    <footer class="site-footer">
      <div class="footer-glow"></div>
      <div class="footer-top">
        <div class="footer-brand">
          <span class="footer-pill">O-</span>
          <div>
            <h3>BloodSync</h3>
            <p>Live blood donation coordination platform</p>
          </div>
        </div>
      </div>
      <div class="footer-main">
        <section>
          <h4>About</h4>
          <p>BloodSync connects blood donors with hospitals in real time to save lives efficiently.</p>
        </section>
        <section>
          <h4>Quick Links</h4>
          <a href="/pages/login.html">Login</a>
          <a href="/pages/register.html">Register</a>
          <a href="/pages/donor-dashboard.html">Dashboard</a>
          <a href="/pages/hospital-dashboard.html">Requests</a>
        </section>
        <section>
          <h4>Support</h4>
          <a href="#">Eligibility Rules</a>
          <a href="#">Blood Group Info</a>
          <a href="#">Contact Us</a>
          <a href="#">FAQs</a>
        </section>
        <section>
          <h4>Legal</h4>
          <a href="#">Privacy Policy</a>
          <a href="#">Terms &amp; Conditions</a>
          <a href="#">Data Policy</a>
        </section>
      </div>
      <div class="footer-strip">
        <span>&copy; 2026 BloodSync. All rights reserved.</span>
        <span>Made by Vivek Marathe | BBA-CA Project | <a href="#" aria-label="Version">v1.0</a> | <a href="#">GitHub</a></span>
      </div>
    </footer>
  `;
};

export const mountSidebar = (targetId, role = "donor", active = "dashboard") => {
  const target = document.getElementById(targetId);
  if (!target) return;

  const menuByRole = {
    admin: [
      { key: "dashboard", label: "Dashboard", href: "/pages/admin-dashboard.html?tab=dashboard" },
      { key: "users", label: "Users", href: "/admin/users.html" },
      { key: "camps", label: "Camps", href: "/admin/camps.html" },
      { key: "requests", label: "Requests", href: "/pages/admin-dashboard.html?tab=requests" },
      { key: "history", label: "History", href: "/pages/admin-dashboard.html?tab=history" },
      { key: "activity", label: "Activity", href: "/pages/admin-dashboard.html?tab=activity" },
      { key: "settings", label: "Settings", href: "/pages/admin-dashboard.html?tab=settings" },
      { key: "logout", label: "Logout", href: "#", action: "logout" },
    ],
    donor: [
      { key: "dashboard", label: "Dashboard", href: "/pages/donor-dashboard.html" },
      { key: "requests", label: "Requests", href: "/donor/requests.html" },
      { key: "profile", label: "Profile", href: "/donor/profile.html" },
      { key: "history", label: "History", href: "/donor/history.html" },
      { key: "appointments", label: "Appointments", href: "/donor/appointments.html" },
      { key: "notifications", label: "Notifications", href: "/donor/notifications.html" },
      { key: "camps", label: "Camps", href: "/donor/camps.html" },
      { key: "logout", label: "Logout", href: "#", action: "logout" },
    ],
    hospital: [
      { key: "dashboard", label: "Dashboard", href: "/pages/hospital-dashboard.html" },
      { key: "profile", label: "Profile", href: "/hospital/profile.html" },
      { key: "requests", label: "Requests", href: "/hospital/requests.html" },
      { key: "appointments", label: "Appointments", href: "/hospital/appointments.html" },
      { key: "inventory", label: "Inventory", href: "/hospital/inventory.html" },
      { key: "analytics", label: "Analytics", href: "/hospital/analytics.html" },
      { key: "camps", label: "Camps", href: "/hospital/camps.html" },
      { key: "logout", label: "Logout", href: "#", action: "logout" },
    ],
  };

  const menu = menuByRole[role] || menuByRole.donor;

  target.innerHTML = `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-inner">
        <div class="brand">
          <span class="brand-pill">${role.slice(0, 1).toUpperCase()}</span>
          ${role} Panel
        </div>
        <div class="menu">
          ${menu
            .map(
              (item) =>
                `<a href="${item.href}" data-key="${item.key}" ${item.tab ? `data-tab="${item.tab}"` : ""} ${
                  item.action ? `data-action="${item.action}"` : ""
                } class="${active === item.key ? "active" : ""}">${item.label}</a>`
            )
            .join("")}
        </div>
      </div>
    </aside>
  `;
};

const MAX_TOASTS = 4;
const toastRegistry = new Map();

export const showToast = (message, options = 2400) => {
  if (!message) return;

  const normalized = typeof options === "number" ? { timeout: options } : options || {};
  const { timeout = 2400, type = "info", dedupe = true } = normalized;
  const key = `${type}:${message}`;

  let stack = document.querySelector(".toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    stack.setAttribute("role", "status");
    stack.setAttribute("aria-live", "polite");
    document.body.appendChild(stack);
  }

  if (dedupe && toastRegistry.has(key)) {
    const entry = toastRegistry.get(key);
    entry.count += 1;
    entry.label.textContent = `${message} (${entry.count})`;
    clearTimeout(entry.timer);
    entry.timer = setTimeout(entry.remove, timeout);
    return;
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  const label = document.createElement("span");
  label.className = "toast-label";
  label.textContent = message;
  toast.appendChild(label);

  const remove = () => {
    toast.classList.add("toast-exit");
    setTimeout(() => toast.remove(), 180);
    toastRegistry.delete(key);
  };
  toast.dataset.toastKey = key;

  stack.appendChild(toast);

  if (stack.children.length > MAX_TOASTS) {
    const oldest = stack.firstElementChild;
    if (oldest) {
      const oldestKey = oldest.dataset.toastKey;
      if (oldestKey && toastRegistry.has(oldestKey)) {
        clearTimeout(toastRegistry.get(oldestKey).timer);
        toastRegistry.delete(oldestKey);
      }
      oldest.remove();
    }
  }

  const timer = setTimeout(remove, timeout);
  toastRegistry.set(key, { count: 1, timer, remove, label });
};

export const bindRipple = () => {
  document.querySelectorAll(".btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const rect = btn.getBoundingClientRect();
      btn.style.setProperty("--ripple-x", `${e.clientX - rect.left}px`);
      btn.style.setProperty("--ripple-y", `${e.clientY - rect.top}px`);
    });
  });
};

export const openModal = (id) => document.getElementById(id)?.classList.add("open");
export const closeModal = (id) => document.getElementById(id)?.classList.remove("open");

export const renderSkeletonRows = (tbodyId, cols = 5, rows = 5) => {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = "";
  for (let r = 0; r < rows; r += 1) {
    const tr = document.createElement("tr");
    for (let c = 0; c < cols; c += 1) {
      const td = document.createElement("td");
      td.innerHTML = `<div class="skeleton"></div>`;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
};
