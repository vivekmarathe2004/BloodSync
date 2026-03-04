import { bindRipple, showToast } from "./components/ui.js";
import { passwordStrength, validateEmail } from "./modules/forms.js";
import { api } from "./modules/api.js";

bindRipple();

const passwordInput = document.getElementById("password");
const meterBar = document.getElementById("meterBar");
const meterLabel = document.getElementById("meterLabel");
const authForm = document.getElementById("authForm");
const emailError = document.getElementById("emailError");
const passwordError = document.getElementById("passwordError");
const emailInput = document.getElementById("email");
const passwordToggleBtn = document.getElementById("passwordToggleBtn");

const setSectionVisibility = (section, visible, requiredNames = []) => {
  if (!section) return;
  section.hidden = !visible;
  section.querySelectorAll("input, select, textarea").forEach((field) => {
    const shouldRequire = visible && requiredNames.includes(field.name);
    field.required = shouldRequire;
    field.disabled = !visible;
    if (!visible) field.value = "";
  });
};

const syncRegisterFieldsByRole = () => {
  if (!authForm || authForm.dataset.mode !== "register") return;
  const roleField = authForm.querySelector('select[name="role"]');
  if (!roleField) return;
  const donorFields = document.getElementById("donorFields");
  const hospitalFields = document.getElementById("hospitalFields");
  const role = roleField.value;
  setSectionVisibility(donorFields, role === "donor", ["bloodGroup", "age", "gender"]);
  setSectionVisibility(hospitalFields, role === "hospital", ["hospitalName", "address"]);
};

if (passwordInput && meterBar && meterLabel) {
  passwordInput.addEventListener("input", (e) => {
    const s = passwordStrength(e.target.value);
    meterBar.style.width = s.width;
    meterBar.style.background = s.color;
    meterLabel.textContent = s.label;
  });
}

if (authForm) {
  if (passwordToggleBtn && passwordInput) {
    passwordToggleBtn.addEventListener("click", () => {
      const isHidden = passwordInput.type === "password";
      passwordInput.type = isHidden ? "text" : "password";
      passwordToggleBtn.textContent = isHidden ? "Hide" : "Show";
    });
  }

  if (authForm.dataset.mode === "register") {
    const roleField = authForm.querySelector('select[name="role"]');
    roleField?.addEventListener("change", syncRegisterFieldsByRole);
    syncRegisterFieldsByRole();
  }

  document.querySelectorAll(".fill-cred-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!emailInput || !passwordInput) return;
      emailInput.value = btn.dataset.email || "";
      passwordInput.value = btn.dataset.password || "";
      const s = passwordStrength(passwordInput.value);
      if (meterBar && meterLabel) {
        meterBar.style.width = s.width;
        meterBar.style.background = s.color;
        meterLabel.textContent = s.label;
      }
      showToast("Credentials filled");
    });
  });

  authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(authForm);
    const payload = Object.fromEntries(formData.entries());
    if (emailError) emailError.textContent = "";
    if (passwordError) passwordError.textContent = "";

    if (!validateEmail(payload.email || "")) {
      if (emailError) emailError.textContent = "Invalid email format";
      showToast("Enter a valid email");
      return;
    }
    if ((payload.password || "").length < 8) {
      if (passwordError) passwordError.textContent = "Password must be at least 8 characters";
      showToast("Password too short");
      return;
    }

    try {
      if (authForm.dataset.mode === "login") {
        const result = await api.login(payload);
        showToast("Login successful");
        if (result.user.role === "admin") window.location.href = "/pages/admin-dashboard.html";
        if (result.user.role === "donor") window.location.href = "/pages/donor-dashboard.html";
        if (result.user.role === "hospital") window.location.href = "/pages/hospital-dashboard.html";
      } else {
        await api.register(payload);
        showToast("Registered successfully");
        window.location.href = "/pages/login.html";
      }
    } catch (error) {
      showToast(error.message);
    }
  });
}
