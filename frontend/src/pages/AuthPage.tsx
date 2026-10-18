import React, { useState } from 'react';
import { Mail, Lock, User, ArrowRight, Loader2, CheckCircle2, ShieldCheck, Sparkles, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const AuthPage: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
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
    <div className="min-h-[100dvh] bg-[#F8F9FA] flex items-center justify-center p-4 sm:p-6 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] selection:bg-[#1E3A5F] selection:text-white">
      {/* Split-Card Container con Altura Fija y Consistente en Ambos Modos */}
      <div className="w-full max-w-md md:max-w-4xl bg-white border border-[#E5E7EB] rounded-2xl shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-2 md:h-[620px]">
        
        {/* =========================================================
            PANEL IZQUIERDO: MARCA & EDITORIAL (AZUL MARINO #1E3A5F)
            Visible en Desktop/Tablet (md:flex), optimizado en móvil
           ========================================================= */}
        <div className="hidden md:flex bg-[#1E3A5F] text-white p-6 sm:p-10 md:p-12 flex-col justify-between relative overflow-hidden h-full">
          {/* Acento geométrico Nude sutil de fondo */}
          <div className="absolute -right-16 -bottom-16 w-64 h-64 rounded-full bg-[#E8B4A0]/10 blur-2xl pointer-events-none" />
          <div className="absolute top-8 right-8 w-2 h-2 rounded-full bg-[#E8B4A0]" />

          {/* Superior: Logotipo y Sistema Stockly */}
          <div className="space-y-4 relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white border border-white/20 flex items-center justify-center overflow-hidden shadow-xs">
                <img src="/logo.png" alt="Stockly" className="w-full h-full object-cover" />
              </div>
              <span className="font-mono text-sm uppercase tracking-[0.2em] text-[#E8B4A0] font-bold">
                STOCKLY
              </span>
            </div>

            <div className="pt-4 sm:pt-8">
              <span className="inline-block px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-widest bg-white/10 text-[#E8B4A0] border border-white/10 mb-3 font-semibold">
                INVENTORY & POS SYSTEM
              </span>
              <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
                Gestión de stock <br />
                <span className="font-semibold italic text-[#E8B4A0]">editorial & precisa.</span>
              </h1>
              <p className="text-xs sm:text-sm text-white/70 mt-3 font-light leading-relaxed max-w-sm">
                Control de inventarios por códigos de barra y QR, telemetría de almacén y registro comercial en tiempo real.
              </p>
            </div>
          </div>

          {/* Inferior: Atributos Clave */}
          <div className="pt-6 sm:pt-8 border-t border-white/10 relative z-10 space-y-2.5">
            <div className="flex items-center gap-2.5 text-xs text-white/80 font-light">
              <ShieldCheck className="w-4 h-4 text-[#E8B4A0] flex-shrink-0" />
              <span>Multi-tenancy con partición criptográfica por inventario</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-white/80 font-light">
              <Sparkles className="w-4 h-4 text-[#E8B4A0] flex-shrink-0" />
              <span>Escaneo PWA directo con cámara de alta precisión</span>
            </div>
          </div>
        </div>

        {/* =========================================================
            PANEL DERECHO: FORMULARIO SPLIT-CARD (BLANCO PAPER)
            Altura exacta uniforme para Iniciar Sesión y Registro
           ========================================================= */}
        <div className="bg-white p-6 sm:p-8 md:p-12 flex flex-col h-[540px] md:h-full justify-between relative overflow-hidden">
          
          {/* Identificador de marca visible en móvil (para no saturar pantalla en iPhone) */}
          <div className="flex md:hidden items-center justify-center gap-2 mb-2 flex-shrink-0">
            <div className="w-7 h-7 rounded-lg bg-white border border-[#E5E7EB] overflow-hidden flex items-center justify-center shadow-xs">
              <img src="/logo.png" alt="Stockly" className="w-full h-full object-cover" />
            </div>
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#1E3A5F] font-bold">
              STOCKLY
            </span>
          </div>

          {/* Superior: Selector con Píldora Deslizante Fluida */}
          <div className="relative p-1 bg-[#F8F9FA] border border-[#E5E7EB] rounded-full mb-3 select-none overflow-hidden flex-shrink-0">
            <div
              className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full bg-[#1E3A5F] shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isRegister ? 'translate-x-full left-1' : 'translate-x-0 left-1'
              }`}
            />
            <div className="relative grid grid-cols-2 z-10 font-mono text-xs font-bold uppercase tracking-wider">
              <button
                type="button"
                onClick={() => {
                  setIsRegister(false);
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`py-2 rounded-full transition-colors duration-200 text-center ${
                  !isRegister ? 'text-white' : 'text-[#616161] hover:text-[#1E3A5F]'
                }`}
              >
                INICIAR SESIÓN
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRegister(true);
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`py-2 rounded-full transition-colors duration-200 text-center ${
                  isRegister ? 'text-white' : 'text-[#616161] hover:text-[#1E3A5F]'
                }`}
              >
                REGISTRARME
              </button>
            </div>
          </div>

          {/* Alertas Globales con altura mínima para evitar saltos */}
          <div className="min-h-[20px] mb-2 flex-shrink-0">
            {errorMsg && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-light animate-in fade-in duration-200">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-light flex items-center gap-2 animate-in fade-in duration-200">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
            )}
          </div>

          {/* Carrusel Deslizante de Vistas con Dimensiones Idénticas */}
          <div className="relative flex-1 overflow-hidden">
            <div
              className={`flex w-[200%] h-full transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
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
                className={`w-1/2 h-full flex flex-col justify-between pr-3 transition-opacity duration-200 ${
                  !isRegister ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
                aria-hidden={isRegister}
              >
                {/* Encabezado */}
                <div className="flex-shrink-0">
                  <h2 className="text-xl sm:text-2xl font-bold text-[#1E3A5F] tracking-tight">
                    Bienvenido de nuevo
                  </h2>
                  <p className="text-xs text-[#616161] mt-1 font-light">
                    Introduce tus credenciales para acceder a tus depósitos.
                  </p>
                </div>

                {/* Campos */}
                <div className="space-y-3.5 my-auto">
                  <div>
                    <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#1E3A5F] mb-1.5">
                      CORREO ELECTRÓNICO
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="usuario@dominio.com"
                        required
                        tabIndex={!isRegister ? 0 : -1}
                        className="w-full min-h-[44px] bg-[#F8F9FA] border border-[#E5E7EB] focus:border-[#1E3A5F] rounded-2xl pl-10 pr-4 text-xs font-light text-[#1E3A5F] placeholder-[#616161] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F] transition-all"
                      />
                      <Mail className="w-4 h-4 text-[#616161] absolute left-3.5 top-3.5" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#1E3A5F] mb-1.5">
                      CONTRASEÑA
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        tabIndex={!isRegister ? 0 : -1}
                        className="w-full min-h-[44px] bg-[#F8F9FA] border border-[#E5E7EB] focus:border-[#1E3A5F] rounded-2xl pl-10 pr-4 text-xs font-light text-[#1E3A5F] placeholder-[#616161] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F] transition-all"
                      />
                      <Lock className="w-4 h-4 text-[#616161] absolute left-3.5 top-3.5" />
                    </div>
                  </div>

                  {/* Opciones */}
                  <div className="flex items-center justify-between pt-0.5">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <div
                        onClick={() => setRememberMe(!rememberMe)}
                        className={`w-4 h-4 rounded border transition-colors flex items-center justify-center ${
                          rememberMe ? 'bg-[#1E3A5F] border-[#1E3A5F] text-white' : 'border-[#E5E7EB] bg-white'
                        }`}
                      >
                        {rememberMe && <Check className="w-3 h-3 stroke-[2.5]" />}
                      </div>
                      <span className="text-xs text-[#616161] font-light">Recordar sesión</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => alert('Para restablecer tu contraseña, contacta a soporte o al administrador.')}
                      className="text-[11px] font-mono text-[#1E3A5F] hover:underline"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>

                  {/* Micro tarjeta de seguridad que equilibra exactamente la altura con Registro */}
                  <div className="p-2.5 bg-[#F8F9FA] border border-[#E5E7EB] rounded-2xl flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-[#1E3A5F]/5 border border-[#1E3A5F]/10 flex items-center justify-center flex-shrink-0">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#1E3A5F]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#1E3A5F]">
                        Terminal Criptográfica Activa
                      </p>
                      <p className="text-[10px] text-[#616161] font-light truncate">
                        Cifrado TLS 1.3 con almacenamiento particionado
                      </p>
                    </div>
                  </div>
                </div>

                {/* Botón Acción Iniciar Sesión */}
                <div className="flex-shrink-0 pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    tabIndex={!isRegister ? 0 : -1}
                    className="w-full min-h-[44px] py-3 bg-[#1E3A5F] hover:bg-[#172E4C] text-white text-xs font-mono font-bold uppercase tracking-wider rounded-full transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-[#E8B4A0]" />
                        <span>PROCESANDO...</span>
                      </>
                    ) : (
                      <>
                        <span>ENTRAR AL SISTEMA</span>
                        <ArrowRight className="w-4 h-4 text-[#E8B4A0]" />
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
                className={`w-1/2 h-full flex flex-col justify-between pl-3 transition-opacity duration-200 ${
                  isRegister ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
                aria-hidden={!isRegister}
              >
                {/* Encabezado */}
                <div className="flex-shrink-0">
                  <h2 className="text-xl sm:text-2xl font-bold text-[#1E3A5F] tracking-tight">
                    Crear nueva cuenta
                  </h2>
                  <p className="text-xs text-[#616161] mt-1 font-light">
                    Ingresa tus datos para habilitar tu catálogo de trabajo.
                  </p>
                </div>

                {/* Campos */}
                <div className="space-y-3.5 my-auto">
                  <div>
                    <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#1E3A5F] mb-1.5">
                      NOMBRE COMPLETO
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={fullName}
                        onChange={e => setFullName(e.target.value)}
                        placeholder="Carlos Pérez"
                        tabIndex={isRegister ? 0 : -1}
                        className="w-full min-h-[44px] bg-[#F8F9FA] border border-[#E5E7EB] focus:border-[#1E3A5F] rounded-2xl pl-10 pr-4 text-xs font-light text-[#1E3A5F] placeholder-[#616161] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F] transition-all"
                      />
                      <User className="w-4 h-4 text-[#616161] absolute left-3.5 top-3.5" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#1E3A5F] mb-1.5">
                      CORREO ELECTRÓNICO
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="usuario@dominio.com"
                        required
                        tabIndex={isRegister ? 0 : -1}
                        className="w-full min-h-[44px] bg-[#F8F9FA] border border-[#E5E7EB] focus:border-[#1E3A5F] rounded-2xl pl-10 pr-4 text-xs font-light text-[#1E3A5F] placeholder-[#616161] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F] transition-all"
                      />
                      <Mail className="w-4 h-4 text-[#616161] absolute left-3.5 top-3.5" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#1E3A5F] mb-1.5">
                      CONTRASEÑA
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        tabIndex={isRegister ? 0 : -1}
                        className="w-full min-h-[44px] bg-[#F8F9FA] border border-[#E5E7EB] focus:border-[#1E3A5F] rounded-2xl pl-10 pr-4 text-xs font-light text-[#1E3A5F] placeholder-[#616161] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F] transition-all"
                      />
                      <Lock className="w-4 h-4 text-[#616161] absolute left-3.5 top-3.5" />
                    </div>
                  </div>

                  {/* Opciones */}
                  <div className="flex items-center justify-between pt-0.5">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <div
                        onClick={() => setRememberMe(!rememberMe)}
                        className={`w-4 h-4 rounded border transition-colors flex items-center justify-center ${
                          rememberMe ? 'bg-[#1E3A5F] border-[#1E3A5F] text-white' : 'border-[#E5E7EB] bg-white'
                        }`}
                      >
                        {rememberMe && <Check className="w-3 h-3 stroke-[2.5]" />}
                      </div>
                      <span className="text-xs text-[#616161] font-light">Acepto condiciones de uso del sistema</span>
                    </label>
                  </div>
                </div>

                {/* Botón Acción Registro */}
                <div className="flex-shrink-0 pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    tabIndex={isRegister ? 0 : -1}
                    className="w-full min-h-[44px] py-3 bg-[#1E3A5F] hover:bg-[#172E4C] text-white text-xs font-mono font-bold uppercase tracking-wider rounded-full transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-[#E8B4A0]" />
                        <span>PROCESANDO...</span>
                      </>
                    ) : (
                      <>
                        <span>CREAR CUENTA</span>
                        <ArrowRight className="w-4 h-4 text-[#E8B4A0]" />
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
  );
};

