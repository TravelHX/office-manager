// Office Manager Main JavaScript

const API_BASE_URL = 'http://localhost:3000';

// Simple authentication - store user token in localStorage
// For Phase 2, we'll use a simple token system
function getAuthToken() {
    // Check if we're on an admin page
    const isAdminPage = window.location.pathname.includes('admin') || 
                       window.location.pathname === '/admin' ||
                       window.location.pathname === '/pages/admin.html';
    
    const tokenKey = isAdminPage ? 'admin_auth_token' : 'auth_token';
    const tokenPrefix = isAdminPage ? 'admin_' : 'user_';
    // Use userId = 1 for development (must exist in database)
    const userId = 1;
    
    let token = localStorage.getItem(tokenKey);
    if (!token) {
        // For development, create a simple token with appropriate prefix and userId
        token = tokenPrefix + userId;
        localStorage.setItem(tokenKey, token);
    }
    return token;
}

async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = getAuthToken();
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
    };

    const config = { ...defaultOptions, ...options };
    
    if (config.body && typeof config.body === 'object') {
        config.body = JSON.stringify(config.body);
    }

    try {
        const response = await fetch(url, config);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error?.message || 'API request failed');
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

document.addEventListener('DOMContentLoaded', () => {
    console.log('Office Manager application loaded');
});

