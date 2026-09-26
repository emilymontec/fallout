import {
    adminSession,
    clearAdminSession,
    clearCustomerSession,
    customerSession,
    saveFlash
} from "./state.js";
import { renderLayout } from "./ui.js";
import { renderAdminPanel, renderAdminTransactions, renderAdminUsers } from "./views/admin.js";
import {
    renderAccounts,
    renderCards,
    renderDashboard,
    renderMovements,
    renderProfile,
    renderSavings,
    renderTransfers
} from "./views/customer.js";
import { renderAdminLogin, renderCustomerLogin, renderPublicHome, renderRegister } from "./views/public.js";

function redirect(path) {
    window.location.href = path;
}

function guardCustomer() {
    const session = customerSession();
    if (!session) {
        saveFlash("error", "Inicia sesion para continuar.");
        redirect("/login");
        return null;
    }
    return session;
}

function guardAdmin() {
    const session = adminSession();
    if (!session) {
        saveFlash("error", "Inicia sesion de administrador.");
        redirect("/admin");
        return null;
    }
    return session;
}

function attachLogoutHandlers() {
    const customerLogout = document.getElementById("logout-customer");
    if (customerLogout) {
        customerLogout.addEventListener("click", () => {
            clearCustomerSession();
            saveFlash("success", "Sesion cerrada.");
            redirect("/inicio");
        });
    }
    const adminLogout = document.getElementById("logout-admin");
    if (adminLogout) {
        adminLogout.addEventListener("click", () => {
            clearAdminSession();
            saveFlash("success", "Sesion administrativa finalizada.");
            redirect("/inicio");
        });
    }
}

const routes = {
    "/inicio": renderPublicHome,
    "/login": renderCustomerLogin,
    "/registro": renderRegister,
    "/dashboard": async () => {
        const session = guardCustomer();
        if (session) await renderDashboard(session);
    },
    "/cuentas": async () => {
        const session = guardCustomer();
        if (session) await renderAccounts(session);
    },
    "/transferencias": async () => {
        const session = guardCustomer();
        if (session) await renderTransfers(session);
    },
    "/movimientos": async () => {
        const session = guardCustomer();
        if (session) await renderMovements(session);
    },
    "/ahorro": async () => {
        const session = guardCustomer();
        if (session) await renderSavings(session);
    },
    "/perfil": async () => {
        const session = guardCustomer();
        if (session) await renderProfile(session);
    },
    "/tarjetas": async () => {
        const session = guardCustomer();
        if (session) await renderCards(session);
    },
    "/admin": async () => {
        const admin = adminSession();
        if (!admin) {
            renderAdminLogin();
            return;
        }
        await renderAdminPanel(admin);
    },
    "/admin/monitoreo": async () => {
        const admin = guardAdmin();
        if (admin) await renderAdminTransactions(admin);
    },
    "/admin/usuarios": async () => {
        const admin = guardAdmin();
        if (admin) await renderAdminUsers(admin);
    }
};

async function bootstrap() {
    let path = window.location.pathname;
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    if (path === "/") {
        redirect("/inicio");
        return;
    }

    const handler = routes[path] || renderPublicHome;
    try {
        await handler();
        attachLogoutHandlers();
    } catch (error) {
        renderLayout({
            nav: '<a href="/inicio">Inicio</a>',
            body: `<section class="card"><h2>Error</h2><p class="muted">${error.message || "Error inesperado"}</p></section>`
        });
    }
}

bootstrap();
