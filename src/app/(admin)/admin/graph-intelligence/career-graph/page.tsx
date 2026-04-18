/**
 * File: src/app/(admin)/admin/graph-intelligence/career-graph/page.tsx
 */

import { AdminTopbar } from '@/components/layout/AdminTopbar';
import { CareerGraphExplorer } from '@/features/admin/graph-intelligence/CareerGraphExplorer';

export default function CareerGraphExplorerPage() {
  return (
    <main className="flex h-full flex-col">
      <AdminTopbar title="Career Graph Explorer" />
      <section className="flex-1 overflow-hidden">
        <CareerGraphExplorer />
      </section>
    </main>
  );
}