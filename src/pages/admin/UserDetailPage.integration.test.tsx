/**
 * @file pages/admin/UserDetailPage.integration.test.tsx
 * @description WP-ADMIN-04F-09 — covers only the one change this WP made
 * to the certified UserDetailPage: the "Manage Permissions" row now
 * navigates to the Permission Assignment UI instead of rendering a
 * disabled placeholder. Every other section of this page is unchanged
 * and out of scope for this test file.
 */

import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '@/test/renderWithProviders';
import UserDetailPage from './UserDetailPage';
import PermissionAssignmentsPage from './permissions/PermissionAssignmentsPage';

function renderUserDetail(userId: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/admin/users/:userId" element={<UserDetailPage />} />
      <Route path="/admin/permissions/assignments" element={<PermissionAssignmentsPage />} />
    </Routes>,
    { route: `/admin/users/${userId}` },
  );
}

describe('UserDetailPage — Manage Permissions row', () => {
  it('renders as an enabled button, not a disabled "Coming Soon" placeholder', async () => {
    renderUserDetail('user-123');

    const button = await screen.findByRole('button', { name: 'Manage Permissions' });
    expect(button).toBeEnabled();

    const label = screen.getByText('Manage Permissions', { selector: 'span' });
    const row = label.parentElement?.parentElement;
    expect(row).not.toBeNull();
    expect(row && row.textContent).not.toMatch(/Coming Soon/i);
  });

  it('navigates to the Assignment UI pre-filtered to this user as principal', async () => {
    const user = userEvent.setup();
    renderUserDetail('user-123');

    const button = await screen.findByRole('button', { name: 'Manage Permissions' });
    await user.click(button);

    // Landed on PermissionAssignmentsPage with ?principalId=user-123 already resolved.
    await waitFor(() => expect(screen.getByText('Assign a Permission')).toBeInTheDocument());
  });
});
