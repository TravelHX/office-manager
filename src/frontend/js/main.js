// Office Manager Main JavaScript

const API_BASE_URL = 'https://office-manager-app.azurewebsites.net';

// Authentication functions
function getAuthToken() {
    return localStorage.getItem('authToken');
}

function setAuthToken(token) {
    localStorage.setItem('authToken', token);
}

function clearAuthToken() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
}

function getCurrentUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
}

function setCurrentUser(user) {
    localStorage.setItem('user', JSON.stringify(user));
}

function isAuthenticated() {
    return !!getAuthToken();
}

function isAdmin() {
    const user = getCurrentUser();
    return user && user.role === 'admin';
}

function requireAuth() {
    if (!isAuthenticated()) {
        const currentPath = window.location.pathname;
        window.location.href = `/pages/login.html?return=${encodeURIComponent(currentPath)}`;
        return false;
    }
    return true;
}

// Check authentication on page load for protected pages
document.addEventListener('DOMContentLoaded', () => {
    // Pages that require authentication
    const protectedPages = [
        '/pages/desk-booking.html',
        '/pages/parking.html',
        '/pages/overtime.html',
        '/pages/bookings.html',
        '/pages/admin.html',
    ];

    const currentPath = window.location.pathname;
    const isProtectedPage = protectedPages.some(page => currentPath.includes(page));

    if (isProtectedPage && !isAuthenticated()) {
        // Don't redirect from login page
        if (!currentPath.includes('login.html')) {
            window.location.href = `/pages/login.html?return=${encodeURIComponent(currentPath)}`;
        }
    }

    // Update user indicator if authenticated
    updateUserIndicator();
});

async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = getAuthToken();
    
    const defaultHeaders = {
        'Content-Type': 'application/json',
    };
    
    // Only add Authorization header if token exists
    if (token) {
        defaultHeaders['Authorization'] = `Bearer ${token}`;
    }
    
    const defaultOptions = {
        headers: defaultHeaders,
    };

    const config = { ...defaultOptions, ...options };
    
    // Merge headers properly
    if (options.headers) {
        config.headers = { ...defaultHeaders, ...options.headers };
    }
    
    if (config.body && typeof config.body === 'object') {
        config.body = JSON.stringify(config.body);
    }

    try {
        const response = await fetch(url, config);
        
        // Handle 204 No Content (empty response body)
        if (response.status === 204) {
            return null;
        }
        
        // Check if response has content before parsing JSON
        const contentType = response.headers.get('content-type');
        const hasJsonContent = contentType && contentType.includes('application/json');
        
        let data = null;
        if (hasJsonContent) {
            // Get text first to check if body is empty
            const text = await response.text();
            if (text) {
                data = JSON.parse(text);
            }
        }
        
        if (!response.ok) {
            // Handle authentication errors
            if (response.status === 401) {
                // Clear invalid token and redirect to login
                clearAuthToken();
                const currentPath = window.location.pathname;
                if (!currentPath.includes('login.html')) {
                    window.location.href = `/pages/login.html?return=${encodeURIComponent(currentPath)}`;
                }
            }
            throw new Error(data?.error?.message || 'API request failed');
        }
        
        return data;
    } catch (error) {
        console.error('API request error:', error);
        throw error;
    }
}

function showError(message) {
    if (typeof showErrorNotification !== 'undefined') {
        showErrorNotification(message);
    } else {
        const container = document.querySelector('.container');
        if (container) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error';
            errorDiv.textContent = message;
            container.insertBefore(errorDiv, container.firstChild);
            
            setTimeout(() => {
                errorDiv.remove();
            }, 5000);
        }
    }
}

function showSuccess(message) {
    if (typeof showSuccessNotification !== 'undefined') {
        showSuccessNotification(message);
    } else {
        const container = document.querySelector('.container');
        if (container) {
            const successDiv = document.createElement('div');
            successDiv.className = 'success';
            successDiv.textContent = message;
            container.insertBefore(successDiv, container.firstChild);
            
            setTimeout(() => {
                successDiv.remove();
            }, 5000);
        }
    }
}

// Update user indicator in navigation
function updateUserIndicator() {
    const user = getCurrentUser();
    const navMenu = document.querySelector('.nav-menu');
    
    if (!navMenu) return;

    // Remove existing user indicator
    const existingIndicator = document.querySelector('.user-indicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }

    if (user) {
        // Add user indicator
        const userIndicator = document.createElement('li');
        userIndicator.className = 'user-indicator';
        userIndicator.innerHTML = `
            <span style="color: #4CAF50; font-weight: 500;">
                ${user.username} ${user.role === 'admin' ? '(Admin)' : ''}
            </span>
            <a href="#" onclick="logout(); return false;" style="margin-left: 10px; color: #d32f2f;">Logout</a>
        `;
        navMenu.appendChild(userIndicator);
    } else {
        // Add login link
        const loginLink = document.createElement('li');
        loginLink.innerHTML = '<a href="/pages/login.html">Login</a>';
        navMenu.appendChild(loginLink);
    }
}

// Logout function
async function logout() {
    try {
        const token = getAuthToken();
        if (token) {
            // Call logout endpoint
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
        }
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        clearAuthToken();
        window.location.href = '/';
    }
}

// Make logout available globally
window.logout = logout;

