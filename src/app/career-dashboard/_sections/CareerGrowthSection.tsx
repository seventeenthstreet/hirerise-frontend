'use client';

/**
 * app/career-dashboard/_sections/CareerGrowthSection.tsx — FIXED
 *
 * useCareerSimulation returns: { simulation, history, loading, error, run }
 *   NOT { data, isLoading }
 *
 * useSalaryIntelligence requires input: { roleId, experienceYears }
 *   Use chi data to build input — skip if not available yet.
 *   Returns: { marketMedian, marketP75 } — no currentEstimated/nextLevelEstimated.
 */

import { useCareerSimulation } from '@/hooks/useCareerSimulation';
import { useCareerHealth }     from '@/hooks/useCareerHealth';
import { useSalaryIntelligence } from '@/hooks/useSalaryIntelligence';
import { useProfile }          from '@/hooks/useProfile';
import { useRouter }           from 'next/navigation';

const T = {
  card: '#0d1117', border: 'rgba(255,255,255,0.07)',
  text: '#dde4ef', muted: '#5f6d87', dim: '#1a2236',
  blue: '#3c72f8', green: '#1fd8a0', amber: '#f4a928', purple: '#9b7cf7',
} as const;

export default function CareerGrowthSection() {
  const router = useRouter();

  // Correct destructuring for useCareerSimulation
  const { simulation, history, loading } = useCareerSimulation();

  // Get role + experience from profile/chi for salary lookup
  const { data: chi }     = useCareerHealth();
  const { data: profile } = useProfile();

  const detectedRole = chi?.currentJobTitle ?? chi?.detectedProfession ?? null;
  const expYears     = (profile?.user as any)?.experienceYears ?? 0;

  // useSalaryIntelligence requires { roleId, experienceYears } — pass null to disable
  const salaryInput = detectedRole
    ? { roleId: detectedRole, experienceYears: expYears }
    : null;

  const { data: salary } = useSalaryIntelligence(salaryInput);

  // Use simulation history or future paths as career paths
  const paths = history?.slice(0, 3) ?? [];

  // Salary from the intelligence hook — marketMedian is the current est
  const currentSalary = salary?.marketMedian ?? null;
  const nextSalary    = salary?.marketP75    ?? null;

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: T.text, margin: 0 }}>Career Growth</h2>
        <button
          onClick={() => router.push('/career-simulator')}
          style={{ fontSize: 12, color: T.blue, background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}
        >
          Simulate Paths →
        </button>
      </div>

      {loading ? (
        <div style={{ color: T.muted, fontSize: 13 }}>Loading growth projections…</div>
      ) : (
        <>
          {/* Salary row */}
          {currentSalary && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{ background: T.dim, borderRadius: 8, padding: '12px 16px', flex: 1 }}>
                <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Market median</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>
                  ₹{(currentSalary / 100000).toFixed(1)}L
                </div>
              </div>
              {nextSalary && (
                <div style={{ background: `${T.green}12`, border: `1px solid ${T.green}30`, borderRadius: 8, padding: '12px 16px', flex: 1 }}>
                  <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>75th percentile</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: T.green }}>
                    ₹{(nextSalary / 100000).toFixed(1)}L
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Simulation history paths */}
          {paths.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {paths.map((sim: any, i: number) => (
                <div
                  key={sim.simulationId ?? i}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: T.dim, borderRadius: 8, padding: '10px 14px' }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                      {sim.targetRole ?? sim.careerPath ?? 'Career Path'}
                    </div>
                    <div style={{ fontSize: 11, color: T.muted }}>
                      {sim.experienceYears != null ? `${sim.experienceYears}yr experience` : ''}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: T.purple, fontWeight: 600 }}>
                    {sim.projectedSalary ? `₹${(sim.projectedSalary / 100000).toFixed(1)}L` : ''}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 13, color: T.muted, marginBottom: 12 }}>
                Run a career simulation to see your growth options.
              </div>
              <button
                onClick={() => router.push('/career-simulator')}
                style={{ padding: '10px 20px', background: T.blue, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Simulate My Career →
              </button>
            </div>
          )}

          {paths.length > 0 && (
            <button
              onClick={() => router.push('/career-simulator')}
              style={{ width: '100%', marginTop: 14, padding: '11px 0', background: 'transparent', color: T.blue, border: `1px solid ${T.blue}40`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Simulate My Career Growth →
            </button>
          )}
        </>
      )}
    </div>
  );
}