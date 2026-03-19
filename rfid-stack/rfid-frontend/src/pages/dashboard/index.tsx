// src/pages/dashboard/index.tsx
import { useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Layout, Topbar } from '../../components/layout';
import { KPICard, StatusChip, RSSIBadge, SectionHeader, Spinner, EmptyState } from '../../components/ui';
import { useRealtimeStore } from '../../store';
import { useApi } from '../../hooks/useApi';
import { productsApi, scansApi, readersApi } from '../../api/client';
import { InventoryOverview, ScanStats, Reader } from '../../types';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import clsx from 'clsx';

// Icons
const Pkg  = () => <Svg d="M12 2l9 4.9V17l-9 5-9-5V7L12 2z" />;
const Alert= () => <Svg d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />;
const Radio= () => <Svg d="M12 1a3 3 0 100 6 3 3 0 000-6zM1 15a15 15 0 0122 0M5 11.5a9 9 0 0114 0" />;
const Scan = () => <Svg d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" />;
function Svg({ d }: { d: string }) {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-ink-3 border border-white/10 rounded-lg px-3 py-2 font-mono text-[10px]">
      <div className="text-muted-2 mb-1">Hora {label}:00</div>
      <div className="text-gold">{Number(payload[0]?.value || 0).toLocaleString()} lecturas</div>
    </div>
  );
};

