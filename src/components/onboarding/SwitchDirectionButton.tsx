'use client';

/**
 * components/onboarding/SwitchDirectionButton.tsx
 *
 * PHASE B.5 — Onboarding Direction Recovery
 *
 * A subtle secondary action that lets a user switch their onboarding path
 * before completing it.
 *
 * DESIGN INTENT:
 *   - Not visually dominant. Renders as a muted text-button link,
 *     clearly secondary to the main "Continue" CTA.
 *   - Compatible with both the Tailwind-based /onboarding layout and
 *     the inline-styled career/onboarding dark-theme layout.
 *   - Two variants: 'light' (Tailwind defaults) and 'dark' (career page).
 *
 * PLACEMENT:
 *   - /onboarding/page.tsx: below the header, before QuotaBanner
 *   - career/onboarding/page.tsx: below the progress fraction in the left rail
 *
 * PROPS:
 *   - onSwitch: () => void — caller provides the action (from useOnboardingDirectionSwitch)
 *   - isSwitching: boolean — disables and shows inline loading state
 *   - variant: 'light' | 'dark' — styling context
 *   - label: optional override (default: "Choose a different path")
 */

interface SwitchDirectionButtonProps {
  onSwitch: () => void;
  isSwitching: boolean;
  variant?: 'light' | 'dark';
  label?: string;
}

export function SwitchDirectionButton({
  onSwitch,
  isSwitching,
  variant = 'light',
  label = 'Choose a different path',
}: SwitchDirectionButtonProps) {
  if (variant === 'dark') {
    // Career onboarding dark theme — matches the inline-style aesthetic
    return (
      <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)' }}>
        <button
          type="button"
          onClick={onSwitch}
          disabled={isSwitching}
          style={{
            background:  'none',
            border:      'none',
            padding:     0,
            cursor:      isSwitching ? 'not-allowed' : 'pointer',
            fontSize:    '0.75rem',
            color:       isSwitching ? 'var(--text-dim)' : 'var(--text-muted)',
            fontFamily:  'inherit',
            display:     'flex',
            alignItems:  'center',
            gap:         '0.4rem',
            transition:  'color 0.15s',
            lineHeight:  1,
          }}
          onMouseEnter={(e) => {
            if (!isSwitching) (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = isSwitching ? 'var(--text-dim)' : 'var(--text-muted)';
          }}
          aria-label={isSwitching ? 'Switching direction…' : label}
        >
          {isSwitching ? (
            <>
              <span
                style={{
                  display:       'inline-block',
                  width:         '0.625rem',
                  height:        '0.625rem',
                  border:        '1.25px solid rgba(240,237,230,0.15)',
                  borderTopColor:'rgba(240,237,230,0.4)',
                  borderRadius:  '50%',
                  animation:     'spin 0.7s linear infinite',
                  flexShrink:    0,
                }}
                role="status"
                aria-hidden="true"
              />
              Switching…
            </>
          ) : (
            <>
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                aria-hidden="true"
                style={{ flexShrink: 0 }}
              >
                <path
                  d="M1 5h8M5 1l-4 4 4 4"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {label}
            </>
          )}
        </button>
      </div>
    );
  }

  // Light variant — Tailwind-based layout (/onboarding)
  return (
    <div className="mb-6 flex justify-center">
      <button
        type="button"
        onClick={onSwitch}
        disabled={isSwitching}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label={isSwitching ? 'Switching direction…' : label}
      >
        {isSwitching ? (
          <>
            <span
              className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-muted-foreground/30 border-t-muted-foreground"
              role="status"
              aria-hidden="true"
            />
            Switching…
          </>
        ) : (
          <>
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              aria-hidden="true"
              className="shrink-0"
            >
              <path
                d="M1 5h8M5 1l-4 4 4 4"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {label}
          </>
        )}
      </button>
    </div>
  );
}