import { adminApi, transactionApi } from "../api.js";
import { adminShell, escapeHtml, formatDate, formatMoney, renderStandalone, statusPill, tableHtml } from "../ui.js";
import { saveFlash } from "../state.js";

function redirect(path) {
    window.location.href = path;
}

export async function renderAdminPanel(admin) {
    renderStandalone(`
        <header class="front-header admin-header">
            <div>BV. ADMINISTRATION / CORE_SYSTEM_v4</div>
            <div class="sys-status">ROL: ${escapeHtml(admin.role || "ADMIN")}</div>
        </header>
        <div class="admin-wrapper">
            <aside>
                <span class="menu-label">Usuarios</span>
                <a href="/admin/usuarios" class="menu-link">Directorio General</a>
                <span class="menu-label">Finanzas</span>
                <a href="/admin/monitoreo" class="menu-link">Monitor de Transacciones</a>
            </aside>
            <section class="admin-content">
                <div class="stats-grid">
                    <div class="stat-card"><small>Usuarios Totales</small><p id="stat-users">0</p></div>
                    <div class="stat-card"><small>Cuentas x Aprobar</small><p id="stat-pending">0</p></div>
                    <div class="stat-card"><small>Volumen 24h</small><p id="stat-volume">${formatMoney(0)}</p></div>
                    <div class="stat-card"><small>Alertas Riesgo</small><p id="stat-risk">0</p></div>
                </div>
                <div class="simulation-panel">
                    <h3>Simulador de Inyeccion de Capital (Sandbox)</h3>
                    <form id="admin-deposit-form" class="sim-form">
                        <input type="number" name="accountId" min="1" placeholder="ID de cuenta" required>
                        <input type="number" name="amount" min="0.01" step="0.01" placeholder="Monto" required>
                        <button class="btn-action simulate" type="submit">Ejecutar Deposito</button>
                    </form>
                </div>
            </section>
        </div>
    `);

    const stats = await adminApi.stats();
    document.getElementById("stat-users").textContent = String(stats.totalUsers || 0);
    document.getElementById("stat-pending").textContent = String(stats.pendingAccounts || 0);
    document.getElementById("stat-volume").textContent = formatMoney(stats.volume24h || 0);
    document.getElementById("stat-risk").textContent = String(stats.riskAlerts || 0);

    const form = document.getElementById("admin-deposit-form");
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const data = new FormData(form);
        try {
            await transactionApi.deposit(Number(data.get("accountId")), Number(data.get("amount")));
            saveFlash("success", "Deposito simulado correctamente.");
            redirect("/admin");
        } catch (error) {
            saveFlash("error", error.message);
            redirect("/admin");
        }
    });
}

export async function renderAdminTransactions(admin) {
    adminShell(
        "Monitoreo de Transacciones",
        "/admin/monitoreo",
        admin.role,
        `<section class="card panel"><h3>Transacciones globales</h3><div id="admin-tx-table" class="muted">Cargando...</div></section>`
    );

    const allTx = await transactionApi.list();
    const rows = allTx
        .map(
            (tx) => `<tr>
                <td>${escapeHtml(tx.type || "-")}</td>
                <td>${formatMoney(tx.amount)}</td>
                <td class="mono">${escapeHtml(tx.sourceAccount?.accountNumber || "-")}</td>
                <td class="mono">${escapeHtml(tx.targetAccount?.accountNumber || "-")}</td>
                <td>${escapeHtml(formatDate(tx.createdAt))}</td>
            </tr>`
        )
        .join("");

    document.getElementById("admin-tx-table").innerHTML = rows
        ? tableHtml(["Tipo", "Monto", "Origen", "Destino", "Fecha"], rows)
        : '<p class="muted">Sin transacciones registradas.</p>';
}

export async function renderAdminUsers(admin) {
    renderStandalone(`
        <header class="front-header admin-header">
            <div>BV. ADMINISTRATION / CORE_SYSTEM_v4</div>
            <div class="sys-status">ROL: ${escapeHtml(admin.role || "ADMIN")}</div>
        </header>
        <div class="admin-wrapper">
            <aside>
                <span class="menu-label">Usuarios</span>
                <a href="/admin/usuarios" class="menu-link">Directorio General</a>
                <a href="/admin" class="menu-link">Panel</a>
                <a href="/admin/monitoreo" class="menu-link">Transacciones</a>
            </aside>
            <section class="admin-content">
                <div class="table-section">
                    <div class="table-header"><h2>Directorio de Clientes</h2></div>
                    <div id="admin-users-table" class="muted">Cargando...</div>
                </div>
            </section>
        </div>
    `);

    const customers = await adminApi.customers();

    const rows = customers
        .map(
            (customer) => `<tr>
                <td>${escapeHtml(customer.id)}</td>
                <td>${escapeHtml(customer.customerId || "-")}</td>
                <td>${escapeHtml(customer.fullName || "-")}</td>
                <td>${statusPill(customer.status || "ACTIVE")}</td>
                <td>-</td>
                <td>
                    <button class="secondary" data-action="lock" data-id="${customer.id}">Bloquear</button>
                    <button class="secondary" data-action="unlock" data-id="${customer.id}">Activar</button>
                    <button class="secondary" data-action="reset" data-id="${customer.id}">Reset pass</button>
                </td>
            </tr>`
        )
        .join("");
    document.getElementById("admin-users-table").innerHTML = rows
        ? tableHtml(["ID", "Customer ID", "Nombre", "Estatus", "Cuentas", "Acciones"], rows)
        : '<p class="muted">No hay clientes.</p>';

    document.querySelectorAll("button[data-action]").forEach((button) => {
        button.addEventListener("click", async () => {
            const id = button.getAttribute("data-id");
            const action = button.getAttribute("data-action");
            try {
                if (action === "lock") {
                    await adminApi.lockCustomer(id);
                    saveFlash("success", "Cliente bloqueado.");
                } else if (action === "unlock") {
                    await adminApi.unlockCustomer(id);
                    saveFlash("success", "Cliente activado.");
                } else {
                    const password = window.prompt("Nueva contrasena temporal:");
                    if (!password) return;
                    await adminApi.resetPassword(id, {
                        password,
                        adminRole: admin.role || "ADMIN"
                    });
                    saveFlash("success", "Contrasena restablecida.");
                }
                redirect("/admin/usuarios");
            } catch (error) {
                saveFlash("error", error.message);
                redirect("/admin/usuarios");
            }
        });
    });
}