export default function Dashboard() {
  const { liveTagFeed, totalScansToday, readerStatuses } = useRealtimeStore();

  const { data: overview, loading: ovLoad } = useApi<InventoryOverview>(productsApi.overview);
  const { data: scanStats, loading: ssLoad } = useApi<ScanStats>(() => scansApi.stats({ hours: 24 }));
  const { data: readers } = useApi<Reader[]>(readersApi.list);

  const onlineReaders = readers?.filter(r => r.status === 'ONLINE').length ?? 0;
  const totalReaders  = readers?.length ?? 0;

  // Build 24h chart data
  const chartData = Array.from({ length: 24 }, (_, h) => {
    const found = scanStats?.byHour?.find((b: any) => new Date(b.hour).getHours() === h);
    return { hour: h, count: found ? Number(found.count) : 0 };
  });
  const maxCount = Math.max(...chartData.map(d => d.count), 1);

  // Heatmap zones
  const heatmap = ['A','B','C','D','E','F','G','H','I'].map(zone => {
    const found = overview?.byZone?.find(z => z.currentZone === `Zone ${zone}`);
    const count = found?._count?.currentZone ?? 0;
    return { zone, count };
  });
  const maxHeat = Math.max(...heatmap.map(h => h.count), 1);

  return (
    <Layout>
      <Topbar title="Dashboard" subtitle="Monitoreo de inventario en tiempo real" />

      <div className="flex-1 p-8 space-y-6 page-enter">
        {/* KPI Row */}
        <div className="grid grid-cols-4 gap-4">
          <KPICard label="Items Totales"    value={overview?.activeTags?.toLocaleString() ?? '—'} icon={<Pkg />}   variant="gold"   trend="+2.4%" trendUp loading={ovLoad} />
          <KPICard label="Lectoras Online"  value={`${onlineReaders}/${totalReaders}`}              icon={<Radio />}  variant="ok"     loading={ovLoad} />
          <KPICard label="Scans (24h)"      value={scanStats?.total?.toLocaleString() ?? '—'}      icon={<Scan />}  variant="default" trend="+15%" trendUp loading={ssLoad} />
          <KPICard label="Alertas Activas"  value={liveTagFeed.length > 0 ? liveTagFeed.length : '0'} icon={<Alert />} variant="danger" loading={false} />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-3 gap-4">
          {/* Bar chart */}
          <div className="col-span-2 card p-6">
            <SectionHeader title="Lecturas por Hora" sub="Últimas 24 horas" />
            {ssLoad ? (
              <div className="h-40 flex items-center justify-center"><Spinner /></div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={chartData} barCategoryGap="30%">
                  <XAxis dataKey="hour" tickFormatter={h => `${h}h`} tick={{ fill:'#52525f', fontSize:9, fontFamily:'JetBrains Mono' }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip content={<CustomTooltip />} cursor={false} />
                  <Bar dataKey="count" radius={[3,3,0,0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.count === maxCount ? '#c9a84c' : entry.count > maxCount * 0.6 ? 'rgba(201,168,76,0.5)' : 'rgba(201,168,76,0.2)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Heatmap */}
          <div className="card p-6">
            <SectionHeader title="Mapa de Calor" sub="Actividad por zona" />
            <div className="grid grid-cols-3 gap-1.5 mb-3">
              {heatmap.map(({ zone, count }) => {
                const alpha = count > 0 ? 0.1 + (count / maxHeat) * 0.75 : 0.05;
                return (
                  <div key={zone} className="aspect-square rounded-lg flex items-center justify-center font-mono text-[10px] font-medium cursor-pointer hover:scale-105 transition-transform"
                    style={{ background: `rgba(201,168,76,${alpha})`, color: alpha > 0.5 ? '#0c0c0e' : '#c9a84c' }}
                    title={`Zone ${zone}: ${count} tags`}>
                    {zone}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <span className="label-mono">Bajo</span>
              <div className="flex-1 h-1 rounded-full bg-gradient-to-r from-ink-4 to-gold" />
              <span className="label-mono">Alto</span>
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-3 gap-4">
          {/* Live feed */}
          <div className="col-span-2 card p-6">
            <SectionHeader title="Feed en Vivo"
              sub={`${liveTagFeed.length} eventos recientes`}
              actions={
                <div className="flex items-center gap-1.5 font-mono text-[9px] text-ok uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-ok animate-pulse-slow" />
                  Tiempo real
                </div>
              }
            />
            <div className="overflow-auto max-h-64">
              {liveTagFeed.length === 0 ? (
                <EmptyState title="Esperando lecturas" message="Los tags detectados aparecerán aquí en tiempo real" />
              ) : (
                <table className="w-full">
                  <thead>
                    <tr>
                      {['EPC','SKU','Zona','Lectora','Señal','Hora'].map(h => (
                        <th key={h} className="tbl-head pr-4">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {liveTagFeed.slice(0, 20).map((tag, i) => (
                      <tr key={i} className="tbl-row animate-slide-in">
                        <td className="tbl-cell font-medium text-cream">{tag.epc.slice(0,12)}…</td>
                        <td className="tbl-cell">{tag.sku || '—'}</td>
                        <td className="tbl-cell">
                          <span className="px-2 py-0.5 bg-ink-4 border border-white/5 rounded text-[9px] uppercase">{tag.zone}</span>
                        </td>
                        <td className="tbl-cell">{tag.readerId.slice(0,8)}</td>
                        <td className="tbl-cell"><RSSIBadge rssi={tag.rssi} /></td>
                        <td className="tbl-cell">{formatDistanceToNow(new Date(tag.timestamp), { locale: es, addSuffix: true })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Reader statuses */}
          <div className="card p-6">
            <SectionHeader title="Estado Lectoras" />
            <div className="space-y-2">
              {readers?.slice(0, 6).map(r => {
                const live = readerStatuses[r.id];
                const status = live?.status ?? r.status;
                return (
                  <div key={r.id} className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0">
                    <div>
                      <div className="font-mono text-[11px] text-cream">{r.name}</div>
                      <div className="label-mono mt-0.5">{r.zone}</div>
                    </div>
                    <div className="text-right">
                      <StatusChip status={status} />
                      {r.tps > 0 && <div className="font-mono text-[9px] text-muted-2 mt-1">{r.tps} tags/s</div>}
                    </div>
                  </div>
                );
              })}
              {(!readers || readers.length === 0) && <Spinner />}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
