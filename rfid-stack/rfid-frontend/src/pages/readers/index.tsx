// src/pages/readers/index.tsx
import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Layout, Topbar } from '../../components/layout';
import { StatusChip, Modal, SectionHeader, EmptyState, Spinner, Skeleton } from '../../components/ui';
import { useApi } from '../../hooks/useApi';
import { readersApi } from '../../api/client';
import { Reader, ReaderStatus } from '../../types';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuthStore, useRealtimeStore } from '../../store';
import clsx from 'clsx';

// Icons
function Svg({ d, size = 16 }: { d: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>;
}
const RadioIco    = ({ size = 16 }) => <Svg size={size} d="M12 1a3 3 0 100 6 3 3 0 000-6zM1 15a15 15 0 0122 0M5.5 11a9 9 0 0113 0" />;
const RefreshIco  = ({ size = 16 }) => <Svg size={size} d="M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15" />;
const PlusIco     = ({ size = 16 }) => <Svg size={size} d="M12 5v14M5 12h14" />;
const TrashIco    = ({ size = 16 }) => <Svg size={size} d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" />;
const SettingsIco = ({ size = 16 }) => <Svg size={size} d="M12 15a3 3 0 100-6 3 3 0 000 6z" />;

type Filter = 'ALL' | 'ONLINE' | 'OFFLINE' | 'ERROR';

export default function Readers() {
  const [filter,  setFilter]  = useState<Filter>('ALL');
  const [search,  setSearch]  = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [selReader, setSelReader] = useState<Reader | null>(null);
  const { user } = useAuthStore();
  const { readerStatuses } = useRealtimeStore();

  const { data: readers, loading, execute: reload } = useApi<Reader[]>(readersApi.list);

  const filtered = (readers || []).filter(r => {
    const status = readerStatuses[r.id]?.status ?? r.status;
    const matchFilter = filter === 'ALL' || status === filter;
    const matchSearch = !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.ipAddress.includes(search) || r.zone.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const counts = {
    ALL:     readers?.length ?? 0,
    ONLINE:  readers?.filter(r => (readerStatuses[r.id]?.status ?? r.status) === 'ONLINE').length ?? 0,
    OFFLINE: readers?.filter(r => (readerStatuses[r.id]?.status ?? r.status) === 'OFFLINE').length ?? 0,
    ERROR:   readers?.filter(r => (readerStatuses[r.id]?.status ?? r.status) === 'ERROR').length ?? 0,
  };

  const handleRestart = async (id: string) => {
    try {
      await readersApi.restart(id);
      toast.success('Lectora reiniciada');
      reload();
    } catch { toast.error('Error al reiniciar'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta lectora?')) return;
    try {
      await readersApi.remove(id);
      toast.success('Lectora eliminada');
      reload();
      setSelReader(null);
    } catch { toast.error('Error al eliminar'); }
  };

  return (
    <Layout>
      <Topbar title="Lectoras RFID" subtitle="Gestión y monitoreo de lectoras 860–960 MHz"
        actions={user?.role !== 'VIEWER' && (
          <button className="btn-primary" onClick={() => setShowAdd(true)}>
            <PlusIco /> Nueva Lectora
          </button>
        )}
      />

      <div className="flex-1 p-8 page-enter">
        {/* Filters */}
        <div className="flex items-center gap-3 mb-6">
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="input max-w-xs" placeholder="Buscar por nombre, IP, zona…" />
          <div className="flex gap-1.5">
            {(['ALL','ONLINE','OFFLINE','ERROR'] as Filter[]).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={clsx('px-3 py-1.5 rounded-lg font-mono text-[9px] uppercase tracking-wider border transition-all',
                  filter === f ? 'bg-gold text-ink border-gold' : 'bg-ink-3 text-muted-2 border-white/8 hover:border-white/15')}>
                {f} {counts[f] > 0 && `(${counts[f]})`}
              </button>
            ))}
          </div>
          <button className="btn-icon ml-auto" onClick={() => reload()} title="Actualizar">
            <RefreshIco />
          </button>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-3 gap-4">
            {Array.from({length:6}).map((_,i) => <Skeleton key={i} className="h-44" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<RadioIco size={22} />} title="Sin lectoras" message="No se encontraron lectoras con los filtros actuales." />
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {filtered.map(reader => {
              const liveStatus = readerStatuses[reader.id]?.status ?? reader.status;
              return (
                <div key={reader.id}
                  className="card p-5 card-hover cursor-pointer"
                  onClick={() => setSelReader(reader)}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold">
                      <RadioIco size={18} />
                    </div>
                    <StatusChip status={liveStatus} />
                  </div>

                  <div className="mb-4">
                    <div className="font-ui font-semibold text-cream mb-0.5">{reader.name}</div>
                    <div className="label-mono">{reader.location || reader.zone}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/5">
                    <div>
                      <div className="label-mono mb-0.5">IP</div>
                      <div className="font-mono text-[10px] text-muted-3">{reader.ipAddress}:{reader.port}</div>
                    </div>
                    <div>
                      <div className="label-mono mb-0.5">Firmware</div>
                      <div className="font-mono text-[10px] text-muted-3">{reader.firmware || '—'}</div>
                    </div>
                    <div>
                      <div className="label-mono mb-0.5">Último ping</div>
                      <div className="font-mono text-[10px] text-muted-3">
                        {reader.lastSeenAt ? formatDistanceToNow(new Date(reader.lastSeenAt), { locale: es, addSuffix: true }) : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="label-mono mb-0.5">Scans</div>
                      <div className="font-mono text-[10px] text-muted-3">{reader.scanCount?.toLocaleString() || '0'}</div>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4 pt-4 border-t border-white/5">
                    <button className="btn-secondary flex-1 py-1.5 text-[10px]"
                      onClick={e => { e.stopPropagation(); handleRestart(reader.id); }}>
                      <RefreshIco size={12} /> Reiniciar
                    </button>
                    <button className="btn-icon" onClick={e => { e.stopPropagation(); setSelReader(reader); }}>
                      <SettingsIco size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail modal */}
      <Modal open={!!selReader} onClose={() => setSelReader(null)} title={selReader?.name || ''} size="md">
        {selReader && <ReaderDetail reader={selReader} onRestart={handleRestart} onDelete={handleDelete} onClose={() => setSelReader(null)} onReload={reload} />}
      </Modal>

      {/* Add reader modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Nueva Lectora RFID" size="md">
        <AddReaderForm onSuccess={() => { setShowAdd(false); reload(); }} onClose={() => setShowAdd(false)} />
      </Modal>
    </Layout>
  );
}

// ── Reader Detail ─────────────────────────────────────────────────────────────
function ReaderDetail({ reader, onRestart, onDelete, onClose, onReload }: {
  reader: Reader; onRestart: (id: string) => void;
  onDelete: (id: string) => void; onClose: () => void; onReload: () => void;
}) {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <StatusChip status={reader.status} />
        <div className="font-mono text-[10px] text-muted-2">{reader.model}</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          ['IP Address', `${reader.ipAddress}:${reader.port}`],
          ['Zona', reader.zone],
          ['Frecuencia', `${reader.frequencyMin/1000}–${reader.frequencyMax/1000} MHz`],
          ['TX Power', `${reader.txPower} dBm`],
          ['RX Sensitivity', `${reader.rxSensitivity} dBm`],
          ['Scans totales', reader.scanCount?.toLocaleString() || '0'],
        ].map(([label, value]) => (
          <div key={label} className="bg-ink-3 rounded-lg p-3">
            <div className="label-mono mb-1">{label}</div>
            <div className="font-mono text-[11px] text-cream">{value}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-2">
        <button className="btn-secondary flex-1" onClick={() => { onRestart(reader.id); onClose(); }}>
          <RefreshIco size={14} /> Reiniciar
        </button>
        {isAdmin && (
          <button className="btn-danger" onClick={() => onDelete(reader.id)}>
            <TrashIco size={14} /> Eliminar
          </button>
        )}
      </div>
    </div>
  );
}

// ── Add Reader Form ───────────────────────────────────────────────────────────
function AddReaderForm({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const [form, setForm] = useState({ name:'', ipAddress:'', port:'5084', zone:'Zone A', location:'', model:'', txPower:'30', rxSensitivity:'-70' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await readersApi.create({ ...form, port: Number(form.port), txPower: Number(form.txPower), rxSensitivity: Number(form.rxSensitivity) });
      toast.success('Lectora registrada y conectada');
      onSuccess();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al crear lectora');
    } finally { setLoading(false); }
  };

  const up = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label-mono block mb-1.5">Nombre *</label><input className="input" value={form.name} onChange={e=>up('name',e.target.value)} placeholder="Reader-A1" required /></div>
        <div><label className="label-mono block mb-1.5">IP Address *</label><input className="input" value={form.ipAddress} onChange={e=>up('ipAddress',e.target.value)} placeholder="192.168.1.101" required /></div>
        <div><label className="label-mono block mb-1.5">Puerto LLRP</label><input className="input" value={form.port} onChange={e=>up('port',e.target.value)} placeholder="5084" /></div>
        <div><label className="label-mono block mb-1.5">Zona *</label>
          <select className="input" value={form.zone} onChange={e=>up('zone',e.target.value)}>
            {['Zone A','Zone B','Zone C','Zone D','Zone E'].map(z=><option key={z}>{z}</option>)}
          </select>
        </div>
        <div><label className="label-mono block mb-1.5">Ubicación</label><input className="input" value={form.location} onChange={e=>up('location',e.target.value)} placeholder="Entrada principal" /></div>
        <div><label className="label-mono block mb-1.5">Modelo</label><input className="input" value={form.model} onChange={e=>up('model',e.target.value)} placeholder="Impinj R700" /></div>
        <div><label className="label-mono block mb-1.5">TX Power (dBm)</label><input className="input" type="number" value={form.txPower} onChange={e=>up('txPower',e.target.value)} /></div>
        <div><label className="label-mono block mb-1.5">RX Sensitivity (dBm)</label><input className="input" type="number" value={form.rxSensitivity} onChange={e=>up('rxSensitivity',e.target.value)} /></div>
      </div>
      <div className="bg-gold/5 border border-gold/20 rounded-lg p-3">
        <p className="font-mono text-[9px] text-gold uppercase tracking-wider mb-1">Protocolo</p>
        <p className="font-mono text-[10px] text-muted-3">LLRP sobre TCP/IP — Compatible con Impinj R700, Zebra FX9600, Alien ALR-9900 · Frecuencia 860–960 MHz</p>
      </div>
      <div className="flex gap-2 pt-2">
        <button type="button" className="btn-ghost flex-1" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn-primary flex-1" disabled={loading}>
          {loading ? <Spinner size={14} /> : 'Registrar Lectora'}
        </button>
      </div>
    </form>
  );
}
