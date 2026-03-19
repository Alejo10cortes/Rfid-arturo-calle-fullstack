// src/pages/reports/index.tsx
import { useState } from 'react';
import { Layout, Topbar } from '../../components/layout';
import { SectionHeader, Spinner } from '../../components/ui';
import { reportsApi } from '../../api/client';
import { useDownload } from '../../hooks/useApi';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import clsx from 'clsx';

function Svg({ d, size=16 }:{d:string;size?:number}){return<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>}
const DownloadIco  = ({size=16})=><Svg size={size} d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>;
const FileCSVIco   = ({size=16})=><Svg size={size} d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 2v6h6"/>;
const FilePDFIco   = ({size=16})=><Svg size={size} d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 2v6h6M9 13h6M9 17h3"/>;
const ScanIco      = ({size=16})=><Svg size={size} d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M12 8v8M8 12h8"/>;
const PkgIco       = ({size=16})=><Svg size={size} d="M12 2l9 4.9V17l-9 5-9-5V7L12 2z"/>;

interface ReportConfig {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  formats: ('csv' | 'pdf')[];
  hasDateRange: boolean;
  hasZone: boolean;
}

const reports: ReportConfig[] = [
  {
    id: 'scans',
    title: 'Reporte de Escaneos',
    description: 'Histórico completo de lecturas RFID con EPC, lectora, zona, RSSI y frecuencia. Útil para auditorías y análisis de cobertura de antenas.',
    icon: <ScanIco size={20}/>,
    formats: ['csv', 'pdf'],
    hasDateRange: true,
    hasZone: true,
  },
  {
    id: 'inventory',
    title: 'Reporte de Inventario',
    description: 'Estado actual del inventario por producto: SKU, nombre, categoría, stock activo (tags RFID), zonas y RSSI promedio.',
    icon: <PkgIco size={20}/>,
    formats: ['csv', 'pdf'],
    hasDateRange: false,
    hasZone: false,
  },
];

export default function Reports() {
  const { download } = useDownload();
  const [loading, setLoading] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: format(new Date(Date.now() - 86400000), 'yyyy-MM-dd'),
    endDate:   format(new Date(), 'yyyy-MM-dd'),
  });
  const [zone, setZone] = useState('');

  const handleDownload = async (reportId: string, fmt: 'csv' | 'pdf') => {
    const key = `${reportId}-${fmt}`;
    try {
      setLoading(key);
      const ext  = fmt === 'pdf' ? 'pdf' : 'csv';
      const name = `ac_${reportId}_${format(new Date(), 'yyyyMMdd_HHmm')}.${ext}`;

      if (reportId === 'scans') {
        await download(() => reportsApi.scans({
          format: fmt,
          startDate: new Date(dateRange.startDate).toISOString(),
          endDate:   new Date(dateRange.endDate + 'T23:59:59').toISOString(),
          zone: zone || undefined,
        }), name);
      } else {
        await download(() => reportsApi.inventory({ format: fmt }), name);
      }
      toast.success(`${name} descargado`);
    } catch {
      toast.error('Error al generar el reporte');
    } finally {
      setLoading(null);
    }
  };

  return (
    <Layout>
      <Topbar title="Reportes" subtitle="Exportar datos en CSV y PDF" />

      <div className="flex-1 p-8 page-enter">
        {/* Date range filter */}
        <div className="card p-5 mb-6">
          <SectionHeader title="Filtros Globales" sub="Aplican a reportes con rango de fechas" />
          <div className="flex gap-4 items-end">
            <div>
              <label className="label-mono block mb-2">Desde</label>
              <input type="date" className="input" value={dateRange.startDate}
                onChange={e => setDateRange(p => ({ ...p, startDate: e.target.value }))} />
            </div>
            <div>
              <label className="label-mono block mb-2">Hasta</label>
              <input type="date" className="input" value={dateRange.endDate}
                onChange={e => setDateRange(p => ({ ...p, endDate: e.target.value }))} />
            </div>
            <div>
              <label className="label-mono block mb-2">Zona</label>
              <select className="input" value={zone} onChange={e => setZone(e.target.value)}>
                <option value="">Todas</option>
                {['Zone A','Zone B','Zone C','Zone D'].map(z => <option key={z}>{z}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Report cards */}
        <div className="grid grid-cols-2 gap-6">
          {reports.map(report => (
            <div key={report.id} className="card p-6 card-hover">
              <div className="flex items-start gap-4 mb-5">
                <div className="w-11 h-11 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold shrink-0">
                  {report.icon}
                </div>
                <div>
                  <h3 className="font-display text-lg text-cream mb-1">{report.title}</h3>
                  <p className="font-mono text-[10px] text-muted-2 leading-relaxed">{report.description}</p>
                </div>
              </div>

              <div className="pt-5 border-t border-white/5">
                <div className="label-mono mb-3">Formato de exportación</div>
                <div className="grid grid-cols-2 gap-3">
                  {report.formats.map(fmt => {
                    const key = `${report.id}-${fmt}`;
                    const isLoading = loading === key;
                    return (
                      <button key={fmt}
                        disabled={!!loading}
                        onClick={() => handleDownload(report.id, fmt)}
                        className={clsx(
                          'flex items-center gap-3 p-4 rounded-xl border transition-all group',
                          fmt === 'csv'
                            ? 'bg-ok/5 border-ok/20 hover:border-ok/40 hover:bg-ok/10'
                            : 'bg-danger/5 border-red-400/20 hover:border-red-400/40 hover:bg-danger/10',
                          !!loading && 'opacity-50 cursor-not-allowed'
                        )}>
                        <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center',
                          fmt === 'csv' ? 'text-ok' : 'text-red-400')}>
                          {isLoading ? <Spinner size={18}/> : fmt === 'csv' ? <FileCSVIco size={18}/> : <FilePDFIco size={18}/>}
                        </div>
                        <div className="text-left">
                          <div className={clsx('font-mono text-[10px] font-semibold uppercase tracking-wider',
                            fmt === 'csv' ? 'text-ok' : 'text-red-400')}>
                            {fmt.toUpperCase()}
                          </div>
                          <div className="font-mono text-[9px] text-muted-2">
                            {isLoading ? 'Generando…' : fmt === 'csv' ? 'Excel / Google Sheets' : 'Adobe Acrobat'}
                          </div>
                        </div>
                        {!isLoading && (
                          <DownloadIco size={14} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Info footer */}
        <div className="mt-6 card p-5 flex items-start gap-4">
          <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center text-gold shrink-0 mt-0.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          </div>
          <div>
            <div className="font-ui font-semibold text-cream text-sm mb-1">Sobre los reportes</div>
            <p className="font-mono text-[10px] text-muted-2 leading-relaxed">
              Los reportes CSV incluyen hasta 10,000 registros. Los PDF muestran hasta 500 filas con formato imprimible.
              Para exportaciones masivas, se recomienda el formato CSV. Los archivos se generan en el servidor y se descargan directamente.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
