const api = {
    customers: "/api/customers",
    accounts: "/api/accounts",
    transactions: "/api/transactions",
};

async function httpJson(url, options = {}) {
    const response = await fetch(url, {
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
        ...options,
    });

    if (!response.ok) {
        let message = "Error en la solicitud";
        try {
            const errorBody = await response.json();
            message = errorBody.message || message;
        } catch (e) {
            message = response.statusText || message;
        }
        throw new Error(message);
    }

    if (response.status === 204) return null;
    return response.json();
}

function formatMoney(value) {
    return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
        minimumFractionDigits: 2,
    }).format(Number(value || 0));
}

function formatDate(value) {
    if (!value) return "-";
    return new Date(value).toLocaleString("es-MX");
}

async function fetchCustomers() {
    return httpJson(api.customers);
}

async function fetchAccounts() {
    return httpJson(api.accounts);
}

async function fetchTransactions() {
    return httpJson(api.transactions);
}

async function createCustomer(payload) {
    return httpJson(api.customers, {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

async function createAccount(payload) {
    return httpJson(api.accounts, {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

async function createTransfer(payload) {
    return httpJson(`${api.transactions}/transfer`, {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

async function createDeposit(accountId, amount) {
    return httpJson(`${api.transactions}/deposit/${accountId}`, {
        method: "POST",
        body: JSON.stringify({ amount }),
    });
}

async function createWithdraw(accountId, amount) {
    return httpJson(`${api.transactions}/withdraw/${accountId}`, {
        method: "POST",
        body: JSON.stringify({ amount }),
    });
}

async function login(customerId, password) {
    return httpJson(`${api.customers}/login`, {
        method: "POST",
        body: JSON.stringify({ customerId, password }),
    });
}

function getSessionCustomerId() {
    return sessionStorage.getItem('customerId');
}

function setSessionCustomerId(customerId) {
    sessionStorage.setItem('customerId', customerId);
}

function clearSession() {
    sessionStorage.removeItem('customerId');
}

function requireAuth() {
    if (!getSessionCustomerId()) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}