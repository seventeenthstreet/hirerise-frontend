/**
 * components/master-data/MasterDataErrorState.tsx
 *
 * Differentiates error conditions per WP-ADMIN-02A §20: validation,
 * unauthorized, forbidden, network failure, backend unavailable, and
 * not-found each get distinct copy. Branches only on `err.category`
 * (and status for the auth split) — never on `err.code`, and never
 * renders a stack trace.
 */

import { Button } from '@/components/ui';
import { isApiClientError, type ApiClientError } from '@/lib/api/core';

interface MasterDataErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  entityLabelPlural: string;
}

function describeError(error: unknown, entityLabelPlural: string): { title: string; detail: string } {
  if (!isApiClientError(error)) {
    return {
      title: 'Something went wrong',
      detail: `We couldn't load ${entityLabelPlural}. Please try again.`,
    };
  }

  const err = error as ApiClientError;

  switch (err.category) {
    case 'auth':
      return err.status === 403
        ? {
            title: 'Access denied',
            detail: `You don't have permission to manage ${entityLabelPlural}.`,
          }
        : {
            title: 'Session expired',
            detail: 'Please sign in again to continue.',
          };
    case 'not_found':
      return { title: 'Not found', detail: 'That record no longer exists — it may have been archived.' };
    case 'validation':
      return { title: 'Invalid request', detail: err.message || 'Please check the submitted values and try again.' };
    case 'network':
      return { title: 'Connection problem', detail: 'Check your internet connection and try again.' };
    case 'server':
    case 'system':
      return { title: 'Service unavailable', detail: 'Our servers are having trouble right now. Please try again shortly.' };
    case 'rate_limit':
      return { title: 'Too many requests', detail: 'Please wait a moment before trying again.' };
    case 'conflict':
      return { title: 'Already exists', detail: err.message || 'A record with these values already exists.' };
    default:
      return {
        title: 'Something went wrong',
        detail: `We couldn't load ${entityLabelPlural}. Please try again.`,
      };
  }
}

export function MasterDataErrorState({ error, onRetry, entityLabelPlural }: MasterDataErrorStateProps) {
  const { title, detail } = describeError(error, entityLabelPlural);

  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-4 py-12 text-center">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground">{detail}</p>
      {onRetry && (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
