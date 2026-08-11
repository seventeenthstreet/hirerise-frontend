import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/renderWithProviders';
import { server } from '@/test/msw/server';
import PermissionEvaluationPage from './PermissionEvaluationPage';
import { ADMIN_USER_FIXTURES } from '@/test/msw/fixtures';

async function selectPrincipal(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('combobox', { name: 'Principal' }));
  await user.type(screen.getByRole('combobox', { name: 'Principal' }), 'Ada');
  await user.click(await screen.findByText(ADMIN_USER_FIXTURES[0].displayName as string));
}

describe('PermissionEvaluationPage', () => {
  it('disables Evaluate until principal, resource, and action are all set', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PermissionEvaluationPage />);

    expect(screen.getByRole('button', { name: /evaluate/i })).toBeDisabled();

    await selectPrincipal(user);
    expect(screen.getByRole('button', { name: /evaluate/i })).toBeDisabled();

    await waitFor(() => expect(screen.getByLabelText('Resource')).not.toBeDisabled());
    await user.selectOptions(screen.getByLabelText('Resource'), 'user');
    expect(screen.getByRole('button', { name: /evaluate/i })).toBeDisabled();

    await user.selectOptions(screen.getByLabelText('Action'), 'view');
    expect(screen.getByRole('button', { name: /evaluate/i })).toBeEnabled();
  });

  it('renders the evaluation result verbatim from the API on success', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PermissionEvaluationPage />);

    await selectPrincipal(user);
    await waitFor(() => expect(screen.getByLabelText('Resource')).not.toBeDisabled());
    await user.selectOptions(screen.getByLabelText('Resource'), 'user');
    await user.selectOptions(screen.getByLabelText('Action'), 'view');
    await user.click(screen.getByRole('button', { name: /evaluate/i }));

    await waitFor(() => expect(screen.getByText('Allow')).toBeInTheDocument());
    expect(screen.getByText('Principal holds an active assignment for this Permission.')).toBeInTheDocument();
  });

  it('renders an error state when evaluation fails', async () => {
    server.use(
      http.post('/api/v1/admin/permissions/evaluate', () =>
        HttpResponse.json(
          { success: false, error: { code: 'EVALUATION_CONTEXT_ERROR', message: 'bad context' }, meta: { requestId: null, timestamp: new Date().toISOString() } },
          { status: 400 },
        ),
      ),
    );

    const user = userEvent.setup();
    renderWithProviders(<PermissionEvaluationPage />);

    await selectPrincipal(user);
    await waitFor(() => expect(screen.getByLabelText('Resource')).not.toBeDisabled());
    await user.selectOptions(screen.getByLabelText('Resource'), 'user');
    await user.selectOptions(screen.getByLabelText('Action'), 'view');
    await user.click(screen.getByRole('button', { name: /evaluate/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText('Invalid request')).toBeInTheDocument();
    expect(screen.queryByText('Allow')).not.toBeInTheDocument();
  });
});
