import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RevokeConfirmDialog } from './RevokeConfirmDialog';

describe('RevokeConfirmDialog', () => {
  it('renders nothing when closed', () => {
    render(
      <RevokeConfirmDialog
        isOpen={false}
        permissionLabel="user:view"
        principalLabel="Ada Lovelace"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('shows the principal and permission labels when open', () => {
    render(
      <RevokeConfirmDialog
        isOpen
        permissionLabel="user:view"
        principalLabel="Ada Lovelace"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('user:view')).toBeInTheDocument();
  });

  it('calls onConfirm when the Revoke button is clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <RevokeConfirmDialog
        isOpen
        permissionLabel="user:view"
        principalLabel="Ada Lovelace"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Revoke' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <RevokeConfirmDialog
        isOpen
        permissionLabel="user:view"
        principalLabel="Ada Lovelace"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('does not call onCancel on Escape while submitting', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <RevokeConfirmDialog
        isOpen
        isSubmitting
        permissionLabel="user:view"
        principalLabel="Ada Lovelace"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    await user.keyboard('{Escape}');
    expect(onCancel).not.toHaveBeenCalled();
  });
});
