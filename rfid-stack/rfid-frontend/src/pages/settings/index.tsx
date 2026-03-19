// src/pages/settings/index.tsx
import { useState } from 'react';
import { Layout, Topbar } from '../../components/layout';
import { Spinner } from '../../components/ui';
import { useAuthStore } from '../../store';
import { authApi, healthApi } from '../../api/client';
import { useApi } from '../../hooks/useApi';
import toast from 'react-hot-toast';
import clsx from 'clsx';

function Svg({ d, size=16 }:{d:string;size?:number}){return<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>}
const KeyIco    = ({size=16})=><Svg size={size} d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>;
const ServerIco = ({size=16})=><Svg size={size} d="M2 13h20M2 7h20M2 19h20M6 7v12M6 7a2 2 0 00-4 0v12a2 2 0 004 0"/>;
const UserIco   = ({size=16})=><Svg size={size} d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"/>;

export default function Settings() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<'profile' | 'security' | 'system'>('profile');

  return (
    <Layout>
      <Topbar title="Configuración" subtitle="Ajustes del sistema RFID" />
      <div className="flex-1 p-8 page-enter max-w-3xl">
        {/* Tab switcher */}
        <div className="flex gap-1 bg-ink-3 rounded-xl p-1 border border-white/8 mb-8 w-fit">
          {([['profile','Perfil',<UserIco key="u" size={13}/>],['security','Seguridad',<KeyIco key="k" size={13}/>],['system','Sistema',<ServerIco key="s" size={13}/>]] as any[]).map(([id,label,icon])=>(
            <button key={id} onClick={()=>setTab(id)}
              className={clsx('flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-[9px] uppercase tracking-wider transition-all',
                tab===id?'bg-gold text-ink':'text-muted-2 hover:text-cream')}>
              {icon}{label}
            </button>
          ))}
        </div>

        {tab === 'profile'  && <ProfileTab user={user} />}
        {tab === 'security' && <SecurityTab />}
        {tab === 'system'   && <SystemTab />}
      </div>
    </Layout>
  );
}

function ProfileTab({ user }: { user: any }) {
  return (
    <div className="space-y-4">
      <div className="card p-6">
        <div className="flex items-center gap-5 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gold/10 border border-gold/30 flex items-center justify-center font-display text-3xl text-gold">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div>
            <div className="font-display text-2xl text-cream">{user?.name}</div>
            <div className="font-mono text-[10px] text-muted-2 mt-0.5">{user?.email}</div>
            <div className="mt-2">
              <span className="px-2.5 py-1 bg-gold/10 border border-gold/20 rounded-full font-mono text-[9px] text-gold uppercase tracking-wider">
                {user?.role}
              </span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/5">
          {[['ID', user?.id?.slice(0,8)+'…'],['Rol', user?.role],['Último acceso', user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('es-CO') : '—'],['Estado','Activo']].map(([l,v])=>(
            <div key={l} className="bg-ink-3 rounded-lg p-3">
              <div className="label-mono mb-1">{l}</div>
              <div className="font-mono text-[11px] text-cream">{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SecurityTab() {
  const [form, setForm] = useState({ currentPassword:'', newPassword:'', confirmPassword:'' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      toast.error('Las contraseñas no coinciden'); return;
    }
    if (form.newPassword.length < 8) {
      toast.error('Mínimo 8 caracteres'); return;
    }
    try {
      setLoading(true);
      await authApi.changePassword(form.currentPassword, form.newPassword);
      toast.success('Contraseña actualizada. Tu sesión ha sido cerrada en otros dispositivos.');
      setForm({ currentPassword:'', newPassword:'', confirmPassword:'' });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al cambiar contraseña');
    } finally { setLoading(false); }
  };

  const up = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="card p-6 max-w-md">
      <h3 className="font-display text-xl text-cream mb-1">Cambiar Contraseña</h3>
      <p className="label-mono mb-6">Al cambiar tu contraseña, cerrarás sesión en todos los demás dispositivos.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div><label className="label-mono block mb-2">Contraseña actual</label>
          <input type="password" className="input" value={form.currentPassword} onChange={e=>up('currentPassword',e.target.value)} required /></div>
        <div><label className="label-mono block mb-2">Nueva contraseña</label>
          <input type="password" className="input" value={form.newPassword} onChange={e=>up('newPassword',e.target.value)} minLength={8} required /></div>
        <div><label className="label-mono block mb-2">Confirmar nueva contraseña</label>
          <input type="password" className="input" value={form.confirmPassword} onChange={e=>up('confirmPassword',e.target.value)} required /></div>
        <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
          {loading ? <Spinner size={14}/> : 'Actualizar contraseña'}
        </button>
      </form>
    </div>
  );
}

function SystemTab() {
  const { data, loading, execute: reload } = useApi(() => healthApi.check());
  const health = (data as any)?.data || data;

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl text-cream">Estado del Sistema</h3>
          <button className="btn-ghost text-[10px]" onClick={()=>reload()}>Actualizar</button>
        </div>
        {loading ? <div className="flex justify-center py-6"><Spinner/></div> : (
          <div className="grid grid-cols-2 gap-3">
            {[
              ['Estado',   health?.status === 'healthy' ? '✅ Saludable' : '❌ Error'],
              ['Base de datos', health?.db || '—'],
              ['WebSocket', health?.ws || '—'],
              ['Uptime',   health?.uptime ? `${Math.floor(health.uptime / 3600)}h ${Math.floor((health.uptime % 3600)/60)}m` : '—'],
              ['Versión',  health?.version || '1.0.0'],
              ['Memoria',  health?.memory ? `${Math.round(health.memory/1024/1024)} MB` : '—'],
            ].map(([l,v])=>(
              <div key={l} className="bg-ink-3 rounded-lg p-3">
                <div className="label-mono mb-1">{l}</div>
                <div className="font-mono text-[11px] text-cream">{v}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="card p-5">
        <h4 className="font-display text-lg text-cream mb-3">Protocolo RFID</h4>
        <div className="space-y-2">
          {[['Protocolo','LLRP sobre TCP/IP (ISO 15961)'],['Frecuencia','860–960 MHz (UHF)'],['Estándar de tags','EPC Class 1 Gen 2 (ISO 18000-63)'],['Puerto LLRP','5084 (estándar)'],['Lectoras compatibles','Impinj R700, Zebra FX9600, Alien ALR-9900']].map(([l,v])=>(
            <div key={l} className="flex justify-between items-center py-2 border-b border-white/[0.04] last:border-0">
              <span className="label-mono">{l}</span>
              <span className="font-mono text-[10px] text-muted-3">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
