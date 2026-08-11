import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssignmentTable } from './AssignmentTable';
import { ASSIGNMENT_FIXTURES } from '@/test/msw/fixtures';

describe('AssignmentTable', () => {
  it('renders one row per assignment', () => {
    render(<AssignmentTable assignments={ASSIGNMENT_FIXTURES} />);
    expect(screen.getByText('user:view')).toBeInTheDocument();
    expect(screen.getByText('user')).toBeInTheDocument();
    expect(screen.getByText('view')).toBeInTheDocument();
  });

  it('shows the custom empty state when there are no assignments', () => {
    render(<AssignmentTable assignments={[]} emptyState={<p>No assignments yet</p>} />);
    expect(screen.getByText('No assignments yet')).toBeInTheDocument();
  });

  it('omits the Revoke action entirely when onRevoke is not provided', () => {
    render(<AssignmentTable assignments={ASSIGNMENT_FIXTURES} />);
    expect(screen.queryByRole('button', { name: /revoke/i })).not.toBeInTheDocument();
  });

  it('calls onRevoke with the clicked assignment', async () => {
    const user = userEvent.setup();
    const onRevoke = vi.fn();
    render(<AssignmentTable assignments={ASSIGNMENT_FIXTURES} onRevoke={onRevoke} />);

    await user.click(screen.getByRole('button', { name: /revoke/i }));
    expect(onRevoke).toHaveBeenCalledWith(expect.objectContaining(ASSIGNMENT_FIXTURES[0]));
  });
});
