/**
 * app/intent-gateway/layout.tsx
 *
 * Server component — exports page metadata for the Intent Gateway route.
 * The page itself is a client component ('use client') so metadata must
 * live here in the server layout instead.
 */

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title:  'What would you like help with? — HireRise',
  robots: { index: false, follow: false },
};

export default function IntentGatewayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}