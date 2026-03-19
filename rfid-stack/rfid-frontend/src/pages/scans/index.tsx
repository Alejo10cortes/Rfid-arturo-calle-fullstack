// src/pages/scans/index.tsx
import { useState } from 'react';
import { Layout, Topbar } from '../../components/layout';
import { RSSIBadge, EmptyState, Pagination, Skeleton } from '../../components/ui';
import { useApi, useDebounce } from '../../hooks/useApi';
import { scansApi, readersApi } from '../../api/client';
import { ScanEvent, Reader } from '../../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRealtimeStore } from '../../store';
import clsx from 'clsx';

function Svg({ d, size=16 }:{d:string;size?:number}){return<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>}
const ScanIco   = ({size=16})=><Svg size={size} d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"/>;
const LiveIco   = ({size=16})=><Svg size={size} d="M1 6l5.5 5.5L12 6l5.5 5.5L23 6"/>;

export default function Scans() {
  const [page,   setPage]   = useState(1);
  const [hours,  setHours]  = useState('1');
  const [zone,   setZone]   = useState('');
  const [epc,    setEpc]    = useState('');
  const [mode,   setMode]   = useState<'history' | 'live'>('live');
  const dEpc = useDebounce(epc, 400);

  const { liveTagFeed, connected } = useRealtimeStore();
  const { data: readers } = useApi<Reader[]>(readersApi.list);
  const { data, loading } = useApi<{ data: ScanEvent[]; meta: any }>(
    () => scansApi.list({ page, limit: 50, hours, zone: zone || undefined, epc: dEpc || undefined }),
    { immediate: mode === 'history' }
  );

  const zones = [...new Set(readers?.map(r => r.zone) || [])];

  return (
    <Layout>
      <Topbar title="Escaneos RFID" subtitle="Historial y feed en vivo de lecturas"
        actions={
          <div className="flex gap-1 bg-ink-3 rounded-lg p-1 border border-white/8">
            <button onClick={()=>setMode('live')} className={clsx('px-3 py-1.5 rounded font-mono text-[9px] uppercase tracking-wider transition-all', mode==='live'?'bg-gold text-ink':'text-muted-2 hover:text-cream')}>
              <span className="flex items-center gap-1.5"><span className={clsx('w-1.5 h-1.5 rounded-full', connected?'bg-ok animate-pulse-slow':'bg-muted-2')} />Live</span>
            </button>
            <button onClick={()=>setMode('history')} className={clsx('px-3 py-1.5 rounded font-mono text-[9px] uppercase tracking-wider transition-all', mode==='history'?'bg-gold text-ink':'text-muted-2 hover:text-cream')}>
              Historial
            </button>
          </div>
        }
      />
      <div className="flex-1 p-8 page-enter">
        {/* Filters (history only) */}
        {mode === 'history' && (
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <input className="input max-w-xs" placeholder="Buscar EPC…" value={epc} onChange={e=>setEpc(e.target.value)} />
            <select className="input w-36" value={zone} onChange={e=>setZone(e.target.value)}>
              <option value="">Todas las zonas</option>
              {zones.map(z=><option key={z}>{z}</option>)}
            </select>
            <select className="input w-36" value={hours} onChange={e=>setHours(e.target.value)}>
              {[['1','Última hora'],['6','Últimas 6h'],['24','Últimas 24h'],['72','Últimas 72h']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        )}

        {/* Live feed */}
        {mode === 'live' && (
          <div className="card">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className={clsx('w-2 h-2 rounded-full', connected ? 'bg-ok animate-pulse-slow' : 'bg-muted-2')} />
                <span className="font-mono text-[10px] text-cream uppercase tracking-wider">{connected ? 'Recibiendo en tiempo real' : 'Desconectado'}</span>
              </div>
              <span className="label-mono">{liveTagFeed.length} eventos</span>
            </div>
            <div className="overflow-auto max-h-[calc(100vh-280px)]">
              {liveTagFeed.length === 0 ? (
                <EmptyState icon={<LiveIco size={22}/>} title="Esperando lecturas" message="Los tags detectados aparecerán aquí en tiempo real." />
              ) : (
                <table className="w-full">
                  <thead className="sticky top-0 bg-ink-2/95 backdrop-blur">
                    <tr>{['EPC','Producto','Zona','Antena','Señal','Tags/s','Timestamp'].map(h=><th key={h} className="tbl-head px-6 py-3">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {liveTagFeed.map((t,i)=>(
                      <tr key={i} className="tbl-row animate-slide-in">
                        <td className="tbl-cell px-6 text-cream font-medium">{t.epc}</td>
                        <td className="tbl-cell px-6">{t.productName || t.sku || '—'}</td>
                        <td className="tbl-cell px-6"><span className="px-2 py-0.5 bg-ink-4 border border-white/5 rounded text-[9px] uppercase">{t.zone}</span></td>
                        <td className="tbl-cell px-6">A{t.antennaId}</td>
                        <td className="tbl-cell px-6"><RSSIBadge rssi={t.rssi}/></td>
                        <td className="tbl-cell px-6 text-gold">{t.tps}</td>
                        <td className="tbl-cell px-6 text-muted">{format(new Date(t.timestamp),'HH:mm:ss.SSS')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* History table */}
        {mode === 'history' && (
          <>
            {loading ? (
              <div className="space-y-2">{Array.from({length:10}).map((_,i)=><Skeleton key={i} className="h-12"/>)}</div>
            ) : (
              <div className="card">
                <table className="w-full">
                  <thead><tr className="border-b border-white/5">
                    {['EPC','Producto','Lectora','Zona','Antena','Señal','Frecuencia','Timestamp'].map(h=><th key={h} className="tbl-head px-6 py-4">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {(data?.data||[]).map((s,i)=>(
                      <tr key={i} className="tbl-row">
                        <td className="tbl-cell px-6 text-cream">{s.epc.slice(0,14)}…</td>
                        <td className="tbl-cell px-6">{s.tag?.product?.sku||'—'}</td>
                        <td className="tbl-cell px-6">{s.reader?.name||s.readerId.slice(0,8)}</td>
                        <td className="tbl-cell px-6"><span className="px-2 py-0.5 bg-ink-4 border border-white/5 rounded text-[9px] uppercase">{s.zone}</span></td>
                        <td className="tbl-cell px-6">A{s.antennaId}</td>
                        <td className="tbl-cell px-6"><RSSIBadge rssi={s.rssi}/></td>
                        <td className="tbl-cell px-6">{s.frequency ? `${s.frequency} kHz` : '—'}</td>
                        <td className="tbl-cell px-6">{format(new Date(s.createdAt),'dd/MM HH:mm:ss',{locale:es})}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(data?.data||[]).length===0 && <EmptyState icon={<ScanIco size={22}/>} title="Sin escaneos" message="No hay lecturas en el período seleccionado." />}
              </div>
            )}
            <Pagination page={page} totalPages={data?.meta?.totalPages||1} onChange={setPage} />
          </>
        )}
      </div>
    </Layout>
  );
}
