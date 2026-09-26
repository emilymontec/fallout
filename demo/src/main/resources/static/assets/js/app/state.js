const CUSTOMER_SESSION_KEY = "atlasbank.customer.session";
const ADMIN_SESSION_KEY = "atlasbank.admin.session";
const FLASH_KEY = "atlasbank.flash.message";

function readStorage(key) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        return null;
    }
}

function writeStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

export function customerSession() {
    return readStorage(CUSTOMER_SESSION_KEY);
}

export function adminSession() {
    return readStorage(ADMIN_SESSION_KEY);
}

export function saveCustomerSession(payload) {
    writeStorage(CUSTOMER_SESSION_KEY, payload);
}

export function saveAdminSession(payload) {
    writeStorage(ADMIN_SESSION_KEY, payload);
}

export function clearCustomerSession() {
    localStorage.removeItem(CUSTOMER_SESSION_KEY);
}

export function clearAdminSession() {
    localStorage.removeItem(ADMIN_SESSION_KEY);
}

export function saveFlash(type, message) {
    writeStorage(FLASH_KEY, { type, message });
}

export function consumeFlash() {
    const flash = readStorage(FLASH_KEY);
    localStorage.removeItem(FLASH_KEY);
    return flash;
}
