// src/components/layout/Sidebar.tsx
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore, useRealtimeStore } from '../../store';
import { authApi } from '../../api/client';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const navItems = [
  { to: '/',          icon: HomeIcon,      label: 'Dashboard' },
  { to: '/readers',   icon: RadioIcon,     label: 'Lectoras' },
  { to: '/inventory', icon: PackageIcon,   label: 'Inventario' },
  { to: '/scans',     icon: ScanIcon,      label: 'Escaneos' },
  { to: '/alerts',    icon: BellIcon,      label: 'Alertas' },
  { to: '/reports',   icon: ChartIcon,     label: 'Reportes' },
];

const bottomItems = [
  { to: '/settings',  icon: SettingsIcon,  label: 'Ajustes' },
];

export function Sidebar() {
  const { user, clearAuth, refreshToken } = useAuthStore() as any;
  const { connected, liveAlerts } = useRealtimeStore();
  const navigate = useNavigate();

  const unreadAlerts = liveAlerts.filter((a: any) => a.severity === 'CRITICAL' || a.severity === 'ERROR').length;

  const handleLogout = async () => {
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {}
    clearAuth();
    navigate('/login');
    toast.success('Sesión cerrada');
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-[220px] bg-ink-2 border-r border-white/5 flex flex-col z-40">
      {/* Logo */}
      <div className="px-6 py-7 border-b border-white/5">
        <div className="font-display text-[22px] text-cream leading-none tracking-wide">Arturo Calle</div>
        <div className="font-mono text-[9px] text-gold mt-1.5 tracking-[0.2em] uppercase">RFID Control Center</div>
      </div>

      {/* WS Status */}
      <div className="px-6 py-3 border-b border-white/[0.04]">
        <div className="flex items-center gap-2">
          <div className={clsx('w-1.5 h-1.5 rounded-full', connected ? 'bg-ok animate-pulse-slow' : 'bg-muted-2')} />
          <span className="font-mono text-[9px] text-muted-2 uppercase tracking-wider">
            {connected ? 'Tiempo real activo' : 'Desconectado'}
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => clsx(
            'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-ui font-medium uppercase tracking-[0.06em] transition-all duration-150 relative',
            isActive ? 'bg-gold/[0.12] text-gold border border-gold/20' : 'text-muted-2 hover:text-cream hover:bg-ink-3',
          )}>
            <Icon size={15} />
            {label}
            {label === 'Alertas' && unreadAlerts > 0 && (
              <span className="ml-auto w-4 h-4 rounded-full bg-danger text-[9px] font-mono flex items-center justify-center text-white">
                {unreadAlerts}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-4 border-t border-white/5 pt-4 space-y-0.5">
        {bottomItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} className={({ isActive }) => clsx(
            'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-ui font-medium uppercase tracking-[0.06em] transition-all duration-150',
            isActive ? 'bg-gold/[0.12] text-gold border border-gold/20' : 'text-muted-2 hover:text-cream hover:bg-ink-3',
          )}>
            <Icon size={15} />
            {label}
          </NavLink>
        ))}
        <button onClick={handleLogout} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-ui font-medium uppercase tracking-[0.06em] text-muted-2 hover:text-red-400 hover:bg-danger/10 transition-all duration-150">
          <LogoutIcon size={15} />
          Salir
        </button>

        {/* User */}
        <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2.5 px-1">
          <div className="w-7 h-7 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center text-gold text-xs font-mono">
            {user?.name?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-ui text-cream truncate">{user?.name}</div>
            <div className="font-mono text-[8px] text-muted-2 uppercase tracking-wider">{user?.role}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

// Topbar
interface TopbarProps { title: string; subtitle?: string; actions?: React.ReactNode; }
export function Topbar({ title, subtitle, actions }: TopbarProps) {
  const { connected } = useRealtimeStore();
  return (
    <header className="h-16 bg-ink-2/80 backdrop-blur border-b border-white/5 flex items-center justify-between px-8 sticky top-0 z-30">
      <div>
        <h1 className="font-display text-[22px] text-cream leading-none">{title}</h1>
        {subtitle && <p className="font-mono text-[9px] text-muted-2 uppercase tracking-[0.1em] mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {actions}
        <div className="flex items-center gap-2 pl-3 border-l border-white/8">
          <div className={clsx('w-1.5 h-1.5 rounded-full', connected ? 'bg-ok' : 'bg-muted-2')} />
          <span className="font-mono text-[9px] text-muted-2">{connected ? 'Live' : 'Offline'}</span>
        </div>
      </div>
    </header>
  );
}

// Layout wrapper
interface LayoutProps { children: React.ReactNode; }
export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex min-h-screen bg-ink">
      <Sidebar />
      <main className="ml-[220px] flex-1 flex flex-col min-h-screen">
        {children}
      </main>
    </div>
  );
}

// ── Inline icons ──────────────────────────────────────────────────────────────
function Ic({ d, size = 16 }: { d: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>;
}
const HomeIcon     = ({ size = 16 }) => <Ic size={size} d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />;
const RadioIcon    = ({ size = 16 }) => <Ic size={size} d="M12 1a3 3 0 100 6 3 3 0 000-6zM1 15a15 15 0 0122 0M5.5 11a9.5 9.5 0 0113 0" />;
const PackageIcon  = ({ size = 16 }) => <Ic size={size} d="M12 2l9 4.9V17l-9 5-9-5V7L12 2zM12 2v20M3 7l9 5 9-5" />;
const ScanIcon     = ({ size = 16 }) => <Ic size={size} d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M12 8v8M8 12h8" />;
const BellIcon     = ({ size = 16 }) => <Ic size={size} d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />;
const ChartIcon    = ({ size = 16 }) => <Ic size={size} d="M18 20V10M12 20V4M6 20v-6" />;
const SettingsIcon = ({ size = 16 }) => <Ic size={size} d="M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />;
const LogoutIcon   = ({ size = 16 }) => <Ic size={size} d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />;
