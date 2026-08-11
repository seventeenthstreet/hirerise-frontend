import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PermissionHistoryActionBadge } from './PermissionHistoryActionBadge';

describe('PermissionHistoryActionBadge', () => {
  it('renders a friendly label for each known Permission audit action', () => {
    const cases: Array<[string, string]> = [
      ['PERMISSION_ASSIGNED', 'Assigned'],
      ['PERMISSION_REVOKED', 'Revoked'],
      ['PERMISSION_APPROVED', 'Approved'],
      ['PERMISSION_PUBLISHED', 'Published'],
      ['PERMISSION_ADOPTED', 'Adopted'],
      ['PERMISSION_DEPRECATED', 'Deprecated'],
      ['PERMISSION_RETIRED', 'Retired'],
    ];

    for (const [action, label] of cases) {
      const { unmount } = render(<PermissionHistoryActionBadge action={action} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });

  it('falls back to rendering the raw value for an unrecognized action', () => {
    render(<PermissionHistoryActionBadge action="SOME_FUTURE_ACTION" />);
    expect(screen.getByText('SOME_FUTURE_ACTION')).toBeInTheDocument();
  });
});
