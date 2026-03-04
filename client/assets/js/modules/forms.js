export const passwordStrength = (password) => {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 1) return { label: "Weak", width: "25%", color: "#e63946" };
  if (score <= 2) return { label: "Medium", width: "50%", color: "#f4a261" };
  if (score <= 3) return { label: "Strong", width: "75%", color: "#2a9d8f" };
  return { label: "Very Strong", width: "100%", color: "#1f8b7a" };
};

export const validateEmail = (email) => /\S+@\S+\.\S+/.test(email);
