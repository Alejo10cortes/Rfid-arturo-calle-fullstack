// src/pages/alerts/index.tsx
import { useState } from 'react';
import { Layout, Topbar } from '../../components/layout';
import { SeverityBadge, EmptyState, Pagination, Spinner } from '../../components/ui';
import { useApi } from '../../hooks/useApi';
import { alertsApi } from '../../api/client';
import { Alert } from '../../types';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';
import clsx from 'clsx';

function Svg({ d, size=16 }:{d:string;size?:number}){return<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>}
const BellIco   = ({size=16})=><Svg size={size} d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>;
const CheckIco  = ({size=16})=><Svg size={size} d="M20 6L9 17l-5-5"/>;

type Filter = 'ALL' | 'UNRESOLVED' | 'CRITICAL' | 'WARNING';

export default function Alerts() {
  const [page,     setPage]     = useState(1);
  const [filter,   setFilter]   = useState<Filter>('UNRESOLVED');
  const [resolving,setResolving]= useState<string | null>(null);

  const { data, loading, execute: reload } = useApi<{ items: Alert[]; total: number; totalPages: number }>(
    () => alertsApi.list({ page, limit: 20, unresolved: filter === 'UNRESOLVED' }),
  );

  const items = (data?.items || []).filter(a => {
    if (filter === 'CRITICAL') return a.severity === 'CRITICAL' || a.severity === 'ERROR';
    if (filter === 'WARNING')  return a.severity === 'WARNING' || a.severity === 'INFO';
    return true;
  });

  const handleResolve = async (id: string) => {
    try {
      setResolving(id);
      await alertsApi.resolve(id);
      toast.success('Alerta resuelta');
      reload();
    } catch { toast.error('Error al resolver'); }
    finally { setResolving(null); }
  };

  const handleReadAll = async () => {
    try {
      await alertsApi.readAll();
      toast.success('Todas marcadas como leídas');
      reload();
    } catch {}
  };

  const severityIcon = (s: string) => {
    if (s === 'CRITICAL' || s === 'ERROR') return '🔴';
    if (s === 'WARNING') return '🟡';
    return '🔵';
  };

  return (
    <Layout>
      <Topbar title="Alertas" subtitle={`${data?.total || 0} alertas registradas`}
        actions={
          <button className="btn-secondary" onClick={handleReadAll}>
            <CheckIco size={14}/> Marcar todas leídas
          </button>
        }
      />

      <div className="flex-1 p-8 page-enter">
        {/* Filters */}
        <div className="flex gap-1.5 mb-6">
          {(['ALL','UNRESOLVED','CRITICAL','WARNING'] as Filter[]).map(f=>(
            <button key={f} onClick={()=>{setFilter(f);setPage(1);}}
              className={clsx('px-3 py-1.5 rounded-lg font-mono text-[9px] uppercase tracking-wider border transition-all',
                filter===f?'bg-gold text-ink border-gold':'bg-ink-3 text-muted-2 border-white/8 hover:border-white/15')}>
              {f==='ALL'?'Todas':f==='UNRESOLVED'?'Sin resolver':f==='CRITICAL'?'Críticas':'Warnings'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Spinner size={28}/></div>
        ) : items.length === 0 ? (
          <EmptyState icon={<BellIco size={22}/>} title="Sin alertas" message="No hay alertas con los filtros actuales. ¡Todo funciona correctamente!" />
        ) : (
          <div className="space-y-2">
            {items.map(alert => (
              <div key={alert.id}
                className={clsx('card p-5 border-l-2 transition-all',
                  alert.isResolved   ? 'opacity-50 border-l-muted/20' :
                  alert.severity === 'CRITICAL' ? 'border-l-red-500/80 bg-danger/[0.03]' :
                  alert.severity === 'ERROR'    ? 'border-l-red-400/60' :
                  alert.severity === 'WARNING'  ? 'border-l-warn/60' :
                  'border-l-white/10'
                )}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="text-lg mt-0.5">{severityIcon(alert.severity)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-ui font-semibold text-cream text-sm">{alert.title}</span>
                        <SeverityBadge severity={alert.severity} />
                        {alert.isResolved && <span className="chip-online">✓ Resuelta</span>}
                        {!alert.isRead && !alert.isResolved && <span className="w-2 h-2 rounded-full bg-gold animate-pulse-slow" />}
                      </div>
                      <p className="font-mono text-[10px] text-muted-2 leading-relaxed mb-2">{alert.message}</p>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="label-mono">{alert.type.replace(/_/g,' ')}</span>
                        {alert.zone && <span className="label-mono">· {alert.zone}</span>}
                        {alert.reader && <span className="label-mono">· {alert.reader.name}</span>}
                        <span className="label-mono">· {formatDistanceToNow(new Date(alert.createdAt), { locale: es, addSuffix: true })}</span>
                      </div>
                    </div>
                  </div>
                  {!alert.isResolved && (
                    <button className="btn-secondary shrink-0 py-1.5 text-[10px]"
                      disabled={resolving === alert.id}
                      onClick={() => handleResolve(alert.id)}>
                      {resolving === alert.id ? <Spinner size={12}/> : <><CheckIco size={12}/> Resolver</>}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <Pagination page={page} totalPages={data?.totalPages||1} onChange={setPage} />
      </div>
    </Layout>
  );
}
