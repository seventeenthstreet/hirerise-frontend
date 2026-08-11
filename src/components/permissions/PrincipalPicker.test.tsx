import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/renderWithProviders';
import { PrincipalPicker } from './PrincipalPicker';
import { ADMIN_USER_FIXTURES } from '@/test/msw/fixtures';

describe('PrincipalPicker', () => {
  it('shows a search input with no selection by default', () => {
    renderWithProviders(<PrincipalPicker value={null} onChange={vi.fn()} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('lists matching users and calls onChange when one is selected', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<PrincipalPicker value={null} onChange={onChange} />);

    await user.click(screen.getByRole('combobox'));
    await user.type(screen.getByRole('combobox'), 'Ada');

    const option = await screen.findByText(ADMIN_USER_FIXTURES[0].displayName as string);
    await user.click(option);

    expect(onChange).toHaveBeenCalledWith(ADMIN_USER_FIXTURES[0].id, ADMIN_USER_FIXTURES[0]);
  });

  it('renders a read-only chip with a Change action once a value is set', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <PrincipalPicker value={ADMIN_USER_FIXTURES[0].id} onChange={vi.fn()} />,
    );

    // No matching user record was passed in via selection this render, so
    // it falls back to showing the raw id — still renders the chip, not
    // the search input.
    expect(screen.getByRole('button', { name: 'Change' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Change' }));
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument());
  });

  it('hides the Change action when disabled', () => {
    renderWithProviders(<PrincipalPicker value={ADMIN_USER_FIXTURES[0].id} onChange={vi.fn()} disabled />);
    expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument();
  });
});
