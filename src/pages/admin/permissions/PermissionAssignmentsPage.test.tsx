import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/renderWithProviders';
import { server } from '@/test/msw/server';
import PermissionAssignmentsPage from './PermissionAssignmentsPage';
import { ADMIN_USER_FIXTURES } from '@/test/msw/fixtures';

describe('PermissionAssignmentsPage', () => {
  it('hides the assign form and assignment list until a principal is chosen', () => {
    renderWithProviders(<PermissionAssignmentsPage />);
    expect(screen.queryByText('Assign a Permission')).not.toBeInTheDocument();
    expect(screen.queryByText('Current Assignments')).not.toBeInTheDocument();
  });

  it('shows the assign form and that principal\'s assignments once one is picked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PermissionAssignmentsPage />);

    await user.click(screen.getByRole('combobox', { name: 'Principal' }));
    await user.type(screen.getByRole('combobox', { name: 'Principal' }), 'Ada');
    await user.click(await screen.findByText(ADMIN_USER_FIXTURES[0].displayName as string));

    expect(screen.getByText('Assign a Permission')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('user:view')).toBeInTheDocument()); // from ASSIGNMENT_FIXTURES
  });

  it('pre-selects the principal from ?principalId= and resolves their display name', async () => {
    renderWithProviders(<PermissionAssignmentsPage />, { route: '/admin/permissions/assignments?principalId=user-123' });

    await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeInTheDocument());
    expect(screen.getByText('Assign a Permission')).toBeInTheDocument();
  });

  it('assigns a permission and shows a success banner', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PermissionAssignmentsPage />, { route: '/admin/permissions/assignments?principalId=user-123' });
    await waitFor(() => expect(screen.getByText('Assign a Permission')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByLabelText('Resource')).not.toBeDisabled());

    await user.selectOptions(screen.getByLabelText('Resource'), 'cms_entry');
    await user.selectOptions(screen.getByLabelText('Action'), 'publish');
    await user.click(screen.getByRole('button', { name: 'Assign' }));

    await waitFor(() => expect(screen.getByText('Assigned cms_entry:publish.')).toBeInTheDocument());
  });

  it('revokes an assignment after confirmation', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PermissionAssignmentsPage />, { route: '/admin/permissions/assignments?principalId=user-123' });
    await waitFor(() => expect(screen.getByText('user:view')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /revoke/i }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Revoke' })); // the dialog's confirm button
    await waitFor(() => expect(screen.getByText('Revoked user:view.')).toBeInTheDocument());
  });

  // WP-ADMIN-04F-13B — Registry-driven, assignable-only Resource/Action vocabulary.
  describe('Registry-driven vocabulary', () => {
    it('populates the Resource dropdown from the Registry, not a hardcoded list', async () => {
      const user = userEvent.setup();
      renderWithProviders(<PermissionAssignmentsPage />, { route: '/admin/permissions/assignments?principalId=user-123' });
      await waitFor(() => expect(screen.getByLabelText('Resource')).not.toBeDisabled());

      // 'user' and 'cms_entry' both have an assignable (published/adopted)
      // entry in PERMISSION_FIXTURES; 'skill' only has a deprecated one
      // and must not appear as a selectable Resource here.
      const resourceSelect = screen.getByLabelText('Resource') as HTMLSelectElement;
      const optionValues = Array.from(resourceSelect.options).map((o) => o.value);
      expect(optionValues).toEqual(expect.arrayContaining(['user', 'cms_entry']));
      expect(optionValues).not.toContain('skill');

      await user.selectOptions(resourceSelect, 'user');
    });

    it('filters the Action dropdown to only the selected Resource\'s assignable Actions', async () => {
      const user = userEvent.setup();
      renderWithProviders(<PermissionAssignmentsPage />, { route: '/admin/permissions/assignments?principalId=user-123' });
      await waitFor(() => expect(screen.getByLabelText('Resource')).not.toBeDisabled());

      // Before a Resource is chosen, Action has no options to select from.
      expect(screen.getByLabelText('Action')).toBeDisabled();

      await user.selectOptions(screen.getByLabelText('Resource'), 'user');

      // 'user' has view (published) and create (adopted) as assignable —
      // but NOT delete, which is only 'proposed' in the fixtures.
      const actionSelect = screen.getByLabelText('Action') as HTMLSelectElement;
      const actionValues = Array.from(actionSelect.options).map((o) => o.value);
      expect(actionValues).toEqual(expect.arrayContaining(['view', 'create']));
      expect(actionValues).not.toContain('delete');
    });

    it('clears the selected Action when the Resource changes, so an invalid combination can never be submitted', async () => {
      const user = userEvent.setup();
      renderWithProviders(<PermissionAssignmentsPage />, { route: '/admin/permissions/assignments?principalId=user-123' });
      await waitFor(() => expect(screen.getByLabelText('Resource')).not.toBeDisabled());

      await user.selectOptions(screen.getByLabelText('Resource'), 'user');
      await user.selectOptions(screen.getByLabelText('Action'), 'create');
      expect((screen.getByLabelText('Action') as HTMLSelectElement).value).toBe('create');

      await user.selectOptions(screen.getByLabelText('Resource'), 'cms_entry');
      expect((screen.getByLabelText('Action') as HTMLSelectElement).value).toBe('');
    });

    it('shows a loading state for the Resource dropdown while the Registry is fetching', async () => {
      renderWithProviders(<PermissionAssignmentsPage />, { route: '/admin/permissions/assignments?principalId=user-123' });
      await waitFor(() => expect(screen.getByText('Assign a Permission')).toBeInTheDocument());

      expect(screen.getByText('Loading resources…')).toBeInTheDocument();
      await waitFor(() => expect(screen.getByLabelText('Resource')).not.toBeDisabled());
    });

    it('shows an error state with retry when the Registry fetch fails', async () => {
      server.use(
        http.get('/api/v1/admin/permissions/registry', () =>
          HttpResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'boom' }, meta: { requestId: null, timestamp: new Date().toISOString() } },
            { status: 500 },
          ),
        ),
      );

      renderWithProviders(<PermissionAssignmentsPage />, { route: '/admin/permissions/assignments?principalId=user-123' });
      await waitFor(() => expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument(), { timeout: 8000 });
      expect(screen.queryByLabelText('Resource')).not.toBeInTheDocument();
    }, 10000);

    it('shows an empty state when the Registry has no assignable Permissions', async () => {
      server.use(
        http.get('/api/v1/admin/permissions/registry', () =>
          HttpResponse.json({ success: true, data: { items: [], total: 0 } }),
        ),
      );

      renderWithProviders(<PermissionAssignmentsPage />, { route: '/admin/permissions/assignments?principalId=user-123' });
      await waitFor(() => expect(screen.getByText(/no assignable permissions/i)).toBeInTheDocument());
      expect(screen.queryByLabelText('Resource')).not.toBeInTheDocument();
    });
  });
});
