import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EvaluationResultCard } from './EvaluationResultCard';
import { EVALUATION_ALLOW_RESULT } from '@/test/msw/fixtures';
import type { EvaluationResult } from '@/lib/api/adminPermissions';

describe('EvaluationResultCard', () => {
  it('renders an Allow decision with its reason and metadata verbatim', () => {
    render(<EvaluationResultCard result={EVALUATION_ALLOW_RESULT as EvaluationResult} />);

    expect(screen.getByText('Allow')).toBeInTheDocument();
    expect(screen.getByText('user:view')).toBeInTheDocument();
    expect(screen.getByText('Principal holds an active assignment for this Permission.')).toBeInTheDocument();
    expect(screen.getAllByText('Published').length).toBe(2); // status badge + lifecycle stage label
    expect(screen.getByText('No')).toBeInTheDocument(); // deprecated: false
  });

  it('renders a Deny decision distinctly from Allow', () => {
    const denyResult: EvaluationResult = {
      decision: {
        outcome: 'deny',
        context: { userId: 'user-456', resource: 'skill', action: 'delete', resourceId: null, metadata: {} },
        reason: 'No matching Assignment exists.',
        decidedAt: '2026-01-10T00:00:00.000Z',
      },
      explanation: {
        permission: 'skill:delete',
        resource: 'skill',
        action: 'delete',
        decision: 'deny',
        reason: 'No matching Assignment exists.',
        metadata: {
          permissionStatus: 'deprecated',
          lifecycleStage: { status: 'deprecated', label: 'Deprecated', stageIndex: 4, isTerminal: false },
          category: 'skills',
          deprecated: true,
        },
      },
    };

    render(<EvaluationResultCard result={denyResult} />);

    expect(screen.getByText('Deny')).toBeInTheDocument();
    expect(screen.queryByText('Allow')).not.toBeInTheDocument();
    expect(screen.getByText('No matching Assignment exists.')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument(); // deprecated: true
  });

  it('renders "—" for a null decision reason instead of the literal word null', () => {
    const result: EvaluationResult = {
      ...(EVALUATION_ALLOW_RESULT as EvaluationResult),
      decision: { ...(EVALUATION_ALLOW_RESULT as EvaluationResult).decision, reason: null },
    };
    render(<EvaluationResultCard result={result} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});