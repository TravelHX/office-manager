// Office Manager Main JavaScript

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

/**
 * Refresh stored user from GET /api/auth/me (fixes stale localStorage missing role/isAdmin).
 */
async function syncCurrentUserFromServer() {
    const token = getAuthToken();
    if (!token) {
        return null;
    }
    try {
        const res = await fetch('/api/auth/me', {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });
        if (res.ok) {
            const user = await res.json();
            setCurrentUser(user);
            return user;
        }
    } catch (e) {
        console.warn('Could not sync user from server', e);
    }
    return null;
}

/**
 * True if the server grants the same access as the User Management UI (GET /api/auth/users).
 * Prefer this over local isAdmin() when deciding whether to show admin-only navigation.
 */
async function serverAllowsUserManagement() {
    const token = getAuthToken();
    if (!token) {
        return false;
    }
    try {
        const res = await fetch('/api/auth/users', {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
            },
        });
        return res.status === 200;
    } catch (e) {
        console.warn('Could not verify user management access', e);
        return false;
    }
}

function isAuthenticated() {
    return !!getAuthToken();
}

function isAdmin() {
    const user = getCurrentUser();
    if (!user) {
        return false;
    }
    const role = String(user.role || '').trim().toLowerCase();
    if (role === 'admin') {
        return true;
    }
    if (user.isAdmin === true || user.isAdmin === 1 || user.isAdmin === '1') {
        return true;
    }
    if (user.is_admin === true || user.is_admin === 1 || user.is_admin === '1') {
        return true;
    }
    return false;
}

function requireAuth() {
    if (!isAuthenticated()) {
        const currentPath = (window.location && window.location.pathname) || '';
        window.location.href = `/pages/login.html?return=${encodeURIComponent(currentPath)}`;
        return false;
    }
    return true;
}

// Check authentication on page load for protected pages
document.addEventListener('DOMContentLoaded', async () => {
    // Pages that don't require authentication or user check
    const publicPages = [
        '/pages/login.html',
        '/pages/register.html',
        '/pages/forgot-password.html',
        '/pages/reset-password.html',
        '/pages/complete-profile.html',
    ];

    const currentPath = (window.location && window.location.pathname) || '';
    const isPublicPage = publicPages.some(page => currentPath.includes(page));

    // Check if any users exist - if not, redirect to registration (unless already on registration/login)
    if (!isPublicPage) {
        try {
            const response = await fetch('/api/auth/check-users');
            const data = await response.json();
            
            if (!data.hasUsers && !currentPath.includes('register.html') && !currentPath.includes('login.html')) {
                // No users exist - redirect to registration
                window.location.href = '/pages/register.html';
                return;
            }
        } catch (error) {
            console.error('Error checking for users:', error);
            // Continue if check fails
        }
    }

    // Pages that require authentication
    const protectedPages = [
        '/pages/desk-booking.html',
        '/pages/parking.html',
        '/pages/bookings.html',
        '/pages/admin.html',
        '/pages/matrix.html',
    ];

    const isProtectedPage = protectedPages.some(page => currentPath.includes(page));

    if (isProtectedPage && isAuthenticated()) {
        const u = getCurrentUser();
        if (u && u.profileComplete === false) {
            clearAuthToken();
            window.location.href = '/pages/login.html?setupPending=1';
            return;
        }
    }

    if (isProtectedPage && !isAuthenticated()) {
        // Don't redirect from login/register pages
        if (!currentPath.includes('login.html') && !currentPath.includes('register.html')) {
            window.location.href = `/pages/login.html?return=${encodeURIComponent(currentPath)}`;
        }
    }

    // Update user indicator if authenticated
    updateUserIndicator();
    initSidebarToggle();
    initSidebarActiveNav();

    // Load and display application version
    loadApplicationVersion();
});

function escapeHtml(text) {
    if (text == null) return '';
    const s = String(text);
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function initSidebarToggle() {
    const btn = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('site-sidebar');
    if (!btn || !sidebar) return;

    const collapsed = localStorage.getItem('sidebarCollapsed') === '1';
    if (collapsed) {
        document.body.classList.add('sidebar-collapsed');
        btn.setAttribute('aria-expanded', 'false');
    } else {
        btn.setAttribute('aria-expanded', 'true');
    }

    btn.addEventListener('click', () => {
        document.body.classList.toggle('sidebar-collapsed');
        const isCollapsed = document.body.classList.contains('sidebar-collapsed');
        localStorage.setItem('sidebarCollapsed', isCollapsed ? '1' : '0');
        btn.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
    });
}

function initSidebarActiveNav() {
    const rawPath = (window.location && window.location.pathname) || '/';
    const path = rawPath.replace(/\/$/, '') || '/';
    document.querySelectorAll('.sidebar-nav a[href]').forEach((a) => {
        try {
            const origin = (window.location && window.location.origin) || 'http://localhost';
            const u = new URL(a.getAttribute('href'), origin);
            let p = u.pathname.replace(/\/$/, '') || '/';
            if (p === path) {
                a.classList.add('active');
            }
        } catch {
            /* ignore */
        }
    });
}

function bindAccountDropdown(trigger, panel) {
    function closePanel() {
        panel.classList.remove('is-open');
        trigger.setAttribute('aria-expanded', 'false');
    }
    function openPanel() {
        panel.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
    }

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        if (panel.classList.contains('is-open')) {
            closePanel();
        } else {
            openPanel();
        }
    });

    document.addEventListener('click', (ev) => {
        if (!panel.classList.contains('is-open')) return;
        if (!trigger.contains(ev.target) && !panel.contains(ev.target)) {
            closePanel();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closePanel();
    });
}

// Load application version
async function loadApplicationVersion() {
    try {
        // Version endpoint is public, use fetch directly
        const response = await fetch('/api/version');
        if (!response.ok) {
            throw new Error('Failed to fetch version');
        }
        const data = await response.json();
        const versionElement = document.getElementById('version-number');
        if (versionElement && data && data.versionNumber) {
            versionElement.textContent = data.versionNumber;
            // Store version in localStorage for client-side access
            localStorage.setItem('appVersion', data.versionNumber);
        }
    } catch (error) {
        console.error('Failed to load application version:', error);
        const versionElement = document.getElementById('version-number');
        if (versionElement) {
            versionElement.textContent = 'Unknown';
        }
    }
}

// Get application version from localStorage or API
async function getApplicationVersion() {
    // Try localStorage first
    const cachedVersion = localStorage.getItem('appVersion');
    if (cachedVersion) {
        return cachedVersion;
    }
    
    // If not in localStorage, fetch from API
    try {
        // Version endpoint is public, use fetch directly
        const response = await fetch('/api/version');
        if (response.ok) {
            const data = await response.json();
            if (data && data.versionNumber) {
                localStorage.setItem('appVersion', data.versionNumber);
                return data.versionNumber;
            }
        }
    } catch (error) {
        console.error('Failed to get application version:', error);
    }
    
    return 'Unknown';
}

async function mainApiRequest(endpoint, options = {}) {
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
        const response = await fetch(endpoint, config);
        
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
                const currentPath = (window.location && window.location.pathname) || '';
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

// Account menu in app top bar (#account-menu-anchor); legacy .nav-menu fallback for pages without shell
function updateUserIndicator() {
    const anchor = document.getElementById('account-menu-anchor');
    const user = getCurrentUser();

    if (anchor) {
        anchor.innerHTML = '';

        const wrap = document.createElement('div');
        wrap.className = 'account-menu';

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'account-menu-trigger';
        trigger.setAttribute('aria-expanded', 'false');
        trigger.setAttribute('aria-haspopup', 'true');
        trigger.id = 'account-menu-trigger';

        const panel = document.createElement('div');
        panel.className = 'account-menu-panel';
        panel.id = 'account-menu-panel';
        panel.setAttribute('role', 'region');
        panel.setAttribute('aria-label', 'Account');

        if (user) {
            let displayName = user.username || '';
            if (user.firstName && user.lastName) {
                displayName = `${user.firstName} ${user.lastName}`;
            } else if (user.firstName) {
                displayName = user.firstName;
            } else if (user.email) {
                displayName = user.email;
            }

            const adminLabel = (user.isAdmin || user.role === 'admin') ? '<div class="account-panel-meta">Administrator</div>' : '';
            const emailLine = user.email ? `<div class="account-panel-meta">${escapeHtml(user.email)}</div>` : '';
            const officeLine = user.officeLocation
                ? `<div class="account-panel-meta">Office: ${escapeHtml(user.officeLocation)}</div>`
                : '';

            trigger.innerHTML = `<span class="account-trigger-label">${escapeHtml(displayName)}</span><span class="account-chevron" aria-hidden="true">&#9662;</span>`;

            const section = document.createElement('div');
            section.className = 'account-panel-section account-panel-user';
            section.innerHTML = `
                <div class="account-panel-name">${escapeHtml(displayName)}</div>
                ${adminLabel}
                ${emailLine}
                ${officeLine}
            `;

            const actions = document.createElement('div');
            actions.className = 'account-panel-actions';
            const logoutLink = document.createElement('a');
            logoutLink.href = '#';
            logoutLink.className = 'account-panel-link account-logout-link';
            logoutLink.textContent = 'Log out';
            logoutLink.addEventListener('click', (e) => {
                e.preventDefault();
                logout();
            });
            actions.appendChild(logoutLink);

            panel.appendChild(section);
            panel.appendChild(actions);
        } else {
            trigger.innerHTML = '<span class="account-trigger-label">Account</span><span class="account-chevron" aria-hidden="true">&#9662;</span>';
            const p = (window.location && window.location.pathname) || '';
            const q = (window.location && window.location.search) || '';
            const ret = encodeURIComponent(p + q);
            const actions = document.createElement('div');
            actions.className = 'account-panel-actions';
            actions.innerHTML = `
                <a href="/pages/login.html?return=${ret}" class="account-panel-link">Log in</a>
                <a href="/pages/register.html" class="account-panel-link">Register</a>
            `;
            panel.appendChild(actions);
        }

        wrap.appendChild(trigger);
        wrap.appendChild(panel);
        anchor.appendChild(wrap);
        bindAccountDropdown(trigger, panel);
        return;
    }

    const navMenu = document.querySelector('.nav-menu');
    if (!navMenu) return;

    const existingIndicator = document.querySelector('.user-indicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }

    if (user) {
        let displayName = user.username;
        if (user.firstName && user.lastName) {
            displayName = `${user.firstName} ${user.lastName}`;
        } else if (user.firstName) {
            displayName = user.firstName;
        } else if (user.email) {
            displayName = user.email;
        }

        const userIndicator = document.createElement('li');
        userIndicator.className = 'user-indicator';
        userIndicator.innerHTML = `
            <span style="font-weight: 500;">
                ${escapeHtml(displayName)} ${(user.isAdmin || user.role === 'admin') ? '(Admin)' : ''}
            </span>
            <a href="#" onclick="logout(); return false;" style="margin-left: 10px;">Logout</a>
        `;
        navMenu.appendChild(userIndicator);
    } else {
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

// Register API helper for other vanilla scripts (browser + Jest when main loads first)
if (typeof globalThis !== 'undefined') {
    globalThis.apiRequest = mainApiRequest;
    globalThis.getAuthToken = getAuthToken;
    globalThis.getCurrentUser = getCurrentUser;
    globalThis.isAuthenticated = isAuthenticated;
    globalThis.isAdmin = isAdmin;
    globalThis.requireAuth = requireAuth;
    globalThis.syncCurrentUserFromServer = syncCurrentUserFromServer;
    globalThis.serverAllowsUserManagement = serverAllowsUserManagement;
    globalThis.updateUserIndicator = updateUserIndicator;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getAuthToken,
        setAuthToken,
        clearAuthToken,
        getCurrentUser,
        setCurrentUser,
        isAuthenticated,
        isAdmin,
        syncCurrentUserFromServer,
        serverAllowsUserManagement,
        requireAuth,
        apiRequest: mainApiRequest,
        showError,
        showSuccess,
        updateUserIndicator,
        logout,
        escapeHtml,
        loadApplicationVersion,
        initSidebarToggle,
        initSidebarActiveNav,
    };
}

