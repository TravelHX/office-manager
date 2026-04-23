document.addEventListener('DOMContentLoaded', async () => {
  try {
    const response = await fetch('/api/auth/check-users');
    const data = await response.json();
    if (data.hasUsers) {
      const formEl = document.getElementById('register-form');
      const infoEl = document.querySelector('.info-message');
      const closedEl = document.getElementById('registration-closed-message');
      if (formEl) {
        formEl.style.display = 'none';
      }
      if (infoEl && infoEl !== closedEl) {
        infoEl.style.display = 'none';
      }
      if (closedEl) {
        closedEl.style.display = 'block';
      }
      return;
    }
  } catch (e) {
    console.error('Error checking for users:', e);
  }

  const registerForm = document.getElementById('register-form');
  const errorDiv = document.getElementById('register-error');
  const successDiv = document.getElementById('register-success');
  const registerButton = document.getElementById('register-button');

  // Password toggle functionality
  const passwordToggle = document.getElementById('password-toggle');
  const confirmPasswordToggle = document.getElementById('confirm-password-toggle');
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('confirmPassword');

  if (passwordToggle) {
    passwordToggle.addEventListener('click', () => {
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      document.getElementById('password-toggle-text').textContent = type === 'password' ? 'Show' : 'Hide';
    });
  }

  if (confirmPasswordToggle) {
    confirmPasswordToggle.addEventListener('click', () => {
      const type = confirmPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      confirmPasswordInput.setAttribute('type', type);
      document.getElementById('confirm-password-toggle-text').textContent = type === 'password' ? 'Show' : 'Hide';
    });
  }

  if (!registerForm) {
    return;
  }

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const email = document.getElementById('email').value.trim();
    const officeLocation = document.getElementById('officeLocation').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';

    // Validation
    if (!email || !password) {
      errorDiv.textContent = 'Email and password are required';
      errorDiv.style.display = 'block';
      return;
    }

    if (password.length < 6) {
      errorDiv.textContent = 'Password must be at least 6 characters long';
      errorDiv.style.display = 'block';
      return;
    }

    if (password !== confirmPassword) {
      errorDiv.textContent = 'Passwords do not match';
      errorDiv.style.display = 'block';
      return;
    }

    registerButton.disabled = true;
    registerButton.textContent = 'Creating Account...';

    try {
      const body = {
        email,
        password,
      };

      if (firstName) {
        body.first_name = firstName;
      }
      if (lastName) {
        body.last_name = lastName;
      }
      if (officeLocation) {
        body.office_location = officeLocation;
      }

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Registration failed');
      }

      // Store token and user
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Show success message
      successDiv.textContent = data.message || 'Registration successful! Redirecting...';
      successDiv.style.display = 'block';

      // Redirect to home page
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (error) {
      errorDiv.textContent = error.message || 'Registration failed. Please try again.';
      errorDiv.style.display = 'block';
      registerButton.disabled = false;
      registerButton.textContent = 'Create Administrator Account';
    }
  });
});
