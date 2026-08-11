import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PermissionStatusBadge } from './PermissionStatusBadge';

describe('PermissionStatusBadge', () => {
  it.each([
    ['proposed', 'Proposed'],
    ['approved', 'Approved'],
    ['published', 'Published'],
    ['adopted', 'Adopted'],
    ['deprecated', 'Deprecated'],
    ['retired', 'Retired'],
  ])('renders the "%s" label for status "%s"', (status, label) => {
    render(<PermissionStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('falls back to the raw status string for an unrecognized value instead of throwing', () => {
    render(<PermissionStatusBadge status="some-future-status" />);
    expect(screen.getByText('some-future-status')).toBeInTheDocument();
  });
});
