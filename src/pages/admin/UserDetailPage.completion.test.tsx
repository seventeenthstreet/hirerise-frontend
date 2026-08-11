/**
 * @file pages/admin/UserDetailPage.completion.test.tsx
 * @description WP-ADMIN-COMP-04 — covers the three newly-functional
 * Administration entries this WP adds to the certified UserDetailPage:
 * Edit Profile, Enable/Disable Account (with its confirmation dialog), and
 * View Audit History. WP-ADMIN-04F-09's Manage Permissions coverage stays
 * in its own file (UserDetailPage.integration.test.tsx) and is not
 * duplicated here.
 */

import { describe, it, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '@/test/renderWithProviders';
import UserDetailPage from './UserDetailPage';

function renderUserDetail(userId: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/admin/users/:userId" element={<UserDetailPage />} />
    </Routes>,
    { route: `/admin/users/${userId}` },
  );
}

describe('UserDetailPage — Edit Profile (WP-ADMIN-COMP-04)', () => {
  it('renders the profile fields pre-filled and saves an edit', async () => {
    const user = userEvent.setup();
    renderUserDetail('user-123');

    const displayNameInput = await screen.findByLabelText('Display Name');
    expect(displayNameInput).toHaveValue('Ada Lovelace');

    const locationInput = screen.getByLabelText('Location');
    await user.clear(locationInput);
    await user.type(locationInput, 'London, UK');

    await user.click(screen.getByRole('button', { name: 'Save Profile' }));

    await waitFor(() => expect(screen.getByText('Profile updated.')).toBeInTheDocument());
  });

  it('shows a validation error for an out-of-range experience value without calling the API', async () => {
    const user = userEvent.setup();
    renderUserDetail('user-123');

    const experienceInput = await screen.findByLabelText('Experience (years)');
    await user.clear(experienceInput);
    await user.type(experienceInput, '999');

    await user.click(screen.getByRole('button', { name: 'Save Profile' }));

    await waitFor(() =>
      expect(screen.getByText('Experience must be a number of years between 0 and 80.')).toBeInTheDocument()
    );
  });
});

describe('UserDetailPage — Enable/Disable Account (WP-ADMIN-COMP-04)', () => {
  it('shows Disable Account for an active user and requires confirmation before mutating', async () => {
    const user = userEvent.setup();
    renderUserDetail('user-123');

    const disableButton = await screen.findByRole('button', { name: 'Disable Account' });
    await user.click(disableButton);

    // Confirmation dialog is now open; the mutation has not fired yet.
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Disable this account?')).toBeInTheDocument();
    expect(screen.getByText(/Status: Active/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Disable' }));

    await waitFor(() => expect(screen.getByText('Account disabled.')).toBeInTheDocument());
    expect(screen.getByText(/Status: Disabled/)).toBeInTheDocument();
    // The row's action button now offers the inverse action.
    expect(screen.getByRole('button', { name: 'Enable Account' })).toBeInTheDocument();
  });

  it('cancelling the confirmation dialog performs no mutation', async () => {
    const user = userEvent.setup();
    renderUserDetail('user-123');

    await user.click(await screen.findByRole('button', { name: 'Disable Account' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByText(/Status: Active/)).toBeInTheDocument();
  });
});

describe('UserDetailPage — View User Audit History (WP-ADMIN-COMP-04)', () => {
  it('renders existing audit_logs events for the user', async () => {
    renderUserDetail('user-123');

    await screen.findByText('User Audit History');
    await waitFor(() => expect(screen.getByText('USER_ROLE_UPDATED')).toBeInTheDocument());
  });

  it('shows an empty state for a user with no audit history', async () => {
    renderUserDetail('user-456');

    await screen.findByText('User Audit History');
    await waitFor(() => expect(screen.getByText('No audit history for this user yet.')).toBeInTheDocument());
  });
});
