import React, { useState } from 'react';
import { Mail, Lock, User, ArrowRight, Loader2, CheckCircle2, ShieldCheck, Sparkles, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { MobileAuthScreen } from '../components/auth/MobileAuthScreen';

export const AuthPage: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const [isRegister, setIsRegister] = useState(() =>
    typeof window !== 'undefined' && window.location.pathname === '/register'
  );
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleAuth = async (asRegister: boolean) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Por favor completa todos los campos requeridos.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (asRegister && !fullName.trim()) {
      setErrorMsg('Por favor introduce tu nombre completo.');
      return;
    }

    if (asRegister && !termsAccepted) {
      setErrorMsg('Debes aceptar los Términos de Servicio y la Política de Privacidad para registrarte.');
      return;
    }

    try {
      setLoading(true);
      if (asRegister) {
        const { error } = await signUp(email.trim(), password, fullName.trim());
        if (error) throw error;
        setSuccessMsg('¡Cuenta creada con éxito! Revisa tu correo o inicia sesión para ingresar.');
      } else {
        const { error } = await signIn(email.trim(), password);
        if (error) throw error;
      }
    } catch (err: any) {
      console.error('Error de autenticación:', err);
      if (err.message?.includes('Invalid login credentials')) {
        setErrorMsg('Credenciales inválidas. Verifica tu correo y contraseña.');
      } else if (err.message?.includes('User already registered')) {
        setErrorMsg('Este correo ya está registrado en el sistema. Intenta iniciar sesión.');
      } else {
        setErrorMsg(err.message || 'Error al autenticar.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main id="main-content" className="w-full min-h-[100dvh]">
      {/* Vista Móvil: Splash cinético con fusión tipográfica e implosión/explosión al login */}
      <div className="block md:hidden w-full min-h-[100dvh]">
        <MobileAuthScreen />
      </div>

      {/* Vista Desktop: Split-Card Industrial Workbench */}
      <div className="hidden md:flex min-h-[100dvh] w-full bg-[#f4f6f8] flex-col items-center justify-center p-4 sm:p-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))] overflow-y-auto overscroll-y-contain selection:bg-slate-900 selection:text-slate-50 font-sans">
        {/* Split-Card Container con Altura Fija y Consistente en Ambos Modos */}
        <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-2xl shadow-[0_14px_34px_-10px_rgba(15,23,42,0.08),0_2px_6px_-1px_rgba(15,23,42,0.04)] overflow-hidden grid grid-cols-2 min-h-[600px] my-auto">
        
        {/* =========================================================
            PANEL IZQUIERDO: ARQUITECTURA DE SISTEMAS (SLATE-900)
            Visible en Desktop/Tablet (md:flex), móvil intacto
           ========================================================= */}
        <div className="hidden md:flex bg-slate-900 text-slate-50 p-8 sm:p-10 md:p-11 flex-col justify-between relative overflow-hidden h-full border-r border-slate-800">
          {/* Cuadrícula arquitectónica sutil sin ornamentos ni blur decorativo */}
          <div
            className="absolute inset-0 opacity-[0.06] pointer-events-none"
            style={{
              backgroundImage: 'linear-gradient(to right, #94a3b8 1px, transparent 1px), linear-gradient(to bottom, #94a3b8 1px, transparent 1px)',
              backgroundSize: '28px 28px'
            }}
          />

          {/* Superior: Logotipo y Sistema Stockly */}
          <div className="space-y-6 relative z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center overflow-hidden">
                  <img src="/logo.png" alt="Stockly" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                </div>
                <span className="font-mono text-xs uppercase tracking-[0.2em] text-slate-200 font-semibold">
                  STOCKLY
                </span>
              </div>
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                SYSTEM READY
              </span>
            </div>

            <div className="pt-6 sm:pt-10">
              <h1 className="text-3xl sm:text-[34px] font-semibold tracking-[-0.03em] text-white leading-[1.15]">
                Control de inventarios y punto de venta.
              </h1>
              <p className="text-sm text-slate-300 mt-4 leading-relaxed max-w-sm">
                Trazabilidad por códigos de barra o QR, control de ubicaciones por depósito y registro comercial en tiempo real.
              </p>
            </div>
          </div>

          {/* Inferior: Capacidades del Sistema */}
          <div className="pt-6 border-t border-slate-800 relative z-10 space-y-3">
            <div className="flex items-center gap-2.5 text-xs text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Multi-almacén con aislamiento por depósito</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-300">
              <Sparkles className="w-4 h-4 text-slate-300 flex-shrink-0" />
              <span>Operación offline con sincronización IndexedDB</span>
            </div>
          </div>
        </div>

        {/* =========================================================
            PANEL DERECHO: FORMULARIO SPLIT-CARD (BLANCO INDUSTRIAL)
            Altura exacta uniforme para Iniciar Sesión y Registro
           ========================================================= */}
        <div className="bg-white p-6 sm:p-8 md:p-11 flex flex-col min-h-[500px] h-full justify-between relative">
          
          {/* Identificador de marca visible en móvil (fallback) */}
          <div className="flex md:hidden items-center justify-center gap-2 mb-2 flex-shrink-0">
            <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 overflow-hidden flex items-center justify-center shadow-xs">
              <img src="/logo.png" alt="Stockly" className="w-full h-full object-cover" loading="lazy" decoding="async" />
            </div>
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-slate-900 font-bold">
              STOCKLY
            </span>
          </div>

          {/* Superior: Segmented Control Industrial */}
          <div className="relative p-1 bg-slate-100 border border-slate-200 rounded-xl mb-4 select-none overflow-hidden flex-shrink-0">
            <div
              className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg bg-slate-900 shadow-xs transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${
                isRegister ? 'translate-x-full left-1' : 'translate-x-0 left-1'
              }`}
            />
            <div className="relative grid grid-cols-2 z-10 text-xs font-medium">
              <button
                type="button"
                onClick={() => {
                  setIsRegister(false);
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`py-2 rounded-lg transition-colors duration-150 text-center cursor-pointer ${
                  !isRegister ? 'text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRegister(true);
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`py-2 rounded-lg transition-colors duration-150 text-center cursor-pointer ${
                  isRegister ? 'text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Registrarme
              </button>
            </div>
          </div>

          {/* Alertas Globales con altura mínima para evitar saltos */}
          <div className="min-h-[20px] mb-2 flex-shrink-0">
            {errorMsg && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
            )}
          </div>

          {/* Carrusel Deslizante de Vistas con Dimensiones Idénticas */}
          <div className="relative flex-1 overflow-hidden">
            <div
              className={`flex w-[200%] h-full transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${
                isRegister ? '-translate-x-1/2' : 'translate-x-0'
              }`}
            >
              {/* ==========================================
                  VISTA 1: INICIAR SESIÓN (CUADRO IDÉNTICO)
                 ========================================== */}
              <form
                onSubmit={e => {
                  e.preventDefault();
                  handleAuth(false);
                }}
                className={`w-1/2 h-full flex flex-col justify-between pr-3 transition-opacity duration-150 ${
                  !isRegister ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
                aria-hidden={isRegister}
              >
                {/* Encabezado */}
                <div className="flex-shrink-0">
                  <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight">
                    Bienvenido de nuevo
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Introduce tus credenciales para acceder a tus depósitos.
                  </p>
                </div>

                {/* Campos */}
                <div className="space-y-3.5 my-auto">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Correo electrónico
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="usuario@dominio.com"
                        required
                        tabIndex={!isRegister ? 0 : -1}
                        className="w-full min-h-[42px] bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-900 rounded-xl pl-10 pr-4 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-[background-color,border-color,box-shadow] duration-150"
                      />
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Contraseña
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        tabIndex={!isRegister ? 0 : -1}
                        className="w-full min-h-[42px] bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-900 rounded-xl pl-10 pr-4 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-[background-color,border-color,box-shadow] duration-150"
                      />
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    </div>
                  </div>

                  {/* Opciones */}
                  <div className="flex items-center justify-between pt-0.5">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <div
                        onClick={() => setRememberMe(!rememberMe)}
                        className={`w-4 h-4 rounded border transition-colors flex items-center justify-center ${
                          rememberMe ? 'bg-slate-900 border-slate-900 text-white' : 'border-slate-300 bg-white'
                        }`}
                      >
                        {rememberMe && <Check className="w-3 h-3 stroke-[2.5]" />}
                      </div>
                      <span className="text-xs text-slate-600">Recordar sesión</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => alert('Para restablecer tu contraseña, contacta a soporte o al administrador.')}
                      className="text-xs text-slate-700 hover:text-slate-900 hover:underline font-medium cursor-pointer"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                </div>

                {/* Botón Acción Iniciar Sesión */}
                <div className="flex-shrink-0 pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    tabIndex={!isRegister ? 0 : -1}
                    className="w-full min-h-[42px] py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-xl transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-slate-300" />
                        <span>Procesando...</span>
                      </>
                    ) : (
                      <>
                        <span>Entrar al sistema</span>
                        <ArrowRight className="w-4 h-4 text-slate-300" />
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* ==========================================
                  VISTA 2: REGISTRARME (CUADRO IDÉNTICO)
                 ========================================== */}
              <form
                onSubmit={e => {
                  e.preventDefault();
                  handleAuth(true);
                }}
                className={`w-1/2 h-full flex flex-col justify-between pl-3 transition-opacity duration-150 ${
                  isRegister ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
                aria-hidden={!isRegister}
              >
                {/* Encabezado */}
                <div className="flex-shrink-0">
                  <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight">
                    Crear nueva cuenta
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Ingresa tus datos para habilitar tu catálogo de trabajo.
                  </p>
                </div>

                {/* Campos */}
                <div className="space-y-3.5 my-auto">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Nombre completo
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={fullName}
                        onChange={e => setFullName(e.target.value)}
                        placeholder="Carlos Pérez"
                        tabIndex={isRegister ? 0 : -1}
                        className="w-full min-h-[42px] bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-900 rounded-xl pl-10 pr-4 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-[background-color,border-color,box-shadow] duration-150"
                      />
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Correo electrónico
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="usuario@dominio.com"
                        required
                        tabIndex={isRegister ? 0 : -1}
                        className="w-full min-h-[42px] bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-900 rounded-xl pl-10 pr-4 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-[background-color,border-color,box-shadow] duration-150"
                      />
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Contraseña
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        tabIndex={isRegister ? 0 : -1}
                        className="w-full min-h-[42px] bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-900 rounded-xl pl-10 pr-4 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-[background-color,border-color,box-shadow] duration-150"
                      />
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    </div>
                  </div>

                  {/* Opciones y Checkbox de Términos (RF-LEGAL-001) */}
                  <div className="pt-1">
                    <label className="flex items-start gap-2.5 cursor-pointer select-none">
                      <div
                        onClick={() => setTermsAccepted(!termsAccepted)}
                        className={`w-4 h-4 mt-0.5 rounded border transition-colors flex items-center justify-center shrink-0 ${
                          termsAccepted ? 'bg-slate-900 border-slate-900 text-white' : 'border-slate-300 bg-white'
                        }`}
                      >
                        {termsAccepted && <Check className="w-3 h-3 stroke-[2.5]" />}
                      </div>
                      <span className="text-xs text-slate-600 leading-tight">
                        He leído y acepto los{' '}
                        <a
                          href="/terms"
                          onClick={(e) => {
                            e.preventDefault();
                            if (typeof window !== 'undefined') {
                              sessionStorage.setItem('stockly_splash_shown', 'true');
                            }
                            window.history.pushState({}, '', '/terms');
                            window.dispatchEvent(new PopStateEvent('popstate'));
                          }}
                          className="text-slate-900 font-semibold underline underline-offset-2 hover:text-slate-700"
                        >
                          Términos de Servicio
                        </a>{' '}
                        y la{' '}
                        <a
                          href="/privacy"
                          onClick={(e) => {
                            e.preventDefault();
                            if (typeof window !== 'undefined') {
                              sessionStorage.setItem('stockly_splash_shown', 'true');
                            }
                            window.history.pushState({}, '', '/privacy');
                            window.dispatchEvent(new PopStateEvent('popstate'));
                          }}
                          className="text-slate-900 font-semibold underline underline-offset-2 hover:text-slate-700"
                        >
                          Política de Privacidad
                        </a>.
                      </span>
                    </label>
                  </div>
                </div>

                {/* Botón Acción Registro */}
                <div className="flex-shrink-0 pt-2">
                  <button
                    type="submit"
                    disabled={loading || !termsAccepted}
                    tabIndex={isRegister ? 0 : -1}
                    className="w-full min-h-[42px] py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-xl transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-slate-300" />
                        <span>Procesando...</span>
                      </>
                    ) : (
                      <>
                        <span>Crear cuenta</span>
                        <ArrowRight className="w-4 h-4 text-slate-300" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

        </div>
      </div>
    </div>
  </main>
  );
};


export default AuthPage;
