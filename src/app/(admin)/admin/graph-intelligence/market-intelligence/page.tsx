/**
 * File: src/app/(admin)/admin/graph-intelligence/market-intelligence/page.tsx
 */

import { AdminTopbar } from '@/components/layout/AdminTopbar';
import { MarketIntelligence } from '@/features/admin/graph-intelligence/MarketIntelligence';

export default function MarketIntelligencePage() {
  return (
    <main className="flex h-full flex-col">
      <AdminTopbar title="Market Intelligence" />
      <section className="flex flex-1 flex-col overflow-hidden">
        <MarketIntelligence />
      </section>
    </main>
  );
}