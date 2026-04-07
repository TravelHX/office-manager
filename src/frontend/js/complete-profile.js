function getTokenFromQuery() {
    const params = new URLSearchParams(window.location.search);
    return params.get('token') || '';
}

async function validateToken(token) {
    const res = await fetch(`/api/auth/provision/validate?token=${encodeURIComponent(token)}`);
    return res.json();
}

async function runCompleteProfilePage() {
    const token = getTokenFromQuery();
    const tokenError = document.getElementById('token-error');
    const form = document.getElementById('complete-profile-form');
    const emailEl = document.getElementById('provision-email');
    const messageDiv = document.getElementById('complete-message');

    if (!token) {
        tokenError.style.display = 'block';
        tokenError.textContent = 'Missing setup token. Ask your administrator for a profile setup link.';
        return;
    }

    try {
        const data = await validateToken(token);
        if (!data.valid) {
            tokenError.style.display = 'block';
            tokenError.textContent = data.reason || 'This setup link is not valid.';
            return;
        }
        emailEl.textContent = `Email: ${data.email}`;
        form.style.display = 'block';
    } catch (e) {
        tokenError.style.display = 'block';
        tokenError.textContent = 'Could not validate setup link. Try again later.';
    }

    form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        messageDiv.innerHTML = '';
        const office_location = document.getElementById('officeLocation').value;
        const password = document.getElementById('newPassword').value;
        const confirm = document.getElementById('confirmPassword').value;

        if (password !== confirm) {
            messageDiv.innerHTML = '<div class="error">Passwords do not match.</div>';
            return;
        }

        const submitBtn = document.getElementById('submitBtn');
        submitBtn.disabled = true;

        try {
            const res = await fetch('/api/auth/complete-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password, office_location }),
            });
            const body = await res.json().catch(() => ({}));

            if (!res.ok) {
                messageDiv.innerHTML = `<div class="error">${body.error?.message || 'Setup failed.'}</div>`;
                submitBtn.disabled = false;
                return;
            }

            if (body.token && body.user) {
                localStorage.setItem('authToken', body.token);
                localStorage.setItem('user', JSON.stringify(body.user));
            }

            messageDiv.innerHTML = '<div class="success">Profile complete. Redirecting...</div>';
            setTimeout(() => {
                window.location.href = '/';
            }, 1500);
        } catch (err) {
            messageDiv.innerHTML = '<div class="error">Network error. Please try again.</div>';
            submitBtn.disabled = false;
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    runCompleteProfilePage();
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runCompleteProfilePage, getTokenFromQuery, validateToken };
}
