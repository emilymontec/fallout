import { consumeFlash } from "./state.js";

const app = document.getElementById("app");

export function escapeHtml(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export function formatMoney(value) {
    return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN"
    }).format(Number(value || 0));
}

export function formatDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat("es-MX", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    }).format(date);
}

export function initialsFromName(name) {
    if (!name) return "AB";
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "AB";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function navLinks(items, currentPath) {
    return items
        .map(([path, label]) => `<a class="${path === currentPath ? "active" : ""}" href="${path}">${label}</a>`)
        .join("");
}

export function customerNav(currentPath) {
    return navLinks(
        [
            ["/dashboard", "Dashboard"],
            ["/cuentas", "Cuentas"],
            ["/transferencias", "Transferencias"],
            ["/movimientos", "Movimientos"],
            ["/ahorro", "Ahorro"],
            ["/perfil", "Perfil"],
            ["/tarjetas", "Tarjetas"]
        ],
        currentPath
    );
}

export function adminNav(currentPath) {
    return navLinks(
        [
            ["/admin", "Panel"],
            ["/admin/monitoreo", "Monitoreo"],
            ["/admin/usuarios", "Usuarios"]
        ],
        currentPath
    );
}

export function renderLayout(config) {
    const flash = config.flash || consumeFlash();
    const flashHtml = flash ? `<div class="flash ${flash.type}">${escapeHtml(flash.message)}</div>` : "";
    const layoutClass = config.layoutClass ? ` ${config.layoutClass}` : "";
    const headerClass = config.headerClass ? ` ${config.headerClass}` : "";

    app.innerHTML = `<div class="layout${layoutClass}">
        <header class="topbar${headerClass}">
            <a class="brand" href="/inicio">AtlasBank</a>
            <nav class="nav">${config.nav || ""}</nav>
        </header>
        ${flashHtml}
        ${config.body || ""}
    </div>`;
}

export function renderStandalone(body, flash) {
    const resolvedFlash = flash || consumeFlash();
    const flashHtml = resolvedFlash ? `<div class="flash ${resolvedFlash.type}">${escapeHtml(resolvedFlash.message)}</div>` : "";
    app.innerHTML = `${flashHtml}${body}`;
}

export function customerShell(title, path, session, bodyHtml) {
    renderLayout({
        nav: `${customerNav(path)}<button id="logout-customer">Salir</button>`,
        layoutClass: "layout-customer",
        body: `<section class="shell-head">
            <div>
                <p class="ref">[ CLIENT CORE ]</p>
                <h2>${escapeHtml(title)}</h2>
                <p class="muted">Banca digital segura y modular.</p>
            </div>
            <div class="user-chip">
                <span class="avatar">${escapeHtml(initialsFromName(session.fullName || session.customerId))}</span>
                <div>
                    <strong>${escapeHtml(session.fullName || session.customerId)}</strong>
                    <p class="muted">ID ${escapeHtml(session.customerId || "-")}</p>
                </div>
            </div>
        </section>${bodyHtml}`
    });
}

export function adminShell(title, path, role, bodyHtml) {
    renderLayout({
        nav: `${adminNav(path)}<button id="logout-admin">Salir</button>`,
        layoutClass: "layout-admin",
        headerClass: "topbar-admin",
        body: `<section class="shell-head admin-shell-head">
            <div>
                <p class="ref">[ ADMIN CORE ]</p>
                <h2>${escapeHtml(title)}</h2>
                <p class="muted">Control operativo y prevención de riesgo.</p>
            </div>
            <div class="user-chip">
                <span class="avatar">AD</span>
                <div>
                    <strong>Administrador</strong>
                    <p class="muted">Rol ${escapeHtml(role || "N/A")}</p>
                </div>
            </div>
        </section>${bodyHtml}`
    });
}

export function statusPill(status) {
    const normalized = String(status || "N/A").toUpperCase();
    const mapped = normalized === "ACTIVE" ? "Activo" : normalized === "LOCKED" ? "Bloqueado" : normalized;
    const cssClass = normalized === "ACTIVE" ? "pill-success" : normalized === "LOCKED" ? "pill-danger" : "pill-neutral";
    return `<span class="pill ${cssClass}">${escapeHtml(mapped)}</span>`;
}

export function tableHtml(headers, rowsHtml) {
    const head = headers.map((label) => `<th>${escapeHtml(label)}</th>`).join("");
    return `<table><thead><tr>${head}</tr></thead><tbody>${rowsHtml}</tbody></table>`;
}
