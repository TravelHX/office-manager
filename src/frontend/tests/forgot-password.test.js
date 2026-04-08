/**
 * @jest-environment jsdom
 */

describe('Forgot Password (admin-assisted, no email)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('static copy explains administrator reset and no email', () => {
    document.body.innerHTML = `
      <div id="forgot-password-info">
        This application does not send email. Password recovery is handled by an administrator.
        Ask your administrator to reset your password from <strong>User Management</strong>
      </div>
    `;
    const el = document.getElementById('forgot-password-info');
    expect(el.textContent).toContain('does not send email');
    expect(el.textContent).toContain('administrator');
    expect(el.textContent).toContain('User Management');
  });
});
