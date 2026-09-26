async function parseResponse(response) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
        return response.json();
    }
    return response.text();
}

export async function api(path, options = {}) {
    const response = await fetch(path, {
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
        ...options
    });
    const data = await parseResponse(response);
    if (!response.ok) {
        const message = (data && data.message) || "No se pudo completar la solicitud";
        throw new Error(message);
    }
    return data;
}

export const customerApi = {
    list: () => api("/api/customers"),
    login: (payload) => api("/api/customers/login", { method: "POST", body: JSON.stringify(payload) }),
    create: (payload) => api("/api/customers", { method: "POST", body: JSON.stringify(payload) }),
    updateProfile: (customerId, payload) =>
        api(`/api/customers/${encodeURIComponent(customerId)}/profile`, { method: "PUT", body: JSON.stringify(payload) })
};

export const accountApi = {
    byCustomer: (customerId) => api(`/api/accounts/customer/${encodeURIComponent(customerId)}`),
    create: (payload) => api("/api/accounts", { method: "POST", body: JSON.stringify(payload) })
};

export const transactionApi = {
    list: () => api("/api/transactions"),
    transfer: (payload) => api("/api/transactions/transfer", { method: "POST", body: JSON.stringify(payload) }),
    deposit: (accountId, amount) =>
        api(`/api/transactions/deposit/${accountId}`, { method: "POST", body: JSON.stringify({ amount }) }),
    withdraw: (accountId, amount) =>
        api(`/api/transactions/withdraw/${accountId}`, { method: "POST", body: JSON.stringify({ amount }) })
};

export const savingsApi = {
    goals: (customerId) => api(`/api/savings/goals/${encodeURIComponent(customerId)}`),
    createGoal: (customerId, payload) =>
        api(`/api/savings/goals/${encodeURIComponent(customerId)}`, { method: "POST", body: JSON.stringify(payload) }),
    addFunds: (goalId, amount) =>
        api(`/api/savings/goals/${goalId}/add-funds`, { method: "POST", body: JSON.stringify({ amount }) }),
    toggleRoundup: (customerId, enabled) =>
        api(`/api/savings/roundup/${encodeURIComponent(customerId)}`, { method: "PUT", body: JSON.stringify({ enabled }) })
};

export const adminApi = {
    login: (payload) => api("/api/admin/login", { method: "POST", body: JSON.stringify(payload) }),
    stats: () => api("/api/admin/stats"),
    customers: () => api("/api/admin/customers"),
    lockCustomer: (id) => api(`/api/admin/customers/${id}/lock`, { method: "POST" }),
    unlockCustomer: (id) => api(`/api/admin/customers/${id}/unlock`, { method: "POST" }),
    resetPassword: (id, payload) =>
        api(`/api/admin/customers/${id}/reset-password`, { method: "POST", body: JSON.stringify(payload) })
};
