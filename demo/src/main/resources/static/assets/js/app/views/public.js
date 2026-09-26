import { customerApi, adminApi } from "../api.js";
import { renderLayout, renderStandalone } from "../ui.js";
import { saveAdminSession, saveCustomerSession, saveFlash } from "../state.js";

function redirect(path) {
    window.location.href = path;
}

export function renderPublicHome() {
    renderStandalone(`
        <nav class="front-nav">
            <div class="logo">BV. SYSTEM</div>
            <div class="nav-links">
                <a href="/inicio">Banca</a>
                <a href="/dashboard">Dashboard</a>
                <a href="/login" class="active-link">Acceso Clientes</a>
                <a href="/admin">Admin</a>
            </div>
        </nav>
        <main>
            <section class="hero">
                <div class="hero-content">
                    <h1>UN BANCO<br>PARA EL<br>MANANA.</h1>
                    <p>Capital con trazabilidad. Operaciones digitales con enfoque sustentable.</p>
                    <div class="row wrap"><a class="primary" href="/registro">Empezar registro</a></div>
                </div>
                <div class="hero-cta">
                    <a href="/login" class="circle-btn">INICIAR<br>SESION</a>
                </div>
            </section>
            <section class="services-grid">
                <div class="service-card"><span>[ 01 ] AHORRO</span><h3>Cuentas con propósito ambiental.</h3></div>
                <div class="service-card"><span>[ 02 ] TRANSFERENCIAS</span><h3>Pagos y envíos seguros.</h3></div>
                <div class="service-card"><span>[ 03 ] DIGITAL</span><h3>Gestión nativa en línea.</h3></div>
                <div class="service-card"><span>[ 04 ] REPORTE</span><h3>Trazabilidad financiera total.</h3></div>
            </section>
        </main>
    `);
}

export function renderCustomerLogin() {
    renderStandalone(`
        <div class="auth-center">
            <div class="login-card">
                <div class="brand">BV. SYSTEM <span>ID-01</span></div>
                <h1>Acceso al sistema</h1>
                <p class="subtitle">Introduce tus credenciales para continuar.</p>
                <form id="customer-login-form">
                    <div class="form-group">
                        <label>Identificador de Usuario</label>
                        <input name="customerId" required>
                    </div>
                    <div class="form-group">
                        <label>Contrasena Maestra</label>
                        <input type="password" name="password" required>
                    </div>
                    <button class="btn-login" type="submit">Verificar Identidad</button>
                </form>
                <div class="login-footer">
                    <a href="/registro">Abrir cuenta</a>
                    <a href="/admin">Acceso admin</a>
                </div>
            </div>
        </div>
    `);

    const form = document.getElementById("customer-login-form");
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const data = new FormData(form);
        try {
            const result = await customerApi.login({
                customerId: data.get("customerId"),
                password: data.get("password")
            });
            saveCustomerSession(result);
            saveFlash("success", `Bienvenido, ${result.fullName || result.customerId}.`);
            redirect("/dashboard");
        } catch (error) {
            saveFlash("error", error.message);
            redirect("/login");
        }
    });
}

export function renderRegister() {
    renderLayout({
        layoutClass: "layout-auth",
        nav: '<a href="/login">Login</a><a class="active" href="/registro">Registro</a><a href="/inicio">Inicio</a>',
        body: `<section class="auth-shell centered">
            <p class="ref">[ ONBOARDING ]</p>
            <h2>Crear Cuenta</h2>
            <p class="muted">Registro rapido con creacion automatica de cuenta de ahorro inicial.</p>
            <form id="register-form" class="auth-form">
                <label>Customer ID<input name="customerId" required></label>
                <label>Nombre completo<input name="fullName" required></label>
                <label>Email<input name="email" type="email" required></label>
                <label>Telefono<input name="phone" required></label>
                <label>Contrasena<input type="password" name="password" required></label>
                <button class="primary" type="submit">Crear cuenta</button>
            </form>
        </section>`
    });

    const form = document.getElementById("register-form");
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const data = new FormData(form);
        try {
            await customerApi.create({
                customerId: data.get("customerId"),
                fullName: data.get("fullName"),
                firstName: "",
                lastName: "",
                email: data.get("email"),
                phone: data.get("phone"),
                password: data.get("password")
            });
            saveFlash("success", "Cuenta creada. Inicia sesion para continuar.");
            redirect("/login");
        } catch (error) {
            saveFlash("error", error.message);
            redirect("/registro");
        }
    });
}

export function renderAdminLogin() {
    renderStandalone(`
        <div class="auth-center">
            <div class="login-card">
                <div class="brand">BV. ADMIN <span>CORE</span></div>
                <h1>Acceso Administrador</h1>
                <p class="subtitle">Panel de supervision y control operativo.</p>
                <form id="admin-login-form">
                    <div class="form-group">
                        <label>Usuario</label>
                        <input name="username" required>
                    </div>
                    <div class="form-group">
                        <label>Contrasena</label>
                        <input type="password" name="password" required>
                    </div>
                    <button class="btn-login" type="submit">Entrar</button>
                </form>
            </div>
        </div>
    `);

    const form = document.getElementById("admin-login-form");
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const data = new FormData(form);
        try {
            const result = await adminApi.login({
                username: data.get("username"),
                password: data.get("password")
            });
            saveAdminSession(result);
            saveFlash("success", "Sesion administrativa iniciada.");
            redirect("/admin");
        } catch (error) {
            saveFlash("error", error.message);
            redirect("/admin");
        }
    });
}
