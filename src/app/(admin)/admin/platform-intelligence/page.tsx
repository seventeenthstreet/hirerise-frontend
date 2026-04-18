'use client';

// app/(admin)/admin/platform-intelligence/page.tsx
// Route: /admin/platform-intelligence
//
// Platform Intelligence & Control Center — 11-module admin control panel.
// Single page with left sub-nav + content pane.

import { useState, useEffect, useCallback } from 'react';
import { AdminTopbar } from '@/components/layout/AdminTopbar';
import { cn } from '@/utils/cn';
import { piService } from '@/services/platformIntelligenceService';
import type {
  AISettings, MarketSource, CareerDataset, CHIWeights,
  SkillTaxonomyNode, CareerPath, TrainingSource, SubscriptionPlan,
  AIUsageAnalytics, FeatureFlag, AIPrompt,
} from '@/services/platformIntelligenceService';

// ─── Shared primitives ────────────────────────────────────────────────────────

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-surface-100 bg-white shadow-card', className)}>
      {children}
    </div>
  );
}

function SectionHeader({ title, sub, action }: { title: string; sub: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h2 className="text-lg font-semibold text-surface-900">{title}</h2>
        <p className="mt-0.5 text-sm text-surface-500">{sub}</p>
      </div>
      {action}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-widest text-surface-400 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn('w-full rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-surface-900 placeholder-surface-400 focus:border-hr-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-hr-100', className)}
      {...props}
    />
  );
}

function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn('w-full rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-surface-900 focus:border-hr-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-hr-100', className)} {...props}>
      {children}
    </select>
  );
}

function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={cn('w-full rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-surface-900 placeholder-surface-400 focus:border-hr-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-hr-100', className)} {...props} />
  );
}

function SaveBtn({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={loading}
      className="inline-flex items-center gap-2 rounded-lg bg-hr-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-hr-700 disabled:opacity-50">
      {loading ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : null}
      Save Changes
    </button>
  );
}

function AddBtn({ onClick, label = 'Add New' }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-hr-200 bg-hr-50 px-3 py-2 text-sm font-semibold text-hr-700 transition hover:bg-hr-100">
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
      {label}
    </button>
  );
}

function DeleteBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="rounded p-1 text-surface-400 transition hover:bg-red-50 hover:text-red-600">
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
    </button>
  );
}

function EditBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="rounded p-1 text-surface-400 transition hover:bg-hr-50 hover:text-hr-600">
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
    </button>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
      active ? 'bg-green-50 text-green-700' : 'bg-surface-100 text-surface-500')}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function Spinner() {
  return <div className="flex items-center justify-center p-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-surface-200 border-t-hr-600" /></div>;
}

function toast(msg: string) { console.log('[PI]', msg); } // replace with real toast

// ─── Modal wrapper ────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-surface-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-surface-900">{title}</h3>
          <button onClick={onClose} className="rounded p-1 text-surface-400 hover:text-surface-700">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
      </div>
    </div>
  );
}

// ─── 1. AI Engine Control ─────────────────────────────────────────────────────

function AIEngineControl() {
  const [data, setData] = useState<AISettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { piService.getAISettings().then(d => setData(d)).catch(() => {}); }, []);

  const save = async () => {
    if (!data) return;
    setSaving(true);
    try { await piService.saveAISettings(data); toast('AI settings saved'); }
    finally { setSaving(false); }
  };

  if (!data) return <Spinner />;

  return (
    <div className="space-y-6">
      <SectionHeader title="AI Engine Control" sub="Configure the primary AI model, fallback, and inference parameters." action={<SaveBtn loading={saving} onClick={save} />} />
      <Card className="p-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Primary Model">
          <Select value={data.primary_model} onChange={e => setData({ ...data, primary_model: e.target.value })}>
            {['claude-sonnet-4-5','claude-opus-4-6','gpt-4o','gpt-4o-mini','gpt-4-turbo','gemini-1.5-pro'].map(m => <option key={m} value={m}>{m}</option>)}
          </Select>
        </Field>
        <Field label="Fallback Model">
          <Select value={data.fallback_model} onChange={e => setData({ ...data, fallback_model: e.target.value })}>
            {['gpt-4o-mini','claude-haiku-4-5','gemini-1.5-flash','llama-3-70b'].map(m => <option key={m} value={m}>{m}</option>)}
          </Select>
        </Field>
        <Field label="Temperature (0 – 1)">
          <Input type="number" min={0} max={1} step={0.05} value={data.temperature} onChange={e => setData({ ...data, temperature: parseFloat(e.target.value) })} />
        </Field>
        <Field label="Max Tokens">
          <Input type="number" min={256} max={8192} step={64} value={data.max_tokens} onChange={e => setData({ ...data, max_tokens: parseInt(e.target.value) })} />
        </Field>
        <Field label="Analysis Mode">
          <Select value={data.analysis_mode} onChange={e => setData({ ...data, analysis_mode: e.target.value })}>
            {['balanced','creative','precise','fast'].map(m => <option key={m} value={m}>{m}</option>)}
          </Select>
        </Field>
      </Card>
    </div>
  );
}

// ─── 2. Market Data Sources ───────────────────────────────────────────────────

function MarketDataSources() {
  const [items, setItems] = useState<MarketSource[]>([]);
  const [modal, setModal] = useState<Partial<MarketSource> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => piService.listMarketSources().then(d => setItems(Array.isArray(d) ? d : [])).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!modal) return;
    setSaving(true);
    try {
      if (modal.id) await piService.updateMarketSource(modal.id, modal);
      else await piService.createMarketSource(modal as any);
      toast('Saved'); setModal(null); load();
    } finally { setSaving(false); }
  };

  const del = async (id: string) => { await piService.deleteMarketSource(id); load(); };

  return (
    <div className="space-y-6">
      <SectionHeader title="Market Data APIs" sub="External APIs used to gather job demand, salary trends, and growth signals." action={<AddBtn onClick={() => setModal({ status: 'active', region: 'india', update_frequency: 'daily' })} />} />
      <Card>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-surface-100">{['Name','Region','Frequency','Status',''].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-400">{h}</th>)}</tr></thead>
          <tbody>{items.map(item => (
            <tr key={item.id} className="border-b border-surface-50 last:border-0 hover:bg-surface-50/50">
              <td className="px-4 py-3 font-medium text-surface-900">{item.name}</td>
              <td className="px-4 py-3 text-surface-500">{item.region}</td>
              <td className="px-4 py-3 text-surface-500">{item.update_frequency}</td>
              <td className="px-4 py-3"><StatusBadge active={item.status === 'active'} /></td>
              <td className="px-4 py-3"><div className="flex gap-1 justify-end"><EditBtn onClick={() => setModal(item)} /><DeleteBtn onClick={() => item.id && del(item.id)} /></div></td>
            </tr>
          ))}</tbody>
        </table>
      </Card>
      {modal && (
        <Modal title={modal.id ? 'Edit Source' : 'New Source'} onClose={() => setModal(null)}>
          {(['name','endpoint','api_key'] as const).map(f => <Field key={f} label={f.replace('_',' ')}><Input value={(modal as any)[f] || ''} onChange={e => setModal({ ...modal, [f]: e.target.value })} /></Field>)}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Region"><Select value={modal.region||'india'} onChange={e => setModal({ ...modal, region: e.target.value })}>{['india','us','uk','uae','global'].map(r => <option key={r}>{r}</option>)}</Select></Field>
            <Field label="Frequency"><Select value={modal.update_frequency||'daily'} onChange={e => setModal({ ...modal, update_frequency: e.target.value })}>{['realtime','hourly','daily','weekly'].map(r => <option key={r}>{r}</option>)}</Select></Field>
            <Field label="Status"><Select value={modal.status||'active'} onChange={e => setModal({ ...modal, status: e.target.value as any })}>{['active','inactive'].map(r => <option key={r}>{r}</option>)}</Select></Field>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-surface-100">
            <button onClick={() => setModal(null)} className="rounded-lg border border-surface-200 px-4 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50">Cancel</button>
            <SaveBtn loading={saving} onClick={save} />
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── 3. Career Dataset Manager ────────────────────────────────────────────────

function CareerDatasetManager() {
  const [items, setItems] = useState<CareerDataset[]>([]);
  const [modal, setModal] = useState<Partial<CareerDataset> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => piService.listCareerDatasets().then(d => setItems(Array.isArray(d) ? d : [])).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!modal) return;
    setSaving(true);
    try {
      if (modal.id) await piService.updateCareerDataset(modal.id, modal);
      else await piService.createCareerDataset(modal as any);
      toast('Saved'); setModal(null); load();
    } finally { setSaving(false); }
  };

  const TYPES = ['job_roles','salary_benchmarks','skill_taxonomy','industry_demand'];

  return (
    <div className="space-y-6">
      <SectionHeader title="Career Dataset Manager" sub="Upload and manage datasets used by AI engines. Supported: CSV, JSON." action={<AddBtn label="Register Dataset" onClick={() => setModal({ dataset_type: 'job_roles', version: '1.0.0' })} />} />
      <Card>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-surface-100">{['Name','Type','Version','URL',''].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-400">{h}</th>)}</tr></thead>
          <tbody>{items.map(item => (
            <tr key={item.id} className="border-b border-surface-50 last:border-0 hover:bg-surface-50/50">
              <td className="px-4 py-3 font-medium text-surface-900">{item.dataset_name}</td>
              <td className="px-4 py-3"><span className="rounded-full bg-hr-50 px-2 py-0.5 text-[10px] font-bold uppercase text-hr-700">{item.dataset_type?.replace(/_/g,' ')}</span></td>
              <td className="px-4 py-3 text-surface-500">{item.version}</td>
              <td className="px-4 py-3 text-xs text-hr-600 truncate max-w-[180px]">{item.file_url}</td>
              <td className="px-4 py-3"><div className="flex gap-1 justify-end"><EditBtn onClick={() => setModal(item)} /><DeleteBtn onClick={() => item.id && piService.deleteCareerDataset(item.id).then(load)} /></div></td>
            </tr>
          ))}</tbody>
        </table>
      </Card>
      {modal && (
        <Modal title={modal.id ? 'Edit Dataset' : 'Register Dataset'} onClose={() => setModal(null)}>
          <Field label="Dataset Name"><Input value={modal.dataset_name||''} onChange={e => setModal({ ...modal, dataset_name: e.target.value })} /></Field>
          <Field label="Type"><Select value={modal.dataset_type||'job_roles'} onChange={e => setModal({ ...modal, dataset_type: e.target.value })}>{TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}</Select></Field>
          <Field label="File URL / Storage Path"><Input value={modal.file_url||''} onChange={e => setModal({ ...modal, file_url: e.target.value })} placeholder="gs://bucket/path or https://..." /></Field>
          <Field label="Version"><Input value={modal.version||'1.0.0'} onChange={e => setModal({ ...modal, version: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2 border-t border-surface-100">
            <button onClick={() => setModal(null)} className="rounded-lg border border-surface-200 px-4 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50">Cancel</button>
            <SaveBtn loading={saving} onClick={save} />
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── 4. CHI Score Configuration ───────────────────────────────────────────────

function CHIConfiguration() {
  const [data, setData] = useState<CHIWeights | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { piService.getCHIWeights().then(d => setData(d)).catch(() => {}); }, []);

  const total = data ? Object.entries(data).filter(([k]) => k.endsWith('_weight')).reduce((s, [, v]) => s + (Number(v) || 0), 0) : 0;

  const save = async () => {
    if (!data) return;
    if (Math.round(total) !== 100) { setErr('Weights must total 100%'); return; }
    setSaving(true); setErr(null);
    try { await piService.saveCHIWeights(data); toast('CHI weights saved'); }
    catch (e: any) { setErr(e?.message); }
    finally { setSaving(false); }
  };

  if (!data) return <Spinner />;

  const FIELDS: { key: keyof CHIWeights; label: string; desc: string }[] = [
    { key: 'skill_weight',      label: 'Skill Score',      desc: 'Proficiency in relevant technical and soft skills' },
    { key: 'experience_weight', label: 'Experience',       desc: 'Years of relevant industry experience' },
    { key: 'market_weight',     label: 'Market Demand',    desc: 'Current job market demand for the career' },
    { key: 'salary_weight',     label: 'Salary Potential', desc: 'Earning potential relative to education investment' },
    { key: 'education_weight',  label: 'Education Fit',    desc: 'Alignment of education with career requirements' },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader title="CHI Score Configuration" sub="Adjust the weighting factors used to compute the Career Health Index." action={<SaveBtn loading={saving} onClick={save} />} />
      <Card className="p-6 space-y-5">
        {FIELDS.map(({ key, label, desc }) => (
          <div key={key} className="flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-surface-900">{label}</p>
              <p className="text-xs text-surface-400">{desc}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <input type="range" min={0} max={60} value={data[key] as number}
                onChange={e => setData({ ...data, [key]: parseInt(e.target.value) })}
                className="w-28 accent-hr-600" />
              <span className="w-12 text-right text-sm font-bold tabular-nums text-surface-900">{data[key]}%</span>
            </div>
          </div>
        ))}
        <div className={cn('flex items-center justify-between rounded-lg px-4 py-3 text-sm font-semibold', Math.round(total) === 100 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700')}>
          <span>Total</span>
          <span>{total}% {Math.round(total) === 100 ? '✓' : '← must equal 100%'}</span>
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
      </Card>
    </div>
  );
}

// ─── 5. Skill Taxonomy Manager ────────────────────────────────────────────────

function SkillTaxonomyManager() {
  const [items, setItems] = useState<SkillTaxonomyNode[]>([]);
  const [modal, setModal] = useState<Partial<SkillTaxonomyNode> | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(() => piService.listSkillTaxonomy().then(d => setItems(Array.isArray(d) ? d : [])).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!modal) return;
    setSaving(true);
    try {
      if (modal.id) await piService.updateSkillTaxonomy(modal.id, modal);
      else await piService.createSkillTaxonomy(modal as any);
      toast('Saved'); setModal(null); load();
    } finally { setSaving(false); }
  };

  const filtered = items.filter(i => i.skill_name?.toLowerCase().includes(search.toLowerCase()));
  const roots = filtered.filter(i => !i.parent_skill_id);
  const children = filtered.filter(i => i.parent_skill_id);

  return (
    <div className="space-y-6">
      <SectionHeader title="Skill Taxonomy Manager" sub="Define hierarchical skill structures used across AI engines and Career Graph." action={<AddBtn onClick={() => setModal({ parent_skill_id: null })} />} />
      <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search skills…" className="max-w-sm" />
      <Card>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-surface-100">{['Skill','Category','Parent',''].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-400">{h}</th>)}</tr></thead>
          <tbody>
            {roots.map(root => {
              const kids = children.filter(c => c.parent_skill_id === root.id);
              return [
                <tr key={root.id} className="border-b border-surface-50 bg-surface-50/30 hover:bg-surface-50">
                  <td className="px-4 py-3 font-semibold text-surface-900">{root.skill_name}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-hr-50 px-2 py-0.5 text-[10px] font-bold text-hr-700">{root.category}</span></td>
                  <td className="px-4 py-3 text-surface-400">—</td>
                  <td className="px-4 py-3"><div className="flex gap-1 justify-end"><EditBtn onClick={() => setModal(root)} /><DeleteBtn onClick={() => root.id && piService.deleteSkillTaxonomy(root.id).then(load)} /></div></td>
                </tr>,
                ...kids.map(kid => (
                  <tr key={kid.id} className="border-b border-surface-50 last:border-0 hover:bg-surface-50/50">
                    <td className="px-4 py-3 text-surface-600 pl-10">↳ {kid.skill_name}</td>
                    <td className="px-4 py-3 text-surface-400">{kid.category}</td>
                    <td className="px-4 py-3 text-surface-400 text-xs">{root.skill_name}</td>
                    <td className="px-4 py-3"><div className="flex gap-1 justify-end"><EditBtn onClick={() => setModal(kid)} /><DeleteBtn onClick={() => kid.id && piService.deleteSkillTaxonomy(kid.id).then(load)} /></div></td>
                  </tr>
                )),
              ];
            })}
          </tbody>
        </table>
      </Card>
      {modal && (
        <Modal title={modal.id ? 'Edit Skill' : 'Add Skill'} onClose={() => setModal(null)}>
          <Field label="Skill Name"><Input value={modal.skill_name||''} onChange={e => setModal({ ...modal, skill_name: e.target.value })} /></Field>
          <Field label="Category"><Input value={modal.category||''} onChange={e => setModal({ ...modal, category: e.target.value })} /></Field>
          <Field label="Parent Skill (optional)">
            <Select value={modal.parent_skill_id||''} onChange={e => setModal({ ...modal, parent_skill_id: e.target.value || null })}>
              <option value="">— None (root) —</option>
              {items.filter(i => !i.parent_skill_id && i.id !== modal.id).map(i => <option key={i.id} value={i.id}>{i.skill_name}</option>)}
            </Select>
          </Field>
          <div className="flex justify-end gap-2 pt-2 border-t border-surface-100">
            <button onClick={() => setModal(null)} className="rounded-lg border border-surface-200 px-4 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50">Cancel</button>
            <SaveBtn loading={saving} onClick={save} />
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── 6. Career Path Rules Engine ─────────────────────────────────────────────

function CareerPathRules() {
  const [items, setItems] = useState<CareerPath[]>([]);
  const [modal, setModal] = useState<Partial<CareerPath> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => piService.listCareerPaths().then(d => setItems(Array.isArray(d) ? d : [])).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!modal) return;
    setSaving(true);
    try {
      const payload = { ...modal, required_skills: typeof modal.required_skills === 'string' ? (modal.required_skills as any).split(',').map((s: string) => s.trim()) : modal.required_skills || [] };
      if (modal.id) await piService.updateCareerPath(modal.id, payload);
      else await piService.createCareerPath(payload as any);
      toast('Saved'); setModal(null); load();
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Career Path Rules Engine" sub="Define career transitions, required skills, and probability scores." action={<AddBtn onClick={() => setModal({ probability_score: 75, min_experience: 2 })} />} />
      <Card>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-surface-100">{['From','To','Min Exp.','Probability','Salary Range',''].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-400">{h}</th>)}</tr></thead>
          <tbody>{items.map(item => (
            <tr key={item.id} className="border-b border-surface-50 last:border-0 hover:bg-surface-50/50">
              <td className="px-4 py-3 font-medium text-surface-900">{item.from_role}</td>
              <td className="px-4 py-3 text-hr-700 font-semibold">{item.to_role}</td>
              <td className="px-4 py-3 text-surface-500">{item.min_experience}yr</td>
              <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="h-1.5 w-20 rounded-full bg-surface-100"><div className="h-1.5 rounded-full bg-hr-500" style={{ width: `${item.probability_score}%` }} /></div><span className="text-xs font-bold">{item.probability_score}%</span></div></td>
              <td className="px-4 py-3 text-surface-500 text-xs">{item.salary_range}</td>
              <td className="px-4 py-3"><div className="flex gap-1 justify-end"><EditBtn onClick={() => setModal({ ...item, required_skills: item.required_skills?.join(', ') as any })} /><DeleteBtn onClick={() => item.id && piService.deleteCareerPath(item.id).then(load)} /></div></td>
            </tr>
          ))}</tbody>
        </table>
      </Card>
      {modal && (
        <Modal title={modal.id ? 'Edit Path' : 'Add Career Path'} onClose={() => setModal(null)}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From Role"><Input value={modal.from_role||''} onChange={e => setModal({ ...modal, from_role: e.target.value })} /></Field>
            <Field label="To Role"><Input value={modal.to_role||''} onChange={e => setModal({ ...modal, to_role: e.target.value })} /></Field>
            <Field label="Min Experience (yrs)"><Input type="number" value={modal.min_experience||0} onChange={e => setModal({ ...modal, min_experience: parseInt(e.target.value) })} /></Field>
            <Field label="Probability Score"><Input type="number" min={0} max={100} value={modal.probability_score||0} onChange={e => setModal({ ...modal, probability_score: parseInt(e.target.value) })} /></Field>
            <Field label="Salary Range" ><Input value={modal.salary_range||''} placeholder="e.g. ₹12–20 LPA" onChange={e => setModal({ ...modal, salary_range: e.target.value })} /></Field>
          </div>
          <Field label="Required Skills (comma-separated)"><Input value={(modal.required_skills as any)||''} onChange={e => setModal({ ...modal, required_skills: e.target.value as any })} placeholder="Python, SQL, System Design" /></Field>
          <div className="flex justify-end gap-2 pt-2 border-t border-surface-100">
            <button onClick={() => setModal(null)} className="rounded-lg border border-surface-200 px-4 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50">Cancel</button>
            <SaveBtn loading={saving} onClick={save} />
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── 7. Training Providers ────────────────────────────────────────────────────

function TrainingProviders() {
  const [items, setItems] = useState<TrainingSource[]>([]);
  const [modal, setModal] = useState<Partial<TrainingSource> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => piService.listTrainingSources().then(d => setItems(Array.isArray(d) ? d : [])).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!modal) return;
    setSaving(true);
    try {
      if (modal.id) await piService.updateTrainingSource(modal.id, modal);
      else await piService.createTrainingSource(modal as any);
      toast('Saved'); setModal(null); load();
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Training Providers" sub="Manage course providers and map courses to skills." action={<AddBtn label="Add Course" onClick={() => setModal({ difficulty: 'beginner', cost: 0 })} />} />
      <Card>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-surface-100">{['Provider','Course','Skill','Level','Cost',''].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-400">{h}</th>)}</tr></thead>
          <tbody>{items.map(item => (
            <tr key={item.id} className="border-b border-surface-50 last:border-0 hover:bg-surface-50/50">
              <td className="px-4 py-3 font-medium text-surface-900">{item.provider_name}</td>
              <td className="px-4 py-3 text-surface-600 max-w-[200px] truncate">{item.course_name}</td>
              <td className="px-4 py-3"><span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700">{item.mapped_skill}</span></td>
              <td className="px-4 py-3 text-surface-500 capitalize">{item.difficulty}</td>
              <td className="px-4 py-3 text-surface-500">{item.cost === 0 ? 'Free' : `$${item.cost}`}</td>
              <td className="px-4 py-3"><div className="flex gap-1 justify-end"><EditBtn onClick={() => setModal(item)} /><DeleteBtn onClick={() => item.id && piService.deleteTrainingSource(item.id).then(load)} /></div></td>
            </tr>
          ))}</tbody>
        </table>
      </Card>
      {modal && (
        <Modal title={modal.id ? 'Edit Course' : 'Add Course'} onClose={() => setModal(null)}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Provider"><Input value={modal.provider_name||''} onChange={e => setModal({ ...modal, provider_name: e.target.value })} placeholder="Coursera, Udemy…" /></Field>
            <Field label="Mapped Skill"><Input value={modal.mapped_skill||''} onChange={e => setModal({ ...modal, mapped_skill: e.target.value })} /></Field>
          </div>
          <Field label="Course Name"><Input value={modal.course_name||''} onChange={e => setModal({ ...modal, course_name: e.target.value })} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Difficulty"><Select value={modal.difficulty||'beginner'} onChange={e => setModal({ ...modal, difficulty: e.target.value })}>{['beginner','intermediate','advanced'].map(d => <option key={d}>{d}</option>)}</Select></Field>
            <Field label="Duration"><Input value={modal.duration||''} placeholder="e.g. 40hr" onChange={e => setModal({ ...modal, duration: e.target.value })} /></Field>
            <Field label="Cost ($)"><Input type="number" value={modal.cost||0} onChange={e => setModal({ ...modal, cost: parseFloat(e.target.value) })} /></Field>
          </div>
          <Field label="Course URL"><Input value={modal.link||''} onChange={e => setModal({ ...modal, link: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2 border-t border-surface-100">
            <button onClick={() => setModal(null)} className="rounded-lg border border-surface-200 px-4 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50">Cancel</button>
            <SaveBtn loading={saving} onClick={save} />
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── 8. Subscription Plans ────────────────────────────────────────────────────

function SubscriptionPlans() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [editing, setEditing] = useState<Record<string, SubscriptionPlan>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    piService.listSubscriptionPlans().then(d => {
      const arr = Array.isArray(d) ? d : [];
      setPlans(arr);
      const map: Record<string, SubscriptionPlan> = {};
      arr.forEach(p => { map[p.plan_name] = { ...p }; });
      setEditing(map);
    }).catch(() => {});
  }, []);

  const save = async (plan: string) => {
    const d = editing[plan]; if (!d) return;
    setSaving(plan);
    try { await piService.saveSubscriptionPlan(plan, d); toast(`${plan} plan saved`); }
    finally { setSaving(null); }
  };

  const PLAN_COLORS: Record<string, string> = { free: 'bg-surface-100 text-surface-700', pro: 'bg-hr-50 text-hr-700', enterprise: 'bg-violet-50 text-violet-700' };

  const LIMITS = [
    { key: 'career_analyses_limit', label: 'Career Analyses' },
    { key: 'resume_scans_limit',    label: 'Resume Scans'    },
    { key: 'market_reports_limit',  label: 'Market Reports'  },
    { key: 'api_calls_limit',       label: 'API Calls'       },
  ] as const;

  return (
    <div className="space-y-6">
      <SectionHeader title="User Plans & Credit Control" sub="Configure limits and pricing for each subscription tier." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {plans.map(plan => {
          const d = editing[plan.plan_name] ?? plan;
          return (
            <Card key={plan.plan_name} className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className={cn('rounded-full px-3 py-1 text-sm font-bold capitalize', PLAN_COLORS[plan.plan_name] || 'bg-surface-100 text-surface-700')}>{plan.plan_name}</span>
                <SaveBtn loading={saving === plan.plan_name} onClick={() => save(plan.plan_name)} />
              </div>
              <Field label="Monthly Price ($)">
                <Input type="number" value={d.monthly_price} onChange={e => setEditing({ ...editing, [plan.plan_name]: { ...d, monthly_price: parseFloat(e.target.value) } })} />
              </Field>
              {LIMITS.map(({ key, label }) => (
                <Field key={key} label={label}>
                  <div className="flex gap-2 items-center">
                    <Input type="number" value={d[key] === -1 ? '' : d[key]} placeholder="-1 = unlimited" onChange={e => setEditing({ ...editing, [plan.plan_name]: { ...d, [key]: parseInt(e.target.value) || -1 } })} />
                    {d[key] === -1 && <span className="text-xs font-bold text-green-600 whitespace-nowrap">∞</span>}
                  </div>
                </Field>
              ))}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── 9. AI Usage Analytics ────────────────────────────────────────────────────

function AIUsageAnalyticsPanel() {
  const [data, setData] = useState<AIUsageAnalytics | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => { piService.getAIUsageAnalytics(days).then(d => setData(d)).catch(() => {}); }, [days]);

  if (!data) return <Spinner />;

  const maxCount = Math.max(...(data.by_day.map(d => d.count)), 1);
  const BAR_PALETTE = ['#6366f1','#06b6d4','#22c55e','#f59e0b','#f43f5e','#a78bfa'];

  return (
    <div className="space-y-6">
      <SectionHeader title="AI Usage Analytics" sub="Token consumption, request volume, and active user trends."
        action={
          <Select value={days} onChange={e => setDays(parseInt(e.target.value))} className="w-32 text-xs">
            {[7,14,30,60,90].map(d => <option key={d} value={d}>Last {d} days</option>)}
          </Select>
        } />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Total Requests', value: data.summary.total_requests.toLocaleString(), icon: '📡' },
          { label: 'Total Tokens',   value: (data.summary.total_tokens / 1000).toFixed(1) + 'K', icon: '🔢' },
          { label: 'Estimated Cost', value: '$' + data.summary.total_cost.toFixed(2), icon: '💰' },
          { label: 'Active Users',   value: data.summary.active_users.toLocaleString(), icon: '👥' },
        ].map(kpi => (
          <Card key={kpi.label} className="p-4 flex items-center gap-3">
            <span className="text-2xl">{kpi.icon}</span>
            <div><p className="text-xs text-surface-400 uppercase font-semibold tracking-wider">{kpi.label}</p><p className="text-xl font-bold text-surface-900 tabular-nums">{kpi.value}</p></div>
          </Card>
        ))}
      </div>

      {/* Daily requests bar chart */}
      <Card className="p-5">
        <p className="text-sm font-semibold text-surface-700 mb-4">Daily Requests</p>
        <div className="flex items-end gap-1 h-24">
          {data.by_day.slice(-30).map((d, i) => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
              <div className="w-full rounded-t" style={{ height: `${(d.count / maxCount) * 80}px`, background: '#6366f1', opacity: 0.7, minHeight: d.count > 0 ? 2 : 0, transition: 'height 0.5s ease' }} />
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:block rounded bg-surface-900 px-1.5 py-0.5 text-[9px] text-white whitespace-nowrap">{d.count} req · {d.date}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Model + Action breakdown */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <p className="text-sm font-semibold text-surface-700 mb-3">By Model</p>
          {data.by_model.map((m, i) => {
            const maxM = Math.max(...data.by_model.map(x => x.count), 1);
            return (
              <div key={m.model} className="flex items-center gap-3 py-1.5">
                <span className="text-xs text-surface-500 w-36 truncate">{m.model}</span>
                <div className="flex-1 h-2 rounded-full bg-surface-100"><div className="h-2 rounded-full" style={{ width: `${(m.count / maxM) * 100}%`, background: BAR_PALETTE[i % BAR_PALETTE.length] }} /></div>
                <span className="text-xs font-bold tabular-nums text-surface-700">{m.count}</span>
              </div>
            );
          })}
        </Card>
        <Card className="p-5">
          <p className="text-sm font-semibold text-surface-700 mb-3">By Action</p>
          {data.by_action.slice(0, 8).map((a, i) => {
            const maxA = Math.max(...data.by_action.map(x => x.count), 1);
            return (
              <div key={a.action} className="flex items-center gap-3 py-1.5">
                <span className="text-xs text-surface-500 w-36 truncate">{a.action}</span>
                <div className="flex-1 h-2 rounded-full bg-surface-100"><div className="h-2 rounded-full" style={{ width: `${(a.count / maxA) * 100}%`, background: BAR_PALETTE[(i + 2) % BAR_PALETTE.length] }} /></div>
                <span className="text-xs font-bold tabular-nums text-surface-700">{a.count}</span>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}

// ─── 10. Feature Flags ────────────────────────────────────────────────────────

function FeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(() => piService.listFeatureFlags().then(d => setFlags(Array.isArray(d) ? d : [])).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  const toggle = async (f: FeatureFlag) => {
    const name = f.feature_name || f.id || '';
    setSaving(name);
    try { await piService.setFeatureFlag(name, !f.enabled); load(); }
    finally { setSaving(null); }
  };

  const FEATURE_LABELS: Record<string, { label: string; desc: string }> = {
    career_twin_engine:         { label: 'Career Digital Twin',     desc: 'Simulate multi-year career trajectories' },
    labor_market_intelligence:  { label: 'Labor Market Intel',      desc: 'Live job market demand signals' },
    salary_forecast_ai:         { label: 'Salary Forecast AI',      desc: 'Predictive salary growth projections' },
    skill_gap_analyzer:         { label: 'Skill Gap Analyzer',      desc: 'Identify missing skills for career goals' },
    ai_career_advisor:          { label: 'AI Career Advisor',       desc: 'Conversational AI career guidance' },
    education_roi_engine:       { label: 'Education ROI Engine',    desc: 'Compute financial return on education' },
    global_insights_dashboard:  { label: 'Global Insights Dash',    desc: 'Macro-level career intelligence view' },
    career_health_index:        { label: 'Career Health Index',     desc: 'CHI scoring and profiling' },
    resume_intelligence:        { label: 'Resume Intelligence',     desc: 'AI-powered resume analysis' },
    skill_evolution_engine:     { label: 'Skill Evolution Engine',  desc: 'Personalised skill roadmap generation' },
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Feature Flags" sub="Enable or disable platform features in real time without a deployment." />
      <Card>
        <div className="divide-y divide-surface-50">
          {flags.map(flag => {
            const name = flag.feature_name || flag.id || '';
            const meta = FEATURE_LABELS[name] ?? { label: name.replace(/_/g, ' '), desc: '' };
            return (
              <div key={name} className="flex items-center justify-between px-5 py-4 hover:bg-surface-50/50">
                <div>
                  <p className="text-sm font-semibold text-surface-900 capitalize">{meta.label}</p>
                  <p className="text-xs text-surface-400">{meta.desc}</p>
                </div>
                <button
                  onClick={() => toggle(flag)}
                  disabled={saving === name}
                  className={cn('relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                    flag.enabled ? 'bg-hr-600' : 'bg-surface-200',
                    saving === name && 'opacity-50')}
                >
                  <span className={cn('pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition duration-200 ease-in-out', flag.enabled ? 'translate-x-5' : 'translate-x-0')} />
                </button>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ─── 11. AI Prompt Manager ────────────────────────────────────────────────────

function AIPromptManager() {
  const [prompts, setPrompts] = useState<AIPrompt[]>([]);
  const [modal, setModal] = useState<Partial<AIPrompt> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => piService.listAIPrompts().then(d => setPrompts(Array.isArray(d) ? d : [])).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!modal) return;
    setSaving(true);
    try {
      if (modal.id) await piService.updateAIPrompt(modal.id, modal);
      else await piService.createAIPrompt(modal as any);
      toast('Saved'); setModal(null); load();
    } finally { setSaving(false); }
  };

  const ENGINES = ['career_analysis','chi_scoring','skill_gap','resume_intelligence','advisor','digital_twin','education_roi'];

  return (
    <div className="space-y-6">
      <SectionHeader title="AI Prompt Manager" sub="Edit system prompts used by each AI engine. Changes take effect immediately." action={<AddBtn label="New Prompt" onClick={() => setModal({ version: '1.0.0', engine: 'career_analysis' })} />} />
      <div className="space-y-3">
        {prompts.map(p => (
          <Card key={p.id} className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <p className="text-sm font-semibold text-surface-900">{p.prompt_name}</p>
                  <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-700">{p.engine}</span>
                  <span className="text-[10px] text-surface-400">v{p.version}</span>
                </div>
                <p className="text-xs text-surface-500 line-clamp-2 font-mono leading-relaxed">{p.prompt_text}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <EditBtn onClick={() => setModal(p)} />
                <DeleteBtn onClick={() => p.id && piService.deleteAIPrompt(p.id).then(load)} />
              </div>
            </div>
          </Card>
        ))}
      </div>
      {modal && (
        <Modal title={modal.id ? 'Edit Prompt' : 'New Prompt'} onClose={() => setModal(null)}>
          <Field label="Prompt Name"><Input value={modal.prompt_name||''} onChange={e => setModal({ ...modal, prompt_name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Engine"><Select value={modal.engine||'career_analysis'} onChange={e => setModal({ ...modal, engine: e.target.value })}>{ENGINES.map(e => <option key={e} value={e}>{e.replace(/_/g,' ')}</option>)}</Select></Field>
            <Field label="Version"><Input value={modal.version||'1.0.0'} onChange={e => setModal({ ...modal, version: e.target.value })} /></Field>
          </div>
          <Field label="Prompt Text"><Textarea rows={8} value={modal.prompt_text||''} onChange={e => setModal({ ...modal, prompt_text: e.target.value })} placeholder="You are a career intelligence AI…" className="font-mono text-xs" /></Field>
          <div className="flex justify-end gap-2 pt-2 border-t border-surface-100">
            <button onClick={() => setModal(null)} className="rounded-lg border border-surface-200 px-4 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50">Cancel</button>
            <SaveBtn loading={saving} onClick={save} />
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Sub-nav config ───────────────────────────────────────────────────────────

const SUB_NAV = [
  { id: 'ai-engine',      label: 'AI Engine Control',    icon: '🤖', component: AIEngineControl     },
  { id: 'market-data',    label: 'Market Data APIs',     icon: '📡', component: MarketDataSources   },
  { id: 'datasets',       label: 'Career Datasets',      icon: '📦', component: CareerDatasetManager },
  { id: 'chi',            label: 'CHI Configuration',    icon: '⚖️', component: CHIConfiguration    },
  { id: 'taxonomy',       label: 'Skill Taxonomy',       icon: '🌳', component: SkillTaxonomyManager },
  { id: 'career-paths',   label: 'Career Path Rules',    icon: '🗺️', component: CareerPathRules     },
  { id: 'training',       label: 'Training Providers',   icon: '🎓', component: TrainingProviders    },
  { id: 'plans',          label: 'User Plans',           icon: '💳', component: SubscriptionPlans    },
  { id: 'usage',          label: 'AI Usage Analytics',   icon: '📊', component: AIUsageAnalyticsPanel },
  { id: 'flags',          label: 'Feature Flags',        icon: '🚩', component: FeatureFlags         },
  { id: 'prompts',        label: 'AI Prompt Manager',    icon: '✏️', component: AIPromptManager      },
] as const;

type TabId = typeof SUB_NAV[number]['id'];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PlatformIntelligencePage() {
  const [active, setActive] = useState<TabId>('ai-engine');
  const current = SUB_NAV.find(n => n.id === active)!;
  const Component = current.component;

  return (
    <div className="flex h-full flex-col">
      <AdminTopbar title="Platform Intelligence" />
      <div className="flex flex-1 overflow-hidden">
        {/* Sub-nav sidebar */}
        <aside className="w-56 shrink-0 overflow-y-auto border-r border-surface-100 bg-white py-3">
          <p className="px-4 pb-2 text-[10px] font-bold uppercase tracking-widest text-surface-400">Control Center</p>
          {SUB_NAV.map(item => (
            <button
              key={item.id}
              onClick={() => setActive(item.id)}
              className={cn('flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors',
                active === item.id
                  ? 'bg-hr-50 text-hr-700 font-semibold'
                  : 'text-surface-600 hover:bg-surface-50 hover:text-surface-900')}
            >
              <span className="text-base">{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Component />
        </main>
      </div>
    </div>
  );
}