/**
 * ATLAS BANK - Utilidades Comunes
 * Sistema de funciones reutilizables
 */

// Utilidades de localStorage
const storage = {
    set: (key, value) => localStorage.setItem(key, JSON.stringify(value)),
    get: (key) => {
        try {
            return JSON.parse(localStorage.getItem(key));
        } catch {
            return null;
        }
    },
    remove: (key) => localStorage.removeItem(key),
    clear: () => localStorage.clear()
};

// Utilidades de notificaciones
const notifications = {
    show: (message, type = 'info', duration = 3000) => {
        const alertEl = document.getElementById('alertContainer') || document.querySelector('[role="alert"]');
        if (!alertEl) return;

        const alert = document.createElement('div');
        alert.className = `alert alert-${type} show`;
        alert.setAttribute('role', 'alert');
        alert.innerHTML = `
            <div class="alert-content">
                <span>${message}</span>
                <button class="alert-close" aria-label="Cerrar alerta">&times;</button>
            </div>
        `;

        alertEl.appendChild(alert);

        const closeBtn = alert.querySelector('.alert-close');
        closeBtn.addEventListener('click', () => alert.remove());

        if (duration > 0) {
            setTimeout(() => alert.remove(), duration);
        }
    },
    success: (message) => notifications.show(message, 'success'),
    error: (message) => notifications.show(message, 'error'),
    warning: (message) => notifications.show(message, 'advertencia'),
    info: (message) => notifications.show(message, 'info')
};

// Utilidades de validación
const validators = {
    email: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    phone: (phone) => /^\+?[1-9]\d{1,14}$/.test(phone.replace(/\D/g, '')),
    currency: (value) => /^\$?[0-9]+(?:,[0-9]{3})*(?:\.[0-9]{2})?$/.test(value),
    accountNumber: (number) => /^\d{16,}$/.test(number.replace(/\D/g, '')),
    clabe: (clabe) => /^\d{18}$/.test(clabe.replace(/\s/g, ''))
};

// Utilidades de formato
const formatters = {
    currency: (value) => {
        const num = parseFloat(value);
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'USD'
        }).format(num);
    },
    date: (date) => {
        return new Intl.DateTimeFormat('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }).format(new Date(date));
    },
    cardNumber: (number) => {
        return number.replace(/\s/g, '').replace(/(\d{4})/g, '$1 ').trim();
    },
    phone: (phone) => {
        const cleaned = phone.replace(/\D/g, '');
        return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
    },
    percentage: (value, decimals = 2) => {
        return (parseFloat(value) * 100).toFixed(decimals) + '%';
    }
};

// Utilidades de API
const api = {
    baseUrl: '/api',
    
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    },

    post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
};

// Utilidades de seguridad
const security = {
    sanitize: (html) => {
        const div = document.createElement('div');
        div.textContent = html;
        return div.innerHTML;
    },

    validateCSRF: () => {
        const token = document.querySelector('meta[name="csrf-token"]')?.content;
        return token;
    },

    logout: () => {
        storage.clear();
        window.location.href = '/auth/login.html';
    }
};

// Utilidades de animación
const animations = {
    fadeIn: (element, duration = 300) => {
        element.style.opacity = '0';
        element.classList.add('animate-fadeIn');
        setTimeout(() => {
            element.style.opacity = '1';
        }, 10);
    },

    slideIn: (element, direction = 'left', duration = 300) => {
        element.classList.add(`animate-slideIn${direction.charAt(0).toUpperCase() + direction.slice(1)}`);
    }
};

// Inicialización de elementos interactivos comunes
document.addEventListener('DOMContentLoaded', () => {
    // Copiar al portapapeles
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const text = btn.previousElementSibling?.textContent || btn.dataset.copyText;
            if (text) {
                navigator.clipboard.writeText(text.trim()).then(() => {
                    notifications.success('Copiado al portapapeles');
                    btn.textContent = 'Copiado';
                    setTimeout(() => {
                        btn.textContent = 'Copiar';
                    }, 2000);
                }).catch(() => {
                    notifications.error('Error al copiar');
                });
            }
        });
    });

    // Cerrar alertas
    document.querySelectorAll('.alert-close').forEach(btn => {
        btn.addEventListener('click', function() {
            this.closest('.alert').remove();
        });
    });
});

export { storage, notifications, validators, formatters, api, security, animations };
