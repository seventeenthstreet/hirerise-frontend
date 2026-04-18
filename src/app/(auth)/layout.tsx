// app/(auth)/layout.tsx
// Route group layout for unauthenticated pages (login, etc.)
// No guards here — login page handles its own redirect if already authed.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
