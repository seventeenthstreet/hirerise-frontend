/**
 * src/context/AppContext.hooks.ts
 *
 * Hooks for AppContext.
 * Extracted from AppContext.tsx for Vite Fast Refresh compatibility.
 */

import { useContext } from 'react';
import { AppContext } from './AppContext';
import type { AppContextValue } from './AppContext.types';

/**
 * Access the global app hydration state.
 * Must be used inside <AppProvider>.
 */
export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppContext must be used within <AppProvider>');
  }
  return ctx;
}