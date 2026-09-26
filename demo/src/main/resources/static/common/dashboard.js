/**
 * ATLAS BANK - Dashboard Dinámico
 * Carga de datos y actualizaciones en tiempo real
 */

class Dashboard {
    constructor() {
        this.userData = null;
        this.transactions = [];
        this.init();
    }

    init() {
        this.loadUserData();
        this.loadTransactions();
        this.setupEventListeners();
        this.setupLogoutButton();
    }

    async loadUserData() {
        try {
            const token = localStorage.getItem('authToken');
            const userId = localStorage.getItem('userId');

            if (!token || !userId) {
                window.location.href = '/auth/login.html';
                return;
            }

            const response = await fetch(`/api/customers/${userId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                this.userData = await response.json();
                this.updateUserDisplay();
            } else if (response.status === 401) {
                localStorage.clear();
                window.location.href = '/auth/login.html';
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    async loadTransactions() {
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch('/api/transactions?limit=5', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                this.transactions = await response.json();
                this.updateTransactionsDisplay();
            }
        } catch (error) {
            console.error('Error loading transactions:', error);
        }
    }

    updateUserDisplay() {
        if (!this.userData) return;

        // Actualizar información del usuario en el header
        const userNameEl = document.querySelector('.user-name');
        const userRoleEl = document.querySelector('.user-role');
        const avatarEl = document.querySelector('.avatar');

        if (userNameEl) userNameEl.textContent = this.userData.fullName;
        if (userRoleEl) userRoleEl.textContent = this.userData.role || 'Cliente';
        if (avatarEl) {
            const initials = this.userData.fullName
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase();
            avatarEl.textContent = initials.slice(0, 2);
        }
    }

    updateTransactionsDisplay() {
        const container = document.querySelector('.transactions-list');
        if (!container) return;

        // Limpiar contenedor existente
        container.innerHTML = '';

        if (this.transactions.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--gris-claro); padding: var(--spacing-xl);">No hay movimientos disponibles</p>';
            return;
        }

        this.transactions.forEach(transaction => {
            const item = document.createElement('div');
            item.className = 'transaction-item';
            
            const amount = parseFloat(transaction.amount);
            const isPositive = amount > 0;

            item.innerHTML = `
                <div class="transaction-info">
                    <h4>${this.sanitize(transaction.description)}</h4>
                    <p>${this.formatDate(transaction.date)}</p>
                </div>
                <div class="transaction-amount ${isPositive ? 'positive' : 'negative'}">
                    ${isPositive ? '+' : ''}${this.formatCurrency(amount)}
                </div>
            `;

            container.appendChild(item);
        });
    }

    setupEventListeners() {
        // Botones de acciones rápidas
        document.querySelectorAll('.action-link').forEach(link => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                if (href && href !== '#') {
                    window.location.href = href;
                }
            });
        });

        // Enlaces de navegación
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', function(e) {
                if (!this.classList.contains('logout')) {
                    const href = this.getAttribute('href');
                    if (href && href !== '#') {
                        window.location.href = href;
                    }
                }
            });
        });
    }

    setupLogoutButton() {
        const logoutBtn = document.querySelector('.nav-item.logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (confirm('¿Deseas cerrar sesión?')) {
                    localStorage.clear();
                    window.location.href = '/auth/login.html';
                }
            });
        }
    }

    formatCurrency(value) {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'USD'
        }).format(value);
    }

    formatDate(dateString) {
        try {
            const date = new Date(dateString);
            return new Intl.DateTimeFormat('es-ES', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }).format(date);
        } catch (error) {
            return dateString;
        }
    }

    sanitize(html) {
        const div = document.createElement('div');
        div.textContent = html;
        return div.innerHTML;
    }
}

// Inicializar dashboard cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    new Dashboard();
});
