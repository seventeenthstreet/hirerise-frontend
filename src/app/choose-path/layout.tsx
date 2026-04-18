// app/choose-path/layout.tsx
//
// Minimal layout for the deprecated /choose-path stub.
//
// IMPORTANT: No AuthGuard here. This page is a plain redirect to /onboarding.
// Wrapping it in AuthGuard while also listing it in ONBOARDING_PATHS created
// a redirect loop. Since this page unconditionally redirects, no guard is needed.

export default function ChoosePathLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}