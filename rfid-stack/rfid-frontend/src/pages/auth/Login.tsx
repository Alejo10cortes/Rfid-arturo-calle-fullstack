// src/pages/auth/Login.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authApi } from '../../api/client';
import { useAuthStore } from '../../store';
import { Spinner } from '../../components/ui';

export default function Login() {
  const [email,    setEmail]    = useState('admin@arturocalle.com');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    try {
      setLoading(true);
      const res = await authApi.login(email, password);
      const { user, tokens } = res.data.data;
      setAuth(user, tokens);
      toast.success(`Bienvenido, ${user.name}`);
      navigate('/');
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Credenciales inválidas';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background radial */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-gold/[0.03] blur-3xl pointer-events-none" />
      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage:'linear-gradient(rgba(201,168,76,1) 1px,transparent 1px),linear-gradient(90deg,rgba(201,168,76,1) 1px,transparent 1px)', backgroundSize:'48px 48px' }} />

      <div className="relative w-full max-w-sm animate-fade-up">
        {/* Brand */}
        <div className="text-center mb-10">
          <div className="font-display text-4xl text-cream mb-1">Arturo Calle</div>
          <div className="font-mono text-[10px] text-gold uppercase tracking-[0.25em]">RFID Control Center</div>
        </div>

        {/* Card */}
        <div className="card p-8 border-white/8">
          <h2 className="font-display text-2xl text-cream mb-1">Iniciar Sesión</h2>
          <p className="label-mono mb-8">Ingresa tus credenciales para continuar</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label-mono block mb-2">Correo electrónico</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="input" placeholder="usuario@arturocalle.com" required autoFocus />
            </div>
            <div>
              <label className="label-mono block mb-2">Contraseña</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="input" placeholder="••••••••" required />
            </div>

            <button type="submit" disabled={loading}
              className="btn-primary w-full mt-6 py-3 justify-center">
              {loading ? <Spinner size={16} /> : 'Ingresar al sistema'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/5">
            <p className="label-mono text-center mb-3">Credenciales de prueba</p>
            <div className="space-y-2">
              {[
                { role: 'Admin', email: 'admin@arturocalle.com', pass: 'Admin@1234' },
                { role: 'Operator', email: 'operador@arturocalle.com', pass: 'Operator@1234' },
              ].map(c => (
                <button key={c.role} type="button" onClick={() => { setEmail(c.email); setPassword(c.pass); }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-ink-3 border border-white/5 hover:border-gold/20 transition-colors group">
                  <span className="font-mono text-[9px] text-muted-2 uppercase tracking-wider group-hover:text-gold">{c.role}</span>
                  <span className="font-mono text-[9px] text-muted">{c.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center font-mono text-[9px] text-muted mt-6 uppercase tracking-wider">
          Sistema RFID UHF 860–960 MHz · v1.0.0
        </p>
      </div>
    </div>
  );
}
