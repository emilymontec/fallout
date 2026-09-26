/**
 * ATLAS BANK - Módulo de Autenticación
 * Gestión de login, validación y seguridad
 */

class AuthManager {
    constructor() {
        this.isInitialized = false;
        this.currentUser = null;
        this.init();
    }

    init() {
        if (this.isInitialized) return;
        
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        this.isInitialized = true;
    }

    async handleLogin(e) {
        e.preventDefault();

        const username = document.getElementById('username')?.value;
        const password = document.getElementById('password')?.value;
        const loginBtn = document.getElementById('loginBtn');
        const alertContainer = document.getElementById('alertContainer');

        if (!username || !password) {
            this.showAlert('Por favor completa todos los campos', 'error', alertContainer);
            return;
        }

        // Desabilitar botón durante la petición
        if (loginBtn) {
            loginBtn.disabled = true;
            loginBtn.textContent = 'Verificando...';
        }

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                // Guardar datos de sesión
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('userId', data.userId);
                localStorage.setItem('userName', data.fullName);
                localStorage.setItem('userRole', data.role);

                this.showAlert('¡Bienvenido! Redirigiendo...', 'success', alertContainer);

                // Redirigir después de un breve delay
                setTimeout(() => {
                    window.location.href = '/app/dashboard.html';
                }, 1000);
            } else {
                this.showAlert(data.message || 'Credenciales inválidas', 'error', alertContainer);
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showAlert('Error de conexión. Intenta más tarde.', 'error', alertContainer);
        } finally {
            if (loginBtn) {
                loginBtn.disabled = false;
                loginBtn.textContent = 'Verificar Identidad';
            }
        }
    }

    showAlert(message, type, container) {
        if (!container) return;

        container.innerHTML = `
            <div class="alert alert-${type} show" role="alert">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span>${message}</span>
                    <button class="alert-close" aria-label="Cerrar alerta" style="background: none; border: none; font-size: 1.25rem; cursor: pointer;">&times;</button>
                </div>
            </div>
        `;

        const closeBtn = container.querySelector('.alert-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                container.innerHTML = '';
            });
        }
    }

    static logout() {
        localStorage.clear();
        window.location.href = '/auth/login.html';
    }

    static isAuthenticated() {
        return !!localStorage.getItem('authToken');
    }

    static getAuthToken() {
        return localStorage.getItem('authToken');
    }

    static getUserData() {
        return {
            id: localStorage.getItem('userId'),
            name: localStorage.getItem('userName'),
            role: localStorage.getItem('userRole')
        };
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    new AuthManager();
});

// Proteger páginas que requieren autenticación
document.addEventListener('DOMContentLoaded', () => {
    const currentPath = window.location.pathname;
    const protectedPaths = ['/app/', '/customer/', '/admin/'];
    const isProtected = protectedPaths.some(path => currentPath.startsWith(path));

    if (isProtected && !AuthManager.isAuthenticated()) {
        window.location.href = '/auth/login.html';
    }
});
