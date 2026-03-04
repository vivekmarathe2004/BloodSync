const headers = { "Content-Type": "application/json" };

const resolveApiCandidates = (url) => {
  if (/^https?:\/\//i.test(url)) return [url];
  const candidates = [url, `http://localhost:5000${url}`];
  return [...new Set(candidates)];
};

export const resolveApiDownloadUrl = (url) => {
  if (/^https?:\/\//i.test(url)) return url;
  if (typeof window !== "undefined" && window.location && /localhost:5000|127\.0\.0\.1:5000/i.test(window.location.origin)) {
    return url;
  }
  return `http://localhost:5000${url}`;
};

const request = async (url, options = {}) => {
  let lastError = new Error("API request failed");
  const candidates = resolveApiCandidates(url);

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, {
        credentials: "include",
        headers,
        ...options,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "API request failed");
      return data;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
};

export const api = {
  login: (payload) => request("/api/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  register: (payload) => request("/api/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  donorDashboard: (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v) !== "") query.set(k, String(v));
    });
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request(`/api/donor/dashboard${suffix}`);
  },
  hospitalProfile: () => request("/api/hospital/profile"),
  hospitalUpdateProfile: (payload) => request("/api/hospital/profile", { method: "PATCH", body: JSON.stringify(payload) }),
  hospitalDashboard: () => request("/api/hospital/dashboard"),
  createHospitalRequest: (payload) =>
    request("/api/hospital/requests", { method: "POST", body: JSON.stringify(payload) }),
  hospitalUpdateRequest: (requestId, payload) =>
    request(`/api/hospital/requests/${requestId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  hospitalCancelRequest: (requestId) => request(`/api/hospital/requests/${requestId}/cancel`, { method: "POST" }),
  hospitalRepostRequest: (requestId) => request(`/api/hospital/requests/${requestId}/repost`, { method: "POST" }),
  adminDashboard: (search = "") => request(`/api/admin/dashboard?search=${encodeURIComponent(search)}`),
  adminCreateUserAdmin: (payload) => request("/api/admin/users/admin", { method: "POST", body: JSON.stringify(payload) }),
  deleteUser: (id) => request(`/api/admin/users/${id}`, { method: "DELETE" }),
  adminChangeUserRole: (id, payload) => request(`/api/admin/users/${id}/role`, { method: "PATCH", body: JSON.stringify(payload) }),
  adminBulkUserAction: (payload) => request("/api/admin/users/bulk-action", { method: "POST", body: JSON.stringify(payload) }),
  getAllRequests: () => request("/api/admin/requests"),
  getDonationHistory: () => request("/api/admin/history"),
  donorRespondToRequest: (requestId, action) =>
    request(`/api/donor/requests/${requestId}/respond`, { method: "POST", body: JSON.stringify({ action }) }),
  donorAppointments: () => request("/api/donor/appointments"),
  donorBookAppointment: (payload) =>
    request("/api/donor/appointments", { method: "POST", body: JSON.stringify(payload) }),
  donorRescheduleAppointment: (appointmentId, slotAt) =>
    request(`/api/donor/appointments/${appointmentId}/reschedule`, {
      method: "PATCH",
      body: JSON.stringify({ slotAt }),
    }),
  donorCancelAppointment: (appointmentId) =>
    request(`/api/donor/appointments/${appointmentId}/cancel`, { method: "PATCH" }),
  donorSubmitQuestionnaire: (payload) => request("/api/donor/questionnaire", { method: "POST", body: JSON.stringify(payload) }),
  donorSubmitFeedback: (payload) => request("/api/donor/feedback", { method: "POST", body: JSON.stringify(payload) }),
  donorNotifications: () => request("/api/donor/notifications"),
  donorMarkNotificationRead: (notificationId) =>
    request(`/api/donor/notifications/${notificationId}/read`, { method: "PATCH" }),
  donorMarkAllNotificationsRead: () => request("/api/donor/notifications/read-all", { method: "PATCH" }),
  donorUpdateProfile: (payload) =>
    request("/api/donor/profile", { method: "PATCH", body: JSON.stringify(payload) }),
  hospitalRequests: () => request("/api/hospital/requests"),
  hospitalUpdateRequestStatus: (requestId, status) =>
    request(`/api/hospital/requests/${requestId}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  hospitalCloneRequest: (requestId) => request(`/api/hospital/requests/${requestId}/clone`, { method: "POST" }),
  hospitalDuplicateRequest: (requestId) => request(`/api/hospital/requests/${requestId}/duplicate`, { method: "POST" }),
  hospitalAppointments: () => request("/api/hospital/appointments"),
  hospitalUpdateAppointment: (appointmentId, payload) =>
    request(`/api/hospital/appointments/${appointmentId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  hospitalBulkMessage: (payload) =>
    request("/api/hospital/bulk-message", { method: "POST", body: JSON.stringify(payload) }),
  hospitalUpsertStock: (payload) => request("/api/hospital/stock", { method: "POST", body: JSON.stringify(payload) }),
  hospitalAdjustStock: (payload) => request("/api/hospital/stock/adjust", { method: "POST", body: JSON.stringify(payload) }),
  hospitalStockTrends: (days = 30) => request(`/api/hospital/stock/trends?days=${encodeURIComponent(days)}`),
  adminSetUserStatus: (id, isActive) =>
    request(`/api/admin/users/${id}/status`, { method: "PATCH", body: JSON.stringify({ isActive }) }),
  adminSetDonorRestriction: (id, restrictionStatus) =>
    request(`/api/admin/users/${id}/restriction`, { method: "PATCH", body: JSON.stringify({ restrictionStatus }) }),
  adminActivity: () => request("/api/admin/activity"),
  adminStockTrends: (days = 30) => request(`/api/admin/stock/trends?days=${encodeURIComponent(days)}`),
  adminCreateAnnouncement: (payload) =>
    request("/api/admin/announcements", { method: "POST", body: JSON.stringify(payload) }),
  publicCamps: () => request("/api/public/camps"),
  donorUpcomingCamps: () => request("/api/donor/camps/upcoming"),
  donorRegisterCamp: (campId) => request(`/api/donor/camps/${campId}/register`, { method: "POST" }),
  donorCancelCampRegistration: (campId) => request(`/api/donor/camps/${campId}/cancel`, { method: "PATCH" }),
  donorCampRegistrations: () => request("/api/donor/camps/registrations"),
  adminCamps: () => request("/api/admin/camps"),
  adminCreateCamp: (payload) => request("/api/admin/camps", { method: "POST", body: JSON.stringify(payload) }),
  adminUpdateCamp: (campId, payload) => request(`/api/admin/camps/${campId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  adminDeleteCamp: async (campId) => {
    try {
      return await request(`/api/admin/camps/${campId}/cancel`, { method: "POST" });
    } catch (error) {
      return request(`/api/admin/camps/${campId}`, { method: "DELETE" });
    }
  },
  adminCampDashboard: (campId) => request(`/api/admin/camps/${campId}/dashboard`),
  adminCampAttendance: (campId, payload) =>
    request(`/api/admin/camps/${campId}/attendance`, { method: "POST", body: JSON.stringify(payload) }),
  adminCampsAnalytics: () => request("/api/admin/camps-analytics"),
  hospitalCamps: () => request("/api/hospital/camps"),
  hospitalCreateCamp: (payload) => request("/api/hospital/camps", { method: "POST", body: JSON.stringify(payload) }),
  hospitalUpdateCamp: (campId, payload) =>
    request(`/api/hospital/camps/${campId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  hospitalDeleteCamp: async (campId) => {
    try {
      return await request(`/api/hospital/camps/${campId}/cancel`, { method: "POST" });
    } catch (error) {
      return request(`/api/hospital/camps/${campId}`, { method: "DELETE" });
    }
  },
  hospitalCampDashboard: (campId) => request(`/api/hospital/camps/${campId}/dashboard`),
  hospitalCampAttendance: (campId, payload) =>
    request(`/api/hospital/camps/${campId}/attendance`, { method: "POST", body: JSON.stringify(payload) }),
};
