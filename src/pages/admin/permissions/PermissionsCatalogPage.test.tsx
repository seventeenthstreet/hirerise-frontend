import { describe, it, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/renderWithProviders';
import PermissionsCatalogPage from './PermissionsCatalogPage';
import { PERMISSION_FIXTURES } from '@/test/msw/fixtures';

describe('PermissionsCatalogPage', () => {
  it('renders the unfiltered catalog', async () => {
    renderWithProviders(<PermissionsCatalogPage />);

    await waitFor(() => expect(screen.getByText('user:view')).toBeInTheDocument());
    for (const permission of PERMISSION_FIXTURES) {
      expect(screen.getByText(permission.identity)).toBeInTheDocument();
    }
  });

  it('narrows results via the Resource filter dropdown (no free-text search box)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PermissionsCatalogPage />);
    await waitFor(() => expect(screen.getByText('user:view')).toBeInTheDocument());

    expect(screen.queryByPlaceholderText(/search/i)).not.toBeInTheDocument();

    await waitFor(() => expect(within(screen.getByLabelText('Resource')).getByRole('option', { name: 'cms_entry' })).toBeInTheDocument());
    await user.selectOptions(screen.getByLabelText('Resource'), 'cms_entry');

    await waitFor(() => expect(screen.getByText('cms_entry:publish')).toBeInTheDocument());
    expect(screen.queryByText('user:view')).not.toBeInTheDocument();
  });

  it('has a row action to view each permission', async () => {
    renderWithProviders(<PermissionsCatalogPage />);
    await waitFor(() => expect(screen.getByText('user:view')).toBeInTheDocument());

    const row = screen.getByText('user:view').closest('tr');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByRole('button', { name: /view/i })).toBeInTheDocument();
  });

  // WP-ADMIN-04F-13B — filter dropdowns are Registry-driven, not a
  // hardcoded PERMISSION_RESOURCES/PERMISSION_ACTIONS/PERMISSION_CATEGORIES list.
  it('populates all three filter dropdowns from the Registry, including non-assignable Permissions', async () => {
    renderWithProviders(<PermissionsCatalogPage />);
    await waitFor(() => expect(screen.getByText('user:view')).toBeInTheDocument());

    await waitFor(() => {
      const resourceOptions = Array.from((screen.getByLabelText('Resource') as HTMLSelectElement).options).map((o) => o.value);
      // 'skill' only has a deprecated entry in the fixtures — the Catalog
      // is a full Registry view, so it must still show up here (unlike
      // the Assignment page's assignable-only vocabulary).
      expect(resourceOptions).toEqual(expect.arrayContaining(['user', 'cms_entry', 'skill']));
    });

    const actionOptions = Array.from((screen.getByLabelText('Action') as HTMLSelectElement).options).map((o) => o.value);
    expect(actionOptions).toEqual(expect.arrayContaining(['view', 'create', 'delete', 'publish']));

    const categoryOptions = Array.from((screen.getByLabelText('Category') as HTMLSelectElement).options).map((o) => o.value);
    expect(categoryOptions).toEqual(expect.arrayContaining(['administration', 'cms', 'skills']));
  });
});
