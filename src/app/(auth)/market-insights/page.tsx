/**
 * /app/market-insights/page.tsx
 *
 * MVP SCOPE REDUCTION: Market Insights is not part of the MVP.
 *
 * This route is retained to prevent 404 errors for any existing sessions
 * where user_direction = 'market'. It immediately redirects to /dashboard.
 *
 * POST-MVP: Replace this file with the full Market Insights implementation.
 */

import { redirect } from 'next/navigation';

export default function MarketInsightsRedirect() {
  redirect('/dashboard');
}
