'use client';

import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { TopNavbar } from './TopNavbar';
import { MobileMenu } from './MobileMenu';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    // FIX: was bg-surface-950 which flashed white after tailwind config issues.
    // Using explicit hex color as fallback to guarantee dark background always.
    <div className="flex h-screen overflow-hidden" style={{ background: '#0b0e1c' }}>
      {/* Sidebar — desktop */}
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
        className="hidden lg:flex"
      />

      {/* Mobile drawer */}
      <MobileMenu open={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <TopNavbar onMenuClick={() => setMobileOpen(true)} />

        {/* Scrollable page content */}
        <main
          className="flex-1 overflow-y-auto scrollbar-thin"
          style={{ background: '#0b0e1c' }}
        >
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}