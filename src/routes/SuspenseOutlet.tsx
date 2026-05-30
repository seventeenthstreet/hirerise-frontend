/**
 * src/routes/SuspenseOutlet.tsx
 *
 * Suspense boundary wrapping React Router's <Outlet />.
 * Applied at each layout boundary so partial hydration doesn't block the shell.
 * Extracted from routes/index.tsx for Vite Fast Refresh compatibility.
 */

import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';

export function SuspenseOutlet(): React.JSX.Element {
  // PageLoader component handles branded loading state.
  // Replace fallback with your actual loading component when ready.
  return (
    <Suspense fallback={<div aria-busy="true" />}>
      <Outlet />
    </Suspense>
  );
}