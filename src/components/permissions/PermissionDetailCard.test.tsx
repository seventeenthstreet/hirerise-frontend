import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PermissionDetailCard } from './PermissionDetailCard';
import { PERMISSION_FIXTURES } from '@/test/msw/fixtures';

describe('PermissionDetailCard', () => {
  it('renders every metadata field from the fixture verbatim', () => {
    render(<PermissionDetailCard permission={PERMISSION_FIXTURES[0]} />);

    expect(screen.getByText('user:view')).toBeInTheDocument();
    expect(screen.getByText('user')).toBeInTheDocument();
    expect(screen.getByText('view')).toBeInTheDocument();
    expect(screen.getByText('administration')).toBeInTheDocument();
    expect(screen.getByText('View enterprise user records.')).toBeInTheDocument();
    expect(screen.getAllByText('Published').length).toBe(2); // status badge + lifecycle stage label
  });

  it('renders "Unavailable" for null fields instead of blank or the word null', () => {
    render(<PermissionDetailCard permission={PERMISSION_FIXTURES[2]} />); // description: null
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0);
    expect(screen.queryByText('null')).not.toBeInTheDocument();
  });
});