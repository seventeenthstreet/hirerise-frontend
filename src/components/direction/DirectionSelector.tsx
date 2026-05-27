'use client';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type Direction = 'education' | 'career' | 'market'; // 'market' retained internally; hidden from MVP UI

interface DirectionOption {
  value: Direction;
  title: string;
  description: string;
  icon: React.ReactNode;
}

interface DirectionSelectorProps {
  onSelect: (direction: Direction) => Promise<void>;
  isSubmitting: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// OPTIONS CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const DIRECTION_OPTIONS: DirectionOption[] = [
  {
    value: 'education',
    title: 'I\'m a student',
    description:
      'Discover the best study and career path for your interests, and understand the ROI of each option.',
    icon: (
      <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 14l9-5-9-5-9 5 9 5zm0 7v-6m-6.364-3.636A9 9 0 1112 21a9 9 0 01-6.364-2.636z"
        />
      </svg>
    ),
  },
  {
    value: 'career',
    title: 'I\'m a professional',
    description:
      'Get your Career Health Index, identify skill gaps, and find opportunities that match your experience.',
    icon: (
      <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>
    ),
  },
  // MVP SCOPE: 'market' direction intentionally removed from UI.
  // Backend type and enum retained. Re-add this option post-MVP.
];

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DirectionSelector — pure display component.
 *
 * Renders the three direction options and calls `onSelect` when the user picks
 * one. All routing, API calls, and quota handling live in the page orchestrator.
 */
export function DirectionSelector({ onSelect, isSubmitting }: DirectionSelectorProps) {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      role="list"
      aria-label="Choose your direction"
    >
      {DIRECTION_OPTIONS.map((option) => (
        <button
          key={option.value}
          role="listitem"
          onClick={() => onSelect(option.value)}
          disabled={isSubmitting}
          aria-label={`Select direction: ${option.title}`}
          className={[
            'group relative flex flex-col items-start gap-4 rounded-2xl border p-6 text-left',
            'transition-all duration-150 outline-none',
            'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
            'hover:border-primary/50 hover:bg-primary/5 hover:shadow-md',
            'active:scale-[0.98]',
            isSubmitting
              ? 'cursor-not-allowed opacity-50'
              : 'cursor-pointer border-border bg-card',
          ].join(' ')}
        >
          {/* Icon container */}
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
            {option.icon}
          </div>

          {/* Text */}
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {option.title}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {option.description}
            </p>
          </div>

          {/* Loading spinner shown on the selected card while submitting */}
          {isSubmitting && (
            <span
              className="absolute right-4 top-4 h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground"
              aria-hidden="true"
            />
          )}
        </button>
      ))}
    </div>
  );
}