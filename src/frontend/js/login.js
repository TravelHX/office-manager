document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const loginButton = document.getElementById('login-button');
  const errorDiv = document.getElementById('login-error');
  const successDiv = document.getElementById('login-success');

  // Check if user is already logged in
  if (getAuthToken()) {
    // Redirect to home page
    window.location.href = '/';
    return;
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

