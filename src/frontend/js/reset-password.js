document.addEventListener('DOMContentLoaded', () => {
  const resetPasswordForm = document.getElementById('reset-password-form');
  const errorDiv = document.getElementById('reset-password-error');
  const successDiv = document.getElementById('reset-password-success');
  const submitButton = document.getElementById('submit-button');

  // Get token from URL if present
  const urlParams = new URLSearchParams(window.location.search);
  const tokenFromUrl = urlParams.get('token');
  if (tokenFromUrl) {
    document.getElementById('token').value = tokenFromUrl;
  }

  // Password toggle functionality
  const passwordToggle = document.getElementById('password-toggle');
  const confirmPasswordToggle = document.getElementById('confirm-password-toggle');
  const newPasswordInput = document.getElementById('newPassword');
  const confirmPasswordInput = document.getElementById('confirmPassword');

  if (passwordToggle) {
    passwordToggle.addEventListener('click', () => {
      const type = newPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      newPasswordInput.setAttribute('type', type);
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

  if (!resetPasswordForm) {
    return;
  }

  resetPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const token = document.getElementById('token').value.trim();
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';

    if (!token) {
      errorDiv.textContent = 'Reset token is required';
      errorDiv.style.display = 'block';
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      errorDiv.textContent = 'Password must be at least 6 characters long';
      errorDiv.style.display = 'block';
      return;
    }

    if (newPassword !== confirmPassword) {
      errorDiv.textContent = 'Passwords do not match';
      errorDiv.style.display = 'block';
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Resetting...';

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to reset password');
      }

      successDiv.textContent = data.message || 'Password has been reset successfully. You can now login with your new password.';
      successDiv.style.display = 'block';
      
      // Clear form
      document.getElementById('token').value = '';
      document.getElementById('newPassword').value = '';
      document.getElementById('confirmPassword').value = '';

      // Redirect to login after 3 seconds
      setTimeout(() => {
        window.location.href = '/pages/login.html';
      }, 3000);
    } catch (error) {
      errorDiv.textContent = error.message || 'Failed to reset password. Please try again.';
      errorDiv.style.display = 'block';
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Reset Password';
    }
  });
});
