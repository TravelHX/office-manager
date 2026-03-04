document.addEventListener('DOMContentLoaded', () => {
  const forgotPasswordForm = document.getElementById('forgot-password-form');
  const errorDiv = document.getElementById('forgot-password-error');
  const successDiv = document.getElementById('forgot-password-success');
  const submitButton = document.getElementById('submit-button');

  if (!forgotPasswordForm) {
    return;
  }

  forgotPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';

    if (!email) {
      errorDiv.textContent = 'Please enter your email address';
      errorDiv.style.display = 'block';
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Sending...';

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to send reset link');
      }

      // Always show success message (for security, don't reveal if email exists)
      successDiv.textContent = data.message || 'If an account with that email exists, a password reset link has been sent.';
      successDiv.style.display = 'block';
      
      // Clear form
      document.getElementById('email').value = '';
    } catch (error) {
      errorDiv.textContent = error.message || 'Failed to send reset link. Please try again.';
      errorDiv.style.display = 'block';
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Send Reset Link';
    }
  });
});
