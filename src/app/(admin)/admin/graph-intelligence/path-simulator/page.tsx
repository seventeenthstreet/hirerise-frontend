'use client';

import { AdminTopbar } from '@/components/layout/AdminTopbar';
import { CareerPathSimulator } from '@/features/admin/graph-intelligence/CareerPathSimulator';

export default function CareerPathSimulatorPage() {
  return (
    <div className="flex h-full flex-col">
      <AdminTopbar title="Career Path Simulator" />
      <div className="flex-1 overflow-hidden">
        <CareerPathSimulator />
      </div>
    </div>
  );
}