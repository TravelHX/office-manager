// Notification System

class NotificationManager {
    constructor() {
        this.container = null;
        this.init();
    }

    init() {
        if (!document.getElementById('notification-container')) {
            this.container = document.createElement('div');
            this.container.id = 'notification-container';
            this.container.className = 'notification-container';
            document.body.appendChild(this.container);
        } else {
            this.container = document.getElementById('notification-container');
        }
    }

    show(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const icon = this.getIcon(type);
        notification.innerHTML = `
            <span>${icon}</span>
            <span>${message}</span>
            <button class="notification-close" onclick="this.parentElement.remove()">&times;</button>
        `;
        
        this.container.appendChild(notification);
        
        if (duration > 0) {
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.style.animation = 'slideOut 0.3s ease-out';
                    setTimeout(() => {
                        notification.remove();
                    }, 300);
                }
            }, duration);
        }
        
        return notification;
    }

    success(message, duration = 5000) {
        return this.show(message, 'success', duration);
    }

    error(message, duration = 5000) {
        return this.show(message, 'error', duration);
    }

    info(message, duration = 5000) {
        return this.show(message, 'info', duration);
    }

    warning(message, duration = 5000) {
        return this.show(message, 'warning', duration);
    }

    getIcon(type) {
        const icons = {
            success: '✓',
            error: '✕',
            info: 'ℹ',
            warning: '⚠',
        };
        return icons[type] || icons.info;
    }
}

const notifications = new NotificationManager();

function showNotification(message, type = 'info') {
    notifications.show(message, type);
}

function showSuccessNotification(message) {
    notifications.success(message);
}

function showErrorNotification(message) {
    notifications.error(message);
}

function showInfoNotification(message) {
    notifications.info(message);
}

function showWarningNotification(message) {
    notifications.warning(message);
}

