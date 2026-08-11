import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PermissionHistoryTimeline } from './PermissionHistoryTimeline';
import type { PermissionHistoryEvent } from '@/lib/api/adminPermissions';

const EVENTS: PermissionHistoryEvent[] = [
  {
    id: 'log-2',
    action: 'PERMISSION_APPROVED',
    adminId: 'admin-1',
    entityType: 'permission',
    entityId: 'job_listing:view',
    metadata: { permissionId: 'p-1', toStatus: 'approved' },
    ipAddress: '203.0.113.9',
    occurredAt: '2026-08-02T00:00:00.000Z',
  },
  {
    id: 'log-1',
    action: 'PERMISSION_ASSIGNED',
    adminId: 'admin-2',
    entityType: 'permission',
    entityId: 'job_listing:view',
    metadata: { principalId: 'u1' },
    ipAddress: '203.0.113.9',
    occurredAt: '2026-08-01T00:00:00.000Z',
  },
];

describe('PermissionHistoryTimeline', () => {
  it('renders one row per event, unified across Assignment and Governance actions', () => {
    render(<PermissionHistoryTimeline events={EVENTS} />);
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText('Assigned')).toBeInTheDocument();
    expect(screen.getByText('admin-1')).toBeInTheDocument();
    expect(screen.getByText('admin-2')).toBeInTheDocument();
  });

  it('renders each event\'s metadata as key: value pairs', () => {
    render(<PermissionHistoryTimeline events={EVENTS} />);
    expect(screen.getByText(/principalId: u1/)).toBeInTheDocument();
    expect(screen.getByText(/permissionId: p-1/)).toBeInTheDocument();
  });

  it('shows the custom empty state when there are no events', () => {
    render(<PermissionHistoryTimeline events={[]} emptyState={<p>No history yet</p>} />);
    expect(screen.getByText('No history yet')).toBeInTheDocument();
  });

  it('omits the pagination footer entirely when no pagination prop is given', () => {
    render(<PermissionHistoryTimeline events={EVENTS} />);
    expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument();
  });

  it('renders pagination and calls onOffsetChange on Next', async () => {
    const user = userEvent.setup();
    const onOffsetChange = vi.fn();
    render(
      <PermissionHistoryTimeline
        events={EVENTS}
        pagination={{ offset: 0, limit: 2, total: 5, onOffsetChange }}
      />,
    );

    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(onOffsetChange).toHaveBeenCalledWith(2);
  });
});
