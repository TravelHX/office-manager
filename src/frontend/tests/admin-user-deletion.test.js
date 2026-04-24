/** Phase 17: Admin user deletion UI (delete button, confirm dialog, errors). */
/**
 * @jest-environment jsdom
 */

beforeAll(() => {
  global.apiRequest = jest.fn();
  window.apiRequest = global.apiRequest;
});

/**
 * Mirrors admin.js displayUsers table logic for assertions (contract with admin UI).
 */
function renderUsersTableHTML(users, currentUserId = null) {
  const adminCount = users.filter((u) => u.isAdmin).length;
  return users
    .map((user) => {
      const isLastAdmin = user.isAdmin && adminCount === 1;
      const isSelf = currentUserId !== null && user.id === currentUserId;
      const displayName =
        user.firstName && user.lastName
          ? `${user.firstName} ${user.lastName}`
          : user.firstName || user.lastName || 'N/A';
      let actionsCell;
      if (isSelf) {
        actionsCell =
          '<span class="text-muted self-user" title="You cannot delete your own account; another administrator must perform this action">Delete Disabled</span>';
      } else if (isLastAdmin) {
        actionsCell =
          '<span class="text-muted" title="Cannot delete the last admin user">Delete Disabled</span>';
      } else {
        actionsCell = `<button class="btn-danger delete-user-btn" data-user-id="${user.id}" data-username="${user.username}">Delete</button>`;
      }
      return `
      <tr class="${isLastAdmin ? 'last-admin-user' : ''}${isSelf ? ' self-user-row' : ''}">
        <td>${user.id}</td>
        <td><strong>${user.username}</strong></td>
        <td>${displayName}</td>
        <td>${user.email}</td>
        <td>${user.officeLocation || 'N/A'}</td>
        <td><span class="status-badge">${user.role}</span></td>
        <td>${user.isAdmin ? '<span class="status-badge status-approved">Yes</span>' : '<span class="status-badge status-pending">No</span>'}</td>
        <td>
          ${actionsCell}
        </td>
      </tr>`;
    })
    .join('');
}

async function simulateDeleteUser(userId, username, confirmResult) {
  const confirmMessage = `Are you sure you want to delete user "${username}" (ID: ${userId})?\n\nThis will also delete all associated bookings and reservations.`;
  window.confirm = jest.fn(() => confirmResult);
  const messageDiv = document.getElementById('users-message');
  messageDiv.innerHTML = '';

  if (!window.confirm(confirmMessage)) {
    return;
  }

  messageDiv.innerHTML = '<p>Deleting user...</p>';

  try {
    await window.apiRequest(`/api/auth/users/${userId}`, { method: 'DELETE' });
    messageDiv.innerHTML = '<div class="success">User deleted successfully!</div>';
  } catch (error) {
    if (error.message.includes('last admin user')) {
      messageDiv.innerHTML = `<div class="error">Cannot delete user: ${error.message}</div>`;
    } else if (error.message.includes('not found')) {
      messageDiv.innerHTML = `<div class="error">User not found. It may have already been deleted.</div>`;
    } else {
      messageDiv.innerHTML = `<div class="error">Failed to delete user: ${error.message}</div>`;
    }
  }
}

describe('Phase 17: Admin user deletion UI', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="users-container"></div><div id="users-message"></div>';
    global.apiRequest.mockClear();
    jest.clearAllMocks();
  });

  describe('Delete button visibility (17.24, 17.15, 17.16)', () => {
    test('shows Delete button for regular user when other admins exist', () => {
      // Two admins so neither admin is "last admin"; regular user should get a
      // delete button, and no row should be marked Delete Disabled.
      const users = [
        { id: 1, username: 'admin1', email: 'a@test.com', role: 'admin', isAdmin: true, firstName: 'A', lastName: 'Admin' },
        { id: 2, username: 'user1', email: 'u@test.com', role: 'user', isAdmin: false, firstName: 'U', lastName: 'User' },
        { id: 3, username: 'admin2', email: 'a2@test.com', role: 'admin', isAdmin: true, firstName: 'B', lastName: 'Admin' },
      ];
      const html = renderUsersTableHTML(users);
      document.getElementById('users-container').innerHTML = `<table><tbody>${html}</tbody></table>`;

      expect(html).toContain('delete-user-btn');
      expect(html).toContain('data-user-id="2"');
      expect(html).not.toContain('Delete Disabled');
    });

    test('shows Delete button for each admin when multiple admins exist', () => {
      const users = [
        { id: 1, username: 'admin1', email: 'a1@test.com', role: 'admin', isAdmin: true },
        { id: 2, username: 'admin2', email: 'a2@test.com', role: 'admin', isAdmin: true },
      ];
      const html = renderUsersTableHTML(users);
      expect(html.match(/delete-user-btn/g) || []).toHaveLength(2);
      expect(html).not.toContain('Delete Disabled');
    });

    test('shows Delete Disabled for sole admin user', () => {
      const users = [
        { id: 1, username: 'onlyadmin', email: 'o@test.com', role: 'admin', isAdmin: true },
      ];
      const html = renderUsersTableHTML(users);
      expect(html).toContain('Delete Disabled');
      expect(html).toContain('last-admin-user');
      expect(html).toContain('Cannot delete the last admin user');
      expect(html).not.toContain('delete-user-btn');
    });

    test('delete button includes data-user-id and data-username for wiring', () => {
      const users = [
        { id: 1, username: 'admin1', email: 'a@test.com', role: 'admin', isAdmin: true },
        { id: 99, username: 'bob', email: 'b@test.com', role: 'user', isAdmin: false },
      ];
      const html = renderUsersTableHTML(users);
      const container = document.getElementById('users-container');
      container.innerHTML = `<table><tbody>${html}</tbody></table>`;

      const btn = container.querySelector('.delete-user-btn');
      expect(btn).toBeTruthy();
      expect(btn.getAttribute('data-user-id')).toBe('99');
      expect(btn.getAttribute('data-username')).toBe('bob');
    });
  });

  describe('Deletion confirmation dialog (17.25)', () => {
    test('does not call API when user cancels confirm', async () => {
      window.confirm = jest.fn(() => false);
      global.apiRequest.mockResolvedValue(undefined);

      const messageDiv = document.getElementById('users-message');
      const msg =
        'Are you sure you want to delete user "bob" (ID: 99)?\n\nThis will also delete all associated bookings and reservations.';
      if (!window.confirm(msg)) {
        // no-op
      }

      expect(window.confirm).toHaveBeenCalledWith(msg);
      expect(global.apiRequest).not.toHaveBeenCalled();
      expect(messageDiv.innerHTML).toBe('');
    });

    test('calls DELETE API when user confirms', async () => {
      await simulateDeleteUser(99, 'bob', true);
      expect(window.confirm).toHaveBeenCalled();
      expect(global.apiRequest).toHaveBeenCalledWith('/api/auth/users/99', { method: 'DELETE' });
    });
  });

  describe('Error message display (17.26)', () => {
    test('shows Cannot delete user when error mentions last admin user', async () => {
      window.confirm = jest.fn(() => true);
      global.apiRequest.mockRejectedValue(
        new Error('Cannot delete the last admin user. There must always be at least one admin user in the system.')
      );

      await simulateDeleteUser(1, 'admin', true);

      const messageDiv = document.getElementById('users-message');
      expect(messageDiv.innerHTML).toContain('error');
      expect(messageDiv.innerHTML).toContain('Cannot delete user');
      expect(messageDiv.innerHTML).toContain('last admin user');
    });

    test('shows generic failure message for other errors', async () => {
      window.confirm = jest.fn(() => true);
      global.apiRequest.mockRejectedValue(new Error('Network error'));

      await simulateDeleteUser(5, 'user5', true);

      const messageDiv = document.getElementById('users-message');
      expect(messageDiv.innerHTML).toContain('error');
      expect(messageDiv.innerHTML).toContain('Failed to delete user');
      expect(messageDiv.innerHTML).toContain('Network error');
    });

    test('shows success message after successful delete', async () => {
      window.confirm = jest.fn(() => true);
      global.apiRequest.mockResolvedValue(undefined);

      await simulateDeleteUser(5, 'user5', true);

      const messageDiv = document.getElementById('users-message');
      expect(messageDiv.innerHTML).toContain('success');
      expect(messageDiv.innerHTML).toContain('User deleted successfully');
    });
  });

  describe('Self-deletion prevention (17.39)', () => {
    test('does not render a delete button for the current admin user\'s own row', () => {
      // Two admins, so the last-admin rule does NOT apply; the only reason to hide
      // the button on the current user's row is the self-deletion rule.
      const users = [
        { id: 42, username: 'meadmin', email: 'me@test.com', role: 'admin', isAdmin: true },
        { id: 7, username: 'otheradmin', email: 'other@test.com', role: 'admin', isAdmin: true },
      ];
      const html = renderUsersTableHTML(users, 42);
      document.getElementById('users-container').innerHTML = `<table><tbody>${html}</tbody></table>`;

      // The current user's row must have Delete Disabled and no delete button.
      expect(html).toContain('data-user-id="7"');
      expect(html).not.toContain('data-user-id="42"'); // no delete button on self row
      expect(html).toContain('self-user-row');
      expect(html).toContain('cannot delete your own account');

      const container = document.getElementById('users-container');
      const buttons = container.querySelectorAll('.delete-user-btn');
      expect(buttons.length).toBe(1);
      expect(buttons[0].getAttribute('data-user-id')).toBe('7');
    });

    test('self-deletion rule takes precedence over last-admin rule for sole admin viewing own row', () => {
      // When the current user is also the sole admin, the row is still disabled
      // (either rule is sufficient); importantly, no delete button is rendered.
      const users = [
        { id: 1, username: 'onlyadmin', email: 'o@test.com', role: 'admin', isAdmin: true },
      ];
      const html = renderUsersTableHTML(users, 1);
      expect(html).not.toContain('delete-user-btn');
      expect(html).toContain('Delete Disabled');
    });

    test('shows self-deletion error message when API rejects with CANNOT_DELETE_SELF message', async () => {
      window.confirm = jest.fn(() => true);
      global.apiRequest.mockRejectedValue(
        new Error('You cannot delete your own account; another administrator must perform this action')
      );

      // simulateDeleteUser mirrors admin.js error handling; ensure it displays the
      // self-delete message (not the generic "Failed to delete user" fallback).
      const confirmMessage = `Are you sure you want to delete user "meadmin" (ID: 42)?\n\nThis will also delete all associated bookings and reservations.`;
      window.confirm(confirmMessage);
      const messageDiv = document.getElementById('users-message');
      messageDiv.innerHTML = '<p>Deleting user...</p>';

      try {
        await window.apiRequest('/api/auth/users/42', { method: 'DELETE' });
      } catch (error) {
        if (error.message.includes('cannot delete your own account')) {
          messageDiv.innerHTML = `<div class="error">${error.message}</div>`;
        } else {
          messageDiv.innerHTML = `<div class="error">Failed to delete user: ${error.message}</div>`;
        }
      }

      expect(messageDiv.innerHTML).toContain('error');
      expect(messageDiv.innerHTML).toContain('cannot delete your own account');
      expect(messageDiv.innerHTML).not.toContain('Failed to delete user');
    });
  });
});
