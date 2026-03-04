document.addEventListener('DOMContentLoaded', async () => {
  const loginForm = document.getElementById('login-form');
  const loginButton = document.getElementById('login-button');
  const errorDiv = document.getElementById('login-error');
  const successDiv = document.getElementById('login-success');
  const passwordInput = document.getElementById('password');
  const passwordToggle = document.getElementById('password-toggle');
  const passwordToggleText = document.getElementById('password-toggle-text');

  // Password visibility toggle
  if (passwordToggle) {
    passwordToggle.addEventListener('click', () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      passwordToggleText.textContent = isPassword ? 'Hide' : 'Show';
      passwordToggle.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
    });
  }

  // Check if user is already logged in
  if (getAuthToken()) {
    // Redirect to home page
    window.location.href = '/';
    return;
  }

  // Check if any users exist - if not, redirect to registration
  try {
    const response = await fetch('/api/auth/check-users');
    const data = await response.json();
    
    if (!data.hasUsers) {
      // No users exist - redirect to registration
      window.location.href = '/pages/register.html';
      return;
    }
  } catch (error) {
    console.error('Error checking for users:', error);
    // Continue with login if check fails
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    // Clear previous messages
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';
    loginButton.disabled = true;
    loginButton.textContent = 'Logging in...';

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Login failed');
      }

      // Store token in localStorage
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Show success message
      successDiv.textContent = 'Login successful! Redirecting...';
      successDiv.style.display = 'block';

      // Redirect to home page or return URL
      const returnUrl = new URLSearchParams(window.location.search).get('return') || '/';
      setTimeout(() => {
        window.location.href = returnUrl;
      }, 1000);
    } catch (error) {
      errorDiv.textContent = error.message || 'Login failed. Please try again.';
      errorDiv.style.display = 'block';
      loginButton.disabled = false;
      loginButton.textContent = 'Login';
    }
  });
});

