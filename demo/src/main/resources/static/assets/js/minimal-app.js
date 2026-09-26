(function () {
    "use strict";

    var app = document.getElementById("app");
    var CUSTOMER_SESSION_KEY = "atlasbank.customer.session";
    var ADMIN_SESSION_KEY = "atlasbank.admin.session";
    var FLASH_KEY = "atlasbank.flash.message";

    function readStorage(key) {
        try {
            var raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            return null;
        }
    }

    function writeStorage(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function customerSession() {
        return readStorage(CUSTOMER_SESSION_KEY);
    }

    function adminSession() {
        return readStorage(ADMIN_SESSION_KEY);
    }

    function saveFlash(type, message) {
        writeStorage(FLASH_KEY, { type: type, message: message });
    }

    function consumeFlash() {
        var flash = readStorage(FLASH_KEY);
        localStorage.removeItem(FLASH_KEY);
        return flash;
    }

    function formatMoney(value) {
        var numeric = Number(value || 0);
        return new Intl.NumberFormat("es-MX", {
            style: "currency",
            currency: "MXN"
        }).format(numeric);
    }

    function formatDate(value) {
        if (!value) return "-";
        var date = new Date(value);
        if (Number.isNaN(date.getTime())) return "-";
        return new Intl.DateTimeFormat("es-MX", {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        }).format(date);
    }

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    async function api(path, options) {
        var response = await fetch(path, Object.assign({
            headers: { "Content-Type": "application/json" }
        }, options || {}));

        var data = null;
        var contentType = response.headers.get("content-type") || "";
        if (contentType.indexOf("application/json") !== -1) {
            data = await response.json();
        } else {
            data = await response.text();
        }

        if (!response.ok) {
            var message = (data && data.message) || "No se pudo completar la solicitud";
            throw new Error(message);
        }
        return data;
    }

    function customerNav(currentPath) {
        var links = [
            ["/dashboard", "Dashboard"],
            ["/cuentas", "Cuentas"],
            ["/transferencias", "Transferencias"],
            ["/movimientos", "Movimientos"],
            ["/ahorro", "Ahorro"],
            ["/perfil", "Perfil"],
            ["/tarjetas", "Tarjetas"]
        ];
        return links.map(function (item) {
            var active = item[0] === currentPath ? "active" : "";
            return '<a class="' + active + '" href="' + item[0] + '">' + item[1] + "</a>";
        }).join("");
    }

    function adminNav(currentPath) {
        var links = [
            ["/admin", "Panel"],
            ["/admin/monitoreo", "Monitoreo"],
            ["/admin/usuarios", "Usuarios"]
        ];
        return links.map(function (item) {
            var active = item[0] === currentPath ? "active" : "";
            return '<a class="' + active + '" href="' + item[0] + '">' + item[1] + "</a>";
        }).join("");
    }

    function initialsFromName(name) {
        if (!name) return "AB";
        var parts = String(name).trim().split(/\s+/).filter(Boolean);
        if (!parts.length) return "AB";
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }

    function renderLayout(config) {
        var flash = config.flash || consumeFlash();
        var flashHtml = flash ? '<div class="flash ' + flash.type + '">' + escapeHtml(flash.message) + "</div>" : "";
        var layoutClass = config.layoutClass ? " " + config.layoutClass : "";
        var headerClass = config.headerClass ? " " + config.headerClass : "";

        app.innerHTML =
            '<div class="layout' + layoutClass + '">' +
            '<header class="topbar' + headerClass + '">' +
            '<a class="brand" href="/inicio">AtlasBank</a>' +
            '<nav class="nav">' + config.nav + "</nav>" +
            "</header>" +
            flashHtml +
            config.body +
            "</div>";
    }

    function redirect(path) {
        window.location.href = path;
    }

    function guardCustomer() {
        if (!customerSession()) {
            saveFlash("error", "Inicia sesion para continuar.");
            redirect("/login");
            return false;
        }
        return true;
    }

    function guardAdmin() {
        if (!adminSession()) {
            saveFlash("error", "Inicia sesion de administrador.");
            redirect("/admin");
            return false;
        }
        return true;
    }

    function attachCustomerLogout() {
        var button = document.getElementById("logout-customer");
        if (!button) return;
        button.addEventListener("click", function () {
            localStorage.removeItem(CUSTOMER_SESSION_KEY);
            saveFlash("success", "Sesion cerrada.");
            redirect("/inicio");
        });
    }

    function attachAdminLogout() {
        var button = document.getElementById("logout-admin");
        if (!button) return;
        button.addEventListener("click", function () {
            localStorage.removeItem(ADMIN_SESSION_KEY);
            saveFlash("success", "Sesion de admin cerrada.");
            redirect("/inicio");
        });
    }

    function customerShell(title, path, body) {
        var session = customerSession();
        renderLayout({
            nav: customerNav(path) + '<button id="logout-customer">Salir</button>',
            layoutClass: "layout-customer",
            body:
                '<section class="shell-head">' +
                '<div><p class="ref">[ MODULO CLIENTE ]</p><h2>' + escapeHtml(title) + "</h2><p class='muted'>Operacion segura en linea.</p></div>" +
                '<div class="user-chip"><span class="avatar">' + escapeHtml(initialsFromName(session.fullName || session.customerId)) + '</span><div><strong>' + escapeHtml(session.fullName || session.customerId) + "</strong><p class='muted'>ID " + escapeHtml(session.customerId || "-") + "</p></div></div>" +
                "</section>" +
                body
        });
        attachCustomerLogout();
    }

    function adminShell(title, path, body) {
        var session = adminSession();
        renderLayout({
            nav: adminNav(path) + '<button id="logout-admin">Salir</button>',
            layoutClass: "layout-admin",
            headerClass: "topbar-admin",
            body:
                '<section class="shell-head admin-shell-head">' +
                '<div><p class="ref">[ ADMIN CORE ]</p><h2>' + escapeHtml(title) + "</h2><p class='muted'>Control y supervision operativa.</p></div>" +
                '<div class="user-chip"><span class="avatar">AD</span><div><strong>Administrador</strong><p class="muted">Rol: ' + escapeHtml((session && session.role) || "N/A") + "</p></div></div>" +
                "</section>" +
                body
        });
        attachAdminLogout();
    }

    function renderPublicHome() {
        renderLayout({
            layoutClass: "layout-landing",
            nav: '<a href="/login">Login</a><a href="/registro">Registro</a><a href="/admin">Admin</a>',
            body:
                '<section class="hero-split">' +
                '<div class="hero-main">' +
                '<p class="ref">[ ATLASBANK / FRONT ]</p>' +
                '<h1>BANCA DIGITAL<br>SEGURA Y<br>MINIMAL.</h1>' +
                '<p class="muted">Diseño editorial verde, experiencias por modulo y operaciones conectadas a tus APIs.</p>' +
                '<div class="row wrap"><a class="primary" href="/login">Entrar como cliente</a><a class="secondary" href="/registro">Crear cuenta</a></div>' +
                '</div>' +
                '<div class="hero-side"><a class="circle-cta" href="/admin">Panel<br>Admin</a><p class="muted">Supervision, usuarios y monitoreo de riesgo.</p></div>' +
                '</section>' +
                '<section class="feature-grid">' +
                '<article class="feature"><span>[ 01 ] CUENTAS</span><h3>Gestion de cuentas y saldos en tiempo real.</h3></article>' +
                '<article class="feature"><span>[ 02 ] TRANSFERENCIAS</span><h3>Flujo de envios con validacion y trazabilidad.</h3></article>' +
                '<article class="feature"><span>[ 03 ] AHORRO</span><h3>Metas con progreso y roundup configurable.</h3></article>' +
                '<article class="feature"><span>[ 04 ] ADMIN</span><h3>Panel operativo para control de clientes.</h3></article>' +
                "</section>"
        });
    }

    function renderCustomerLogin() {
        renderLayout({
            layoutClass: "layout-auth",
            nav: '<a class="active" href="/login">Login</a><a href="/registro">Registro</a><a href="/inicio">Inicio</a>',
            body:
                '<section class="auth-shell centered">' +
                '<p class="ref">[ CLIENT ACCESS ]</p>' +
                "<h2>Acceso Cliente</h2><p class='muted'>Verifica tu identidad para ingresar al sistema.</p>" +
                '<form id="customer-login-form" class="auth-form">' +
                '<label>Customer ID<input name="customerId" required></label>' +
                '<label>Contrasena<input type="password" name="password" required></label>' +
                '<button class="primary" type="submit">Entrar</button>' +
                "</form>" +
                "</section>"
        });

        var form = document.getElementById("customer-login-form");
        form.addEventListener("submit", async function (event) {
            event.preventDefault();
            var data = new FormData(form);
            try {
                var result = await api("/api/customers/login", {
                    method: "POST",
                    body: JSON.stringify({
                        customerId: data.get("customerId"),
                        password: data.get("password")
                    })
                });
                writeStorage(CUSTOMER_SESSION_KEY, result);
                saveFlash("success", "Bienvenido, " + (result.fullName || result.customerId) + ".");
                redirect("/dashboard");
            } catch (error) {
                saveFlash("error", error.message);
                redirect("/login");
            }
        });
    }

    function renderRegister() {
        renderLayout({
            layoutClass: "layout-auth",
            nav: '<a href="/login">Login</a><a class="active" href="/registro">Registro</a><a href="/inicio">Inicio</a>',
            body:
                '<section class="auth-shell centered">' +
                '<p class="ref">[ ONBOARDING ]</p>' +
                "<h2>Registro</h2><p class='muted'>Crea tu cuenta bancaria digital en minutos.</p>" +
                '<form id="register-form" class="auth-form">' +
                '<label>Customer ID<input name="customerId" required></label>' +
                '<label>Nombre completo<input name="fullName" required></label>' +
                '<label>Email<input name="email" type="email" required></label>' +
                '<label>Telefono<input name="phone" required></label>' +
                '<label>Contrasena<input name="password" type="password" required></label>' +
                '<button class="primary" type="submit">Crear cuenta</button>' +
                "</form>" +
                "</section>"
        });

        var form = document.getElementById("register-form");
        form.addEventListener("submit", async function (event) {
            event.preventDefault();
            var data = new FormData(form);
            try {
                await api("/api/customers", {
                    method: "POST",
                    body: JSON.stringify({
                        customerId: data.get("customerId"),
                        fullName: data.get("fullName"),
                        firstName: "",
                        lastName: "",
                        email: data.get("email"),
                        phone: data.get("phone"),
                        password: data.get("password")
                    })
                });
                saveFlash("success", "Cuenta creada. Ahora inicia sesion.");
                redirect("/login");
            } catch (error) {
                saveFlash("error", error.message);
                redirect("/registro");
            }
        });
    }

    async function renderDashboard() {
        if (!guardCustomer()) return;
        customerShell("Dashboard", "/dashboard",
            '<div class="kpi-grid">' +
            '<section class="kpi-card"><small>SALDO TOTAL</small><div class="stat" id="dash-balance">$0.00</div></section>' +
            '<section class="kpi-card"><small>CUENTAS ACTIVAS</small><div class="stat" id="dash-accounts">0</div></section>' +
            '<section class="kpi-card"><small>MOVIMIENTOS</small><div class="stat" id="dash-transfers">0</div></section>' +
            '<section class="kpi-card impact"><small>ACCESO RAPIDO</small><p class="muted">Transfiere o revisa operaciones recientes.</p><a href="/transferencias" class="pill">Nueva transferencia</a></section>' +
            "</div>" +
            '<section class="card panel"><h3>Ultimos movimientos</h3><div id="dash-table" class="muted">Cargando...</div></section>'
        );

        var session = customerSession();
        var accounts = await api("/api/accounts/customer/" + encodeURIComponent(session.customerId));
        var allTx = await api("/api/transactions");
        var accountIds = accounts.map(function (acc) { return acc.id; });
        var tx = allTx.filter(function (item) {
            var sourceId = item.sourceAccount ? item.sourceAccount.id : null;
            var targetId = item.targetAccount ? item.targetAccount.id : null;
            return accountIds.indexOf(sourceId) !== -1 || accountIds.indexOf(targetId) !== -1;
        });

        var totalBalance = accounts.reduce(function (sum, item) {
            return sum + Number(item.balance || 0);
        }, 0);

        document.getElementById("dash-balance").textContent = formatMoney(totalBalance);
        document.getElementById("dash-accounts").textContent = String(accounts.length);
        document.getElementById("dash-transfers").textContent = String(tx.length);

        var rows = tx.slice(0, 6).map(function (item) {
            return "<tr>" +
                "<td>" + escapeHtml(item.type || "-") + "</td>" +
                "<td>" + formatMoney(item.amount) + "</td>" +
                "<td>" + formatDate(item.createdAt) + "</td>" +
                "</tr>";
        }).join("");
        document.getElementById("dash-table").innerHTML = rows ?
            '<table><thead><tr><th>Tipo</th><th>Monto</th><th>Fecha</th></tr></thead><tbody>' + rows + "</tbody></table>" :
            '<p class="muted">Aun no tienes movimientos.</p>';
    }

    async function renderAccounts() {
        if (!guardCustomer()) return;
        customerShell("Cuentas", "/cuentas",
            '<div class="split-grid">' +
            '<section class="card panel"><h3>Mis cuentas</h3><div id="accounts-table" class="muted">Cargando...</div></section>' +
            '<section class="card rail"><h3>Nueva cuenta</h3><p class="muted">Configura una cuenta complementaria.</p>' +
            '<form id="account-form">' +
            '<label>Tipo<select name="accountType"><option>SAVINGS</option><option>CHECKING</option><option>INVESTMENT</option></select></label>' +
            '<label>Saldo inicial<input name="initialBalance" type="number" min="0" step="0.01" value="0"></label>' +
            '<button class="primary" type="submit">Crear cuenta</button>' +
            "</form></section>" +
            "</div>"
        );

        var session = customerSession();
        async function loadAccounts() {
            var accounts = await api("/api/accounts/customer/" + encodeURIComponent(session.customerId));
            var rows = accounts.map(function (item) {
                return "<tr>" +
                    '<td><span class="mono">' + escapeHtml(item.accountNumber || "-") + "</span></td>" +
                    "<td>" + escapeHtml(item.accountType || "-") + "</td>" +
                    '<td><span class="mono">' + escapeHtml(item.clabe || "-") + "</span></td>" +
                    "<td>" + formatMoney(item.balance) + "</td>" +
                    "</tr>";
            }).join("");
            document.getElementById("accounts-table").innerHTML = rows ?
                '<table><thead><tr><th>Cuenta</th><th>Tipo</th><th>CLABE</th><th>Saldo</th></tr></thead><tbody>' + rows + "</tbody></table>" :
                '<p class="muted">No hay cuentas para este cliente.</p>';
        }

        await loadAccounts();
        var form = document.getElementById("account-form");
        form.addEventListener("submit", async function (event) {
            event.preventDefault();
            var data = new FormData(form);
            try {
                await api("/api/accounts", {
                    method: "POST",
                    body: JSON.stringify({
                        customerId: session.customerId,
                        accountType: data.get("accountType"),
                        initialBalance: Number(data.get("initialBalance") || 0)
                    })
                });
                saveFlash("success", "Cuenta creada correctamente.");
                redirect("/cuentas");
            } catch (error) {
                saveFlash("error", error.message);
                redirect("/cuentas");
            }
        });
    }

    async function renderTransfers() {
        if (!guardCustomer()) return;
        customerShell("Transferencias", "/transferencias",
            '<div class="split-grid transfer-layout">' +
            '<section class="card panel"><p class="ref">[ PASO 01 ]</p><h3>Nueva transferencia</h3>' +
            '<form id="transfer-form">' +
            '<label>Cuenta origen<select name="sourceAccountId" id="sourceAccountId"></select></label>' +
            '<label>Cuenta destino (ID)<input name="targetAccountId" type="number" min="1" required></label>' +
            '<label>Monto<input name="amount" type="number" min="0.01" step="0.01" required></label>' +
            '<button class="primary" type="submit">Transferir</button>' +
            "</form></section>" +
            '<section class="card rail"><h3>Vista previa</h3><p class="muted">Verifica origen, destino y monto antes de confirmar.</p><div class="summary"><p><strong>Tipo:</strong> Transferencia interna</p><p><strong>Canal:</strong> Web segura</p><p><strong>Tip:</strong> Usa el ID de cuenta destino.</p></div></section>' +
            "</div>"
        );

        var session = customerSession();
        var accounts = await api("/api/accounts/customer/" + encodeURIComponent(session.customerId));
        var select = document.getElementById("sourceAccountId");
        select.innerHTML = accounts.map(function (acc) {
            return '<option value="' + acc.id + '">' + escapeHtml(acc.accountNumber) + " · " + formatMoney(acc.balance) + "</option>";
        }).join("");

        var form = document.getElementById("transfer-form");
        form.addEventListener("submit", async function (event) {
            event.preventDefault();
            var data = new FormData(form);
            try {
                await api("/api/transactions/transfer", {
                    method: "POST",
                    body: JSON.stringify({
                        sourceAccountId: Number(data.get("sourceAccountId")),
                        targetAccountId: Number(data.get("targetAccountId")),
                        amount: Number(data.get("amount")),
                        location: "WEB"
                    })
                });
                saveFlash("success", "Transferencia aplicada.");
                redirect("/movimientos");
            } catch (error) {
                saveFlash("error", error.message);
                redirect("/transferencias");
            }
        });
    }

    async function renderMovements() {
        if (!guardCustomer()) return;
        customerShell("Movimientos", "/movimientos",
            '<section class="card panel"><h3>Historial operativo</h3><div id="mov-table" class="muted">Cargando...</div></section>'
        );

        var session = customerSession();
        var accounts = await api("/api/accounts/customer/" + encodeURIComponent(session.customerId));
        var ids = accounts.map(function (a) { return a.id; });
        var allTx = await api("/api/transactions");
        var movements = allTx.filter(function (tx) {
            var sourceId = tx.sourceAccount ? tx.sourceAccount.id : null;
            var targetId = tx.targetAccount ? tx.targetAccount.id : null;
            return ids.indexOf(sourceId) !== -1 || ids.indexOf(targetId) !== -1;
        });

        var rows = movements.map(function (tx) {
            var sourceLabel = tx.sourceAccount ? tx.sourceAccount.accountNumber : "-";
            var targetLabel = tx.targetAccount ? tx.targetAccount.accountNumber : "-";
            return "<tr>" +
                "<td>" + escapeHtml(tx.type || "-") + "</td>" +
                "<td>" + formatMoney(tx.amount) + "</td>" +
                "<td class='mono'>" + escapeHtml(sourceLabel) + "</td>" +
                "<td class='mono'>" + escapeHtml(targetLabel) + "</td>" +
                "<td>" + formatDate(tx.createdAt) + "</td>" +
                "</tr>";
        }).join("");

        document.getElementById("mov-table").innerHTML = rows ?
            '<table><thead><tr><th>Tipo</th><th>Monto</th><th>Origen</th><th>Destino</th><th>Fecha</th></tr></thead><tbody>' + rows + "</tbody></table>" :
            '<p class="muted">No se encontraron movimientos.</p>';
    }

    async function findCurrentCustomer() {
        var session = customerSession();
        var customers = await api("/api/customers");
        return customers.find(function (item) {
            return item.customerId === session.customerId;
        });
    }

    async function renderSavings() {
        if (!guardCustomer()) return;
        customerShell("Ahorro", "/ahorro",
            '<div class="split-grid">' +
            '<section class="card panel"><h3>Nueva meta</h3>' +
            '<form id="goal-form">' +
            '<label>Nombre<input name="name" required></label>' +
            '<label>Monto objetivo<input name="targetAmount" type="number" min="1" step="0.01" required></label>' +
            '<label>Fecha limite<input name="deadline" type="date" required></label>' +
            '<button class="primary" type="submit">Crear meta</button>' +
            "</form></section>" +
            '<section class="card rail"><h3>Roundup</h3>' +
            '<p class="muted">Redondeo automatico en compras.</p>' +
            '<label class="row"><input id="roundup-toggle" type="checkbox"> Activar roundup</label>' +
            "</section></div>" +
            '<section class="card panel"><h3>Metas actuales</h3><div id="goals-list" class="muted">Cargando...</div></section>'
        );

        var session = customerSession();
        var currentCustomer = await findCurrentCustomer();
        var goals = await api("/api/savings/goals/" + encodeURIComponent(session.customerId));

        var toggle = document.getElementById("roundup-toggle");
        toggle.checked = !!(currentCustomer && currentCustomer.roundupEnabled);
        toggle.addEventListener("change", async function () {
            try {
                await api("/api/savings/roundup/" + encodeURIComponent(session.customerId), {
                    method: "PUT",
                    body: JSON.stringify({ enabled: toggle.checked })
                });
                saveFlash("success", "Roundup actualizado.");
                redirect("/ahorro");
            } catch (error) {
                saveFlash("error", error.message);
                redirect("/ahorro");
            }
        });

        var goalRows = goals.map(function (goal) {
            var currentAmount = Number(goal.currentAmount || 0);
            var targetAmount = Number(goal.targetAmount || 0);
            var percent = targetAmount > 0 ? Math.min(100, Math.round((currentAmount / targetAmount) * 100)) : 0;
            return "<tr>" +
                "<td>" + escapeHtml(goal.name || "-") + "</td>" +
                "<td>" + formatMoney(goal.currentAmount) + "</td>" +
                "<td>" + formatMoney(goal.targetAmount) + "</td>" +
                "<td>" + percent + "%</td>" +
                "<td><button class='secondary' data-goal-id='" + goal.id + "'>Agregar fondos</button></td>" +
                "</tr>";
        }).join("");
        document.getElementById("goals-list").innerHTML = goalRows ?
            '<table><thead><tr><th>Meta</th><th>Actual</th><th>Objetivo</th><th>Progreso</th><th></th></tr></thead><tbody>' + goalRows + "</tbody></table>" :
            '<p class="muted">Aun no tienes metas de ahorro.</p>';

        document.querySelectorAll("button[data-goal-id]").forEach(function (button) {
            button.addEventListener("click", async function () {
                var goalId = button.getAttribute("data-goal-id");
                var value = window.prompt("Monto a agregar:");
                if (!value) return;
                try {
                    await api("/api/savings/goals/" + goalId + "/add-funds", {
                        method: "POST",
                        body: JSON.stringify({ amount: Number(value) })
                    });
                    saveFlash("success", "Fondos agregados.");
                    redirect("/ahorro");
                } catch (error) {
                    saveFlash("error", error.message);
                    redirect("/ahorro");
                }
            });
        });

        var form = document.getElementById("goal-form");
        form.addEventListener("submit", async function (event) {
            event.preventDefault();
            var data = new FormData(form);
            try {
                await api("/api/savings/goals/" + encodeURIComponent(session.customerId), {
                    method: "POST",
                    body: JSON.stringify({
                        name: data.get("name"),
                        targetAmount: Number(data.get("targetAmount")),
                        deadline: data.get("deadline")
                    })
                });
                saveFlash("success", "Meta creada.");
                redirect("/ahorro");
            } catch (error) {
                saveFlash("error", error.message);
                redirect("/ahorro");
            }
        });
    }

    async function renderProfile() {
        if (!guardCustomer()) return;
        customerShell("Perfil", "/perfil",
            '<section class="card panel"><h3>Datos del cliente</h3><div id="profile-data" class="muted">Cargando...</div></section>'
        );

        var customer = await findCurrentCustomer();
        var html = customer ? (
            "<p><strong>Customer ID:</strong> <span class='mono'>" + escapeHtml(customer.customerId) + "</span></p>" +
            "<p><strong>Nombre:</strong> " + escapeHtml(customer.fullName) + "</p>" +
            "<p><strong>Email:</strong> " + escapeHtml(customer.email) + "</p>" +
            "<p><strong>Telefono:</strong> " + escapeHtml(customer.phone) + "</p>" +
            "<p><strong>Estatus:</strong> " + escapeHtml(customer.status) + "</p>"
        ) : "<p class='muted'>No fue posible cargar el perfil.</p>";
        document.getElementById("profile-data").innerHTML = html;
    }

    async function renderCards() {
        if (!guardCustomer()) return;
        customerShell("Tarjetas", "/tarjetas",
            '<section class="card panel"><h3>Tarjeta virtual</h3><div id="card-box" class="muted">Cargando...</div></section>'
        );

        var session = customerSession();
        var accounts = await api("/api/accounts/customer/" + encodeURIComponent(session.customerId));
        if (!accounts.length) {
            document.getElementById("card-box").innerHTML = "<p class='muted'>No hay cuentas para generar tarjeta virtual.</p>";
            return;
        }
        var acc = accounts[0];
        document.getElementById("card-box").innerHTML =
            '<div class="virtual-card">' +
            '<p class="muted card-tag">AtlasBank Virtual</p>' +
            '<p class="mono card-number">' + escapeHtml(acc.accountNumber || "----") + "</p>" +
            '<p class="card-holder">Titular: ' + escapeHtml(session.fullName || "-") + "</p>" +
            "</div>";
    }

    function renderAdminLogin() {
        renderLayout({
            layoutClass: "layout-auth",
            nav: '<a href="/inicio">Inicio</a><a class="active" href="/admin">Admin</a>',
            body:
                '<section class="auth-shell centered">' +
                '<p class="ref">[ ADMIN ACCESS ]</p>' +
                "<h2>Acceso Administrador</h2><p class='muted'>Ingresa con credenciales de gestion operativa.</p>" +
                '<form id="admin-login-form" class="auth-form">' +
                '<label>Usuario<input name="username" required></label>' +
                '<label>Contrasena<input name="password" type="password" required></label>' +
                '<button class="primary" type="submit">Entrar</button>' +
                "</form></section>"
        });

        var form = document.getElementById("admin-login-form");
        form.addEventListener("submit", async function (event) {
            event.preventDefault();
            var data = new FormData(form);
            try {
                var result = await api("/api/admin/login", {
                    method: "POST",
                    body: JSON.stringify({
                        username: data.get("username"),
                        password: data.get("password")
                    })
                });
                writeStorage(ADMIN_SESSION_KEY, result);
                saveFlash("success", "Panel administrativo habilitado.");
                redirect("/admin");
            } catch (error) {
                saveFlash("error", error.message);
                redirect("/admin");
            }
        });
    }

    async function renderAdminPanel() {
        if (!adminSession()) {
            renderAdminLogin();
            return;
        }
        adminShell("Panel Administrativo", "/admin",
            '<div class="kpi-grid">' +
            '<section class="kpi-card"><small>USUARIOS</small><div class="stat" id="stat-users">0</div></section>' +
            '<section class="kpi-card"><small>PENDIENTES</small><div class="stat" id="stat-pending">0</div></section>' +
            '<section class="kpi-card"><small>VOLUMEN 24H</small><div class="stat" id="stat-volume">$0.00</div></section>' +
            '<section class="kpi-card warning"><small>ALERTAS RIESGO</small><div class="stat" id="stat-risk">0</div></section>' +
            "</div>"
        );
        var stats = await api("/api/admin/stats");
        document.getElementById("stat-users").textContent = String(stats.totalUsers || 0);
        document.getElementById("stat-pending").textContent = String(stats.pendingAccounts || 0);
        document.getElementById("stat-volume").textContent = formatMoney(stats.volume24h || 0);
        document.getElementById("stat-risk").textContent = String(stats.riskAlerts || 0);
    }

    async function renderAdminTransactions() {
        if (!guardAdmin()) return;
        adminShell("Monitoreo de Transacciones", "/admin/monitoreo",
            '<section class="card panel"><h3>Transacciones recientes</h3><div id="admin-tx-table" class="muted">Cargando...</div></section>'
        );
        var allTx = await api("/api/transactions");
        var rows = allTx.map(function (tx) {
            var sourceLabel = tx.sourceAccount ? tx.sourceAccount.accountNumber : "-";
            var targetLabel = tx.targetAccount ? tx.targetAccount.accountNumber : "-";
            return "<tr>" +
                "<td>" + escapeHtml(tx.type || "-") + "</td>" +
                "<td>" + formatMoney(tx.amount) + "</td>" +
                "<td class='mono'>" + escapeHtml(sourceLabel) + "</td>" +
                "<td class='mono'>" + escapeHtml(targetLabel) + "</td>" +
                "<td>" + formatDate(tx.createdAt) + "</td>" +
                "</tr>";
        }).join("");
        document.getElementById("admin-tx-table").innerHTML = rows ?
            '<table><thead><tr><th>Tipo</th><th>Monto</th><th>Origen</th><th>Destino</th><th>Fecha</th></tr></thead><tbody>' + rows + "</tbody></table>" :
            '<p class="muted">Sin transacciones registradas.</p>';
    }

    async function renderAdminUsers() {
        if (!guardAdmin()) return;
        adminShell("Directorio de Usuarios", "/admin/usuarios",
            '<section class="card panel"><h3>Clientes</h3><div id="admin-users-table" class="muted">Cargando...</div></section>'
        );
        var customers = await api("/api/admin/customers");
        var rows = customers.map(function (customer) {
            return "<tr>" +
                "<td>" + escapeHtml(customer.id) + "</td>" +
                "<td>" + escapeHtml(customer.customerId || "-") + "</td>" +
                "<td>" + escapeHtml(customer.fullName || "-") + "</td>" +
                "<td>" + escapeHtml(customer.status || "-") + "</td>" +
                "<td>" +
                '<button class="secondary" data-action="lock" data-id="' + customer.id + '">Bloquear</button> ' +
                '<button class="secondary" data-action="unlock" data-id="' + customer.id + '">Activar</button> ' +
                '<button class="secondary" data-action="reset" data-id="' + customer.id + '">Reset pass</button>' +
                "</td>" +
                "</tr>";
        }).join("");

        document.getElementById("admin-users-table").innerHTML = rows ?
            '<table><thead><tr><th>ID</th><th>Customer ID</th><th>Nombre</th><th>Estatus</th><th>Acciones</th></tr></thead><tbody>' + rows + "</tbody></table>" :
            '<p class="muted">No hay clientes.</p>';

        document.querySelectorAll("button[data-action]").forEach(function (button) {
            button.addEventListener("click", async function () {
                var id = button.getAttribute("data-id");
                var action = button.getAttribute("data-action");
                try {
                    if (action === "lock") {
                        await api("/api/admin/customers/" + id + "/lock", { method: "POST" });
                        saveFlash("success", "Cliente bloqueado.");
                    } else if (action === "unlock") {
                        await api("/api/admin/customers/" + id + "/unlock", { method: "POST" });
                        saveFlash("success", "Cliente activado.");
                    } else {
                        var password = window.prompt("Nueva contrasena:");
                        if (!password) return;
                        var admin = adminSession();
                        await api("/api/admin/customers/" + id + "/reset-password", {
                            method: "POST",
                            body: JSON.stringify({
                                password: password,
                                adminRole: admin.role || "ADMIN"
                            })
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

    var routes = {
        "/inicio": renderPublicHome,
        "/login": renderCustomerLogin,
        "/registro": renderRegister,
        "/dashboard": renderDashboard,
        "/cuentas": renderAccounts,
        "/transferencias": renderTransfers,
        "/movimientos": renderMovements,
        "/ahorro": renderSavings,
        "/perfil": renderProfile,
        "/tarjetas": renderCards,
        "/admin": renderAdminPanel,
        "/admin/monitoreo": renderAdminTransactions,
        "/admin/usuarios": renderAdminUsers
    };

    async function bootstrap() {
        var path = window.location.pathname;
        if (path.length > 1 && path.endsWith("/")) {
            path = path.slice(0, -1);
        }
        if (path === "/") {
            redirect("/inicio");
            return;
        }
        var handler = routes[path] || renderPublicHome;
        try {
            await handler();
        } catch (error) {
            renderLayout({
                nav: '<a href="/inicio">Inicio</a>',
                body: '<section class="card"><h2>Error</h2><p class="muted">' + escapeHtml(error.message || "Error inesperado") + "</p></section>"
            });
        }
    }

    bootstrap();
})();
