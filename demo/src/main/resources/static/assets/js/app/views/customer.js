import { accountApi, customerApi, savingsApi, transactionApi } from "../api.js";
import {
    customerShell,
    escapeHtml,
    formatDate,
    formatMoney,
    renderStandalone,
    statusPill,
    tableHtml
} from "../ui.js";
import { saveFlash } from "../state.js";

function redirect(path) {
    window.location.href = path;
}

async function findCurrentCustomer(session) {
    const customers = await customerApi.list();
    return customers.find((item) => item.customerId === session.customerId) || null;
}

function customerTransactions(accounts, allTransactions) {
    const accountIds = accounts.map((acc) => acc.id);
    return allTransactions.filter((item) => {
        const sourceId = item.sourceAccount?.id || null;
        const targetId = item.targetAccount?.id || null;
        return accountIds.includes(sourceId) || accountIds.includes(targetId);
    });
}

export async function renderDashboard(session) {
    renderStandalone(`
        <header class="front-header">
            <div class="logo">BV. SYSTEM / <span>DASHBOARD</span></div>
            <div class="user-info"><span>${escapeHtml(session.fullName || session.customerId)}</span><div class="avatar">${escapeHtml((session.fullName || "AB").slice(0, 2).toUpperCase())}</div></div>
        </header>
        <main class="dashboard">
            <section class="main-panel">
                <span class="balance-label">[ SALDO DISPONIBLE ]</span>
                <h1 class="balance-amount" id="dash-balance">${formatMoney(0)}</h1>
                <div class="transactions-title">Movimientos recientes</div>
                <div id="dash-movements" class="transaction-container">Cargando...</div>
            </section>
            <section class="side-panel">
                <div class="impact-card">
                    <p>IMPACTO ACUMULADO</p>
                    <h2 id="impact-value">0.0 kg</h2>
                    <p>CO2 evitado este mes mediante tus operaciones digitales.</p>
                </div>
                <div>
                    <p class="actions-label">OPERACIONES RAPIDAS</p>
                    <div class="quick-actions">
                        <a href="/transferencias" class="action-btn">Transferir</a>
                        <a href="/cuentas" class="action-btn">Cuentas</a>
                        <a href="/movimientos" class="action-btn">Movimientos</a>
                        <a href="/tarjetas" class="action-btn">Tarjetas</a>
                    </div>
                </div>
                <nav class="sidebar-nav">
                    <a href="/perfil">Configuracion de cuenta</a>
                    <a href="/ahorro">Ahorro y metas</a>
                    <a href="/inicio">Cerrar sesion segura</a>
                </nav>
            </section>
        </main>
    `);

    const [accounts, allTx] = await Promise.all([accountApi.byCustomer(session.customerId), transactionApi.list()]);
    const tx = customerTransactions(accounts, allTx).slice(0, 6);
    const total = accounts.reduce((sum, item) => sum + Number(item.balance || 0), 0);

    document.getElementById("dash-balance").textContent = formatMoney(total);
    document.getElementById("impact-value").textContent = `${(tx.length * 0.42).toFixed(1)} kg`;

    const rows = tx.map((item) => `<div class="transaction-item">
            <div>
                <p>${escapeHtml(item.type || "-")}</p>
                <span class="meta">${escapeHtml(formatDate(item.createdAt))}</span>
            </div>
            <div class="amount">${formatMoney(item.amount)}</div>
        </div>`).join("");
    document.getElementById("dash-movements").innerHTML = rows || '<p class="muted">Aun no tienes movimientos.</p>';
}

function accountCard(account, fullName) {
    return `<article class="account-card">
        <div class="account-summary">
            <div>
                <span class="account-type">${escapeHtml(account.accountType || "-")}</span>
                <h2 class="account-balance-sm">${formatMoney(account.balance)}</h2>
            </div>
            <div>${statusPill("ACTIVE")}</div>
        </div>
        <div class="account-details">
            <div class="detail-group">
                <label>Titular</label>
                <p class="detail-value">${escapeHtml(fullName || "-")}</p>
            </div>
            <div class="detail-group">
                <label>Cuenta</label>
                <p class="detail-value mono">${escapeHtml(account.accountNumber || "-")}</p>
            </div>
            <div class="detail-group">
                <label>CLABE</label>
                <p class="detail-value mono">${escapeHtml(account.clabe || "-")}</p>
            </div>
            <div class="detail-group">
                <label>Tipo</label>
                <p class="detail-value">${escapeHtml(account.accountType || "-")}</p>
            </div>
        </div>
    </article>`;
}

export async function renderAccounts(session) {
    renderStandalone(`
        <header class="front-header">
            <div class="logo">BV. SYSTEM</div>
            <div>ID: ${escapeHtml(session.customerId || "-")}</div>
        </header>
        <main class="accounts-main">
            <section class="section-intro">
                <p class="section-tag">[ AREA DE PRODUCTOS ]</p>
                <h1>Mis Cuentas</h1>
                <p>Resumen detallado de tus activos y credenciales de sistema.</p>
            </section>
            <div id="accounts-list" class="accounts-container muted">Cargando...</div>
            <section class="new-account-box">
                <h3>Nueva cuenta</h3>
                <form id="account-form">
                    <label>Tipo<select name="accountType"><option>SAVINGS</option><option>CHECKING</option><option>INVESTMENT</option></select></label>
                    <label>Saldo inicial<input name="initialBalance" type="number" min="0" step="0.01" value="0"></label>
                    <button class="primary" type="submit">Crear cuenta</button>
                </form>
            </section>
        </main>
    `);

    const customer = await findCurrentCustomer(session);
    const loadAccounts = async () => {
        const accounts = await accountApi.byCustomer(session.customerId);
        document.getElementById("accounts-list").innerHTML = accounts.length
            ? accounts.map((acc) => accountCard(acc, customer?.fullName)).join("")
            : '<p class="muted">No hay cuentas activas para este cliente.</p>';
    };
    await loadAccounts();

    const form = document.getElementById("account-form");
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const data = new FormData(form);
        try {
            await accountApi.create({
                customerId: session.customerId,
                accountType: data.get("accountType"),
                initialBalance: Number(data.get("initialBalance") || 0)
            });
            saveFlash("success", "Cuenta creada correctamente.");
            redirect("/cuentas");
        } catch (error) {
            saveFlash("error", error.message);
            redirect("/cuentas");
        }
    });
}

export async function renderTransfers(session) {
    renderStandalone(`
        <header class="front-header">
            <div class="logo">BV. SYSTEM</div>
            <a href="/dashboard" class="back-link">← Cancelar y Volver</a>
        </header>
        <main class="transfer-grid">
            <section class="form-section">
                <span class="step-indicator">PASO 01 / CONFIGURACION</span>
                <h1>Nueva Transferencia</h1>
                <form id="transfer-form">
                    <div class="input-group"><label>Cuenta de Origen</label><select name="sourceAccountId" id="sourceAccountId"></select></div>
                    <div class="input-group"><label>Cuenta de Destino (ID)</label><input type="number" name="targetAccountId" min="1" required></div>
                    <div class="input-group"><label>Monto a transferir (MXN)</label><input type="number" class="amount-input" name="amount" min="0.01" step="0.01" required></div>
                    <div class="input-group"><label>Concepto de pago</label><input type="text" name="concept"></div>
                </form>
            </section>
            <aside class="summary-panel">
                <div class="summary-card">
                    <h2>Vista Previa</h2>
                    <div class="summary-item"><label>Origen</label><p id="sum-source">No seleccionado</p></div>
                    <div class="summary-item"><label>Destinatario</label><p id="sum-target">No especificado</p></div>
                    <div class="summary-item"><label>Importe Bruto</label><p id="sum-amount">${formatMoney(0)}</p></div>
                    <div class="summary-item"><label>Comision BV</label><p>${formatMoney(0)}</p></div>
                </div>
                <button class="btn-confirm" type="button" id="open-transfer-modal">Continuar a Validacion</button>
                <p class="security-note">Conexion cifrada de extremo a extremo</p>
            </aside>
        </main>
        <div id="transfer-modal" class="modal-overlay hidden">
            <div class="confirm-modal">
                <h3>Confirmar transferencia</h3>
                <p class="muted">Esta operacion no puede deshacerse.</p>
                <div id="transfer-modal-resume" class="summary"></div>
                <div class="modal-actions">
                    <button class="btn-outline" id="cancel-transfer-modal" type="button">Corregir</button>
                    <button class="btn-confirm" id="confirm-transfer" type="button">Firmar y Enviar</button>
                </div>
            </div>
        </div>
    `);

    const accounts = await accountApi.byCustomer(session.customerId);
    const select = document.getElementById("sourceAccountId");
    select.innerHTML = accounts
        .map((acc) => `<option value="${acc.id}">${escapeHtml(acc.accountNumber)} - ${formatMoney(acc.balance)}</option>`)
        .join("");

    const form = document.getElementById("transfer-form");
    const syncPreview = () => {
        const data = new FormData(form);
        const sourceLabel = select.options[select.selectedIndex]?.text || "No seleccionado";
        document.getElementById("sum-source").textContent = sourceLabel;
        document.getElementById("sum-target").textContent = data.get("targetAccountId") || "No especificado";
        document.getElementById("sum-amount").textContent = formatMoney(data.get("amount") || 0);
        document.getElementById("transfer-modal-resume").innerHTML = `
            <p><strong>Origen:</strong> ${escapeHtml(sourceLabel)}</p>
            <p><strong>Destino:</strong> ${escapeHtml(data.get("targetAccountId") || "-")}</p>
            <p><strong>Monto:</strong> ${formatMoney(data.get("amount") || 0)}</p>
            <p><strong>Concepto:</strong> ${escapeHtml(data.get("concept") || "Sin concepto")}</p>`;
    };
    form.addEventListener("input", syncPreview);
    syncPreview();

    const modal = document.getElementById("transfer-modal");
    document.getElementById("open-transfer-modal").addEventListener("click", () => {
        if (!form.reportValidity()) return;
        syncPreview();
        modal.classList.remove("hidden");
    });
    document.getElementById("cancel-transfer-modal").addEventListener("click", () => modal.classList.add("hidden"));
    document.getElementById("confirm-transfer").addEventListener("click", async () => {
        const data = new FormData(form);
        try {
            await transactionApi.transfer({
                sourceAccountId: Number(data.get("sourceAccountId")),
                targetAccountId: Number(data.get("targetAccountId")),
                amount: Number(data.get("amount")),
                location: "WEB"
            });
            saveFlash("success", "Transferencia aplicada.");
            redirect("/movimientos");
        } catch (error) {
            saveFlash("error", error.message);
            redirect("/transferencias");
        }
    });
}

export async function renderMovements(session) {
    customerShell(
        "Movimientos",
        "/movimientos",
        session,
        `<section class="card panel"><h3>Historial de movimientos</h3><div id="mov-table" class="muted">Cargando...</div></section>`
    );

    const [accounts, allTx] = await Promise.all([accountApi.byCustomer(session.customerId), transactionApi.list()]);
    const movements = customerTransactions(accounts, allTx);
    const rows = movements
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
    document.getElementById("mov-table").innerHTML = rows
        ? tableHtml(["Tipo", "Monto", "Origen", "Destino", "Fecha"], rows)
        : '<p class="muted">No se encontraron movimientos.</p>';
}

export async function renderSavings(session) {
    customerShell(
        "Ahorro",
        "/ahorro",
        session,
        `<section class="split-grid">
            <div class="card panel">
                <h3>Nueva meta</h3>
                <form id="goal-form">
                    <label>Nombre<input name="name" required></label>
                    <label>Monto objetivo<input name="targetAmount" type="number" min="1" step="0.01" required></label>
                    <label>Fecha limite<input name="deadline" type="date" required></label>
                    <button class="primary" type="submit">Crear meta</button>
                </form>
            </div>
            <aside class="card rail">
                <h3>Roundup</h3>
                <p class="muted">Redondeo automatico de cargos para fondear tus metas.</p>
                <label class="row"><input type="checkbox" id="roundup-toggle"> Activar roundup</label>
            </aside>
        </section>
        <section class="card panel"><h3>Metas actuales</h3><div id="goals-list" class="muted">Cargando...</div></section>`
    );

    const [customer, goals] = await Promise.all([findCurrentCustomer(session), savingsApi.goals(session.customerId)]);
    const toggle = document.getElementById("roundup-toggle");
    toggle.checked = !!customer?.roundupEnabled;
    toggle.addEventListener("change", async () => {
        try {
            await savingsApi.toggleRoundup(session.customerId, toggle.checked);
            saveFlash("success", "Roundup actualizado.");
            redirect("/ahorro");
        } catch (error) {
            saveFlash("error", error.message);
            redirect("/ahorro");
        }
    });

    const rows = goals
        .map((goal) => {
            const current = Number(goal.currentAmount || 0);
            const target = Number(goal.targetAmount || 0);
            const progress = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
            return `<tr>
                <td>${escapeHtml(goal.name || "-")}</td>
                <td>${formatMoney(goal.currentAmount)}</td>
                <td>${formatMoney(goal.targetAmount)}</td>
                <td>${progress}%</td>
                <td><button class="secondary" data-goal-id="${goal.id}">Agregar fondos</button></td>
            </tr>`;
        })
        .join("");
    document.getElementById("goals-list").innerHTML = rows
        ? tableHtml(["Meta", "Actual", "Objetivo", "Progreso", ""], rows)
        : '<p class="muted">Aun no tienes metas de ahorro.</p>';

    document.querySelectorAll("button[data-goal-id]").forEach((button) => {
        button.addEventListener("click", async () => {
            const goalId = button.getAttribute("data-goal-id");
            const value = window.prompt("Monto a agregar:");
            if (!value) return;
            try {
                await savingsApi.addFunds(goalId, Number(value));
                saveFlash("success", "Fondos agregados.");
                redirect("/ahorro");
            } catch (error) {
                saveFlash("error", error.message);
                redirect("/ahorro");
            }
        });
    });

    const goalForm = document.getElementById("goal-form");
    goalForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const data = new FormData(goalForm);
        try {
            await savingsApi.createGoal(session.customerId, {
                name: data.get("name"),
                targetAmount: Number(data.get("targetAmount")),
                deadline: data.get("deadline")
            });
            saveFlash("success", "Meta creada.");
            redirect("/ahorro");
        } catch (error) {
            saveFlash("error", error.message);
            redirect("/ahorro");
        }
    });
}

export async function renderProfile(session) {
    customerShell(
        "Perfil",
        "/perfil",
        session,
        `<section class="card panel">
            <p class="ref">[ USER PROFILE ]</p>
            <h3>Datos personales</h3>
            <form id="profile-form">
                <label>Customer ID<input id="profile-customer-id" disabled></label>
                <label>Nombre completo<input name="fullName" id="profile-full-name" required></label>
                <label>Email<input type="email" name="email" id="profile-email" required></label>
                <label>Telefono<input name="phone" id="profile-phone" required></label>
                <button class="primary" type="submit">Actualizar perfil</button>
            </form>
        </section>`
    );

    const customer = await findCurrentCustomer(session);
    if (!customer) return;
    document.getElementById("profile-customer-id").value = customer.customerId || "";
    document.getElementById("profile-full-name").value = customer.fullName || "";
    document.getElementById("profile-email").value = customer.email || "";
    document.getElementById("profile-phone").value = customer.phone || "";

    const form = document.getElementById("profile-form");
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const data = new FormData(form);
        try {
            await customerApi.updateProfile(session.customerId, {
                fullName: data.get("fullName"),
                email: data.get("email"),
                phone: data.get("phone")
            });
            saveFlash("success", "Perfil actualizado.");
            redirect("/perfil");
        } catch (error) {
            saveFlash("error", error.message);
            redirect("/perfil");
        }
    });
}

export async function renderCards(session) {
    renderStandalone(`
        <header class="front-header">
            <div class="logo">BV. SYSTEM</div>
            <div>TARJETAS / GESTION</div>
        </header>
        <main class="cards-main">
            <div class="section-header"><p class="section-tag">[ SEGURIDAD DE ACTIVOS ]</p><h1>Mis Tarjetas</h1></div>
            <div class="card-management-grid">
                <section>
                    <div class="card-visual" id="physicalCard">
                        <div class="card-logo">BV. DEBIT</div>
                        <div class="card-number" id="card-number">**** **** **** 0000</div>
                        <div class="card-info">
                            <div><label>Titular</label><p id="card-holder">${escapeHtml(session.fullName || "-")}</p></div>
                            <div><label>Expira</label><p>12/28</p></div>
                            <div><p>VISA</p></div>
                        </div>
                    </div>
                    <div class="controls">
                        <div class="control-item">
                            <div class="control-label"><h3>Bloqueo Temporal</h3><p>Desactiva compras y retiros al instante.</p></div>
                            <label class="switch"><input type="checkbox" id="block-toggle"><span class="slider"></span></label>
                        </div>
                    </div>
                </section>
                <section class="recent-spending">
                    <h2>Ultimos Consumos</h2>
                    <div id="card-spending" class="muted">Cargando...</div>
                </section>
            </div>
        </main>
    `);

    const [accounts, allTx] = await Promise.all([accountApi.byCustomer(session.customerId), transactionApi.list()]);
    if (accounts.length > 0) {
        const lastDigits = (accounts[0].accountNumber || "0000").slice(-4);
        document.getElementById("card-number").textContent = `**** **** **** ${lastDigits}`;
    }
    document.getElementById("block-toggle").addEventListener("change", (event) => {
        document.getElementById("physicalCard").classList.toggle("blocked", event.target.checked);
    });

    const spending = customerTransactions(accounts, allTx).slice(0, 5);
    const spendRows = spending
        .map(
            (tx) => `<div class="spend-item">
                <div>
                    <p class="merchant">${escapeHtml(tx.type || "Movimiento")}</p>
                    <p class="date">${escapeHtml(formatDate(tx.createdAt))}</p>
                </div>
                <p class="amount">${formatMoney(tx.amount)}</p>
            </div>`
        )
        .join("");
    document.getElementById("card-spending").innerHTML =
        spendRows || '<p class="muted">Sin movimientos recientes para esta tarjeta virtual.</p>';
}
