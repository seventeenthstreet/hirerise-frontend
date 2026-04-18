// app/career-onboarding/layout.tsx
//
// Minimal layout for the deprecated /career-onboarding stub.
// No AuthGuard — this page unconditionally redirects to /onboarding.
// AuthGuard is not needed here and would create redirect loops if
// this path were mistakenly added to ONBOARDING_PATHS.

export default function CareerOnboardingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}