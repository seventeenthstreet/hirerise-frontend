/**
 * src/App.tsx
 *
 * HireRise — Application Entry Shell
 *
 * This file has one job: mount AppProviders.
 * All routing, auth, theming, data-fetching, and layout
 * concerns live in their respective layers below this point.
 *
 * App.tsx → AppProviders → Router → Layouts → Pages → Modules → Components
 */

import { AppProviders } from './providers/AppProviders';

export default function App() {
  return <AppProviders />;
}