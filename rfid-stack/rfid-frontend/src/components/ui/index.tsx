// src/components/ui/index.tsx
import React from 'react';
import clsx from 'clsx';
import { ReaderStatus, AlertSeverity } from '../../types';

// ── Spinner ────────────────────────────────────────────────────────────────────
export function Spinner({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg className={clsx('animate-spin text-gold', className)} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v2a6 6 0 00-6 6H4z" />
    </svg>
  );
}

// ── KPI Card ───────────────────────────────────────────────────────────────────
interface KPICardProps {
  label: string;
  value: string | number;
  sub?: string;
  trend?: string;
  trendUp?: boolean;
  icon: React.ReactNode;
  variant?: 'default' | 'gold' | 'ok' | 'warn' | 'danger';
  loading?: boolean;
}
export function KPICard({ label, value, sub, trend, trendUp, icon, variant = 'default', loading }: KPICardProps) {
  const iconBg = {
    default: 'bg-white/5 text-muted-2',
    gold:    'bg-gold/10 text-gold',
    ok:      'bg-ok/10 text-ok',
    warn:    'bg-warn/10 text-warn',
    danger:  'bg-danger/10 text-red-400',
  }[variant];

  return (
    <div className="card p-5 card-hover relative overflow-hidden group">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="flex items-start justify-between mb-4">
        <span className="label-mono">{label}</span>
        <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center', iconBg)}>{icon}</div>
      </div>
      {loading ? (
        <div className="h-9 w-24 bg-ink-3 rounded animate-pulse" />
      ) : (
        <div className="font-display text-[38px] font-light text-cream leading-none">{value}</div>
      )}
      {sub && <div className="font-mono text-[9px] text-muted-2 mt-1.5">{sub}</div>}
      {trend && (
        <div className={clsx('flex items-center gap-1 mt-2 font-mono text-[10px]', trendUp ? 'text-ok' : 'text-red-400')}>
          <span>{trendUp ? '↑' : '↓'}</span><span>{trend}</span>
        </div>
      )}
    </div>
  );
}

// ── Status Chip ────────────────────────────────────────────────────────────────
export function StatusChip({ status }: { status: ReaderStatus }) {
  const cfg: Record<ReaderStatus, { cls: string; label: string }> = {
    ONLINE:     { cls: 'chip-online',  label: 'Online' },
    OFFLINE:    { cls: 'chip-offline', label: 'Offline' },
    ERROR:      { cls: 'chip-error',   label: 'Error' },
    CONNECTING: { cls: 'chip-warn',    label: 'Conectando' },
  };
  const { cls, label } = cfg[status] ?? { cls: 'chip-offline', label: status };
  return <span className={cls}><span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse-slow" />{label}</span>;
}

// ── Severity Badge ──────────────────────────────────────────────────────────────
export function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  const cfg: Record<AlertSeverity, string> = {
    INFO:     'chip-offline',
    WARNING:  'chip-warn',
    ERROR:    'chip-error',
    CRITICAL: 'chip-error',
  };
  return <span className={cfg[severity] || 'chip-offline'}>{severity}</span>;
}

// ── RSSI Badge ─────────────────────────────────────────────────────────────────
export function RSSIBadge({ rssi }: { rssi: number }) {
  const cls = rssi > -60 ? 'text-ok' : rssi > -75 ? 'text-warn' : 'text-red-400';
  const dot = rssi > -60 ? 'bg-ok' : rssi > -75 ? 'bg-warn' : 'bg-red-400';
  return (
    <span className={clsx('flex items-center gap-1 font-mono text-[10px]', cls)}>
      <span className={clsx('w-1.5 h-1.5 rounded-full', dot)} />
      {rssi} dBm
    </span>
  );
}

// ── Pagination ─────────────────────────────────────────────────────────────────
interface PaginationProps { page: number; totalPages: number; onChange: (p: number) => void; }
export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center gap-2 justify-end pt-4">
      <button className="btn-ghost py-1.5 px-3 text-[10px]" disabled={page <= 1} onClick={() => onChange(page - 1)}>← Anterior</button>
      <span className="font-mono text-[10px] text-muted-2">{page} / {totalPages}</span>
      <button className="btn-ghost py-1.5 px-3 text-[10px]" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Siguiente →</button>
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, message, action }: { icon?: React.ReactNode; title: string; message?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="w-14 h-14 rounded-2xl bg-ink-3 border border-white/8 flex items-center justify-center text-muted-2 mb-4">{icon}</div>}
      <div className="font-display text-xl text-cream mb-2">{title}</div>
      {message && <p className="font-mono text-[10px] text-muted-2 max-w-xs">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────────
interface ModalProps { open: boolean; onClose: () => void; title: string; children: React.ReactNode; size?: 'sm' | 'md' | 'lg'; }
export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  if (!open) return null;
  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={clsx('relative bg-ink-2 border border-white/8 rounded-2xl shadow-2xl w-full animate-fade-up', widths[size])}>
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <h2 className="font-display text-xl text-cream">{title}</h2>
          <button onClick={onClose} className="btn-icon"><span className="text-lg leading-none">×</span></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ── Skeleton ────────────────────────────────────────────────────────────────────
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={clsx('bg-ink-3 rounded animate-pulse', className)} />;
}

// ── Section header ─────────────────────────────────────────────────────────────
export function SectionHeader({ title, sub, actions }: { title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        <h3 className="font-display text-lg text-cream">{title}</h3>
        {sub && <p className="label-mono mt-0.5">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
