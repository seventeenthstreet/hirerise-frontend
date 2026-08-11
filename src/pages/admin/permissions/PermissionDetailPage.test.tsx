import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '@/test/renderWithProviders';
import PermissionDetailPage from './PermissionDetailPage';

function renderAtIdentity(identity: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/admin/permissions/registry/:identity" element={<PermissionDetailPage />} />
    </Routes>,
    { route: `/admin/permissions/registry/${encodeURIComponent(identity)}` },
  );
}

describe('PermissionDetailPage', () => {
  it('shows the permission detail once loaded', async () => {
    renderAtIdentity('user:view');
    await waitFor(() => expect(screen.getByText('View enterprise user records.')).toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'user:view' })).toBeInTheDocument();
  });

  it('shows a not-found error state for an unknown identity', async () => {
    renderAtIdentity('does:not-exist');
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText('Not found')).toBeInTheDocument();
  });

  it('links to the Assignments view', async () => {
    renderAtIdentity('user:view');
    await waitFor(() => expect(screen.getByText('View enterprise user records.')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Assignments' })).toBeInTheDocument();
  });

  // WP-ADMIN-05D — Enterprise Permission Audit & Governance History.
  it('shows the unified Assignment + Governance History timeline once the permission has loaded', async () => {
    renderAtIdentity('user:view');
    await waitFor(() => expect(screen.getByText('View enterprise user records.')).toBeInTheDocument());

    await waitFor(() => expect(screen.getByText('Approved')).toBeInTheDocument());
    expect(screen.getByText('Assigned')).toBeInTheDocument();
    expect(screen.getByText('admin-1')).toBeInTheDocument();
    expect(screen.getByText('admin-2')).toBeInTheDocument();
  });
});
