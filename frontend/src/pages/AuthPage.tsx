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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

    try {
      setLoading(true);
      if (isRegister) {
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
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4 sm:p-6 selection:bg-[#1E3A5F] selection:text-white">
      {/* Split-Card Container */}
      <div className="w-full max-w-4xl bg-white border border-[#E5E7EB] rounded-2xl shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-2">
        
        {/* =========================================================
            PANEL IZQUIERDO: MARCA & EDITORIAL (AZUL MARINO #1E3A5F)
           ========================================================= */}
        <div className="bg-[#1E3A5F] text-white p-8 sm:p-12 flex flex-col justify-between relative overflow-hidden">
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

            <div className="pt-8">
              <span className="inline-block px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-widest bg-white/10 text-[#E8B4A0] border border-white/10 mb-3 font-semibold">
                INVENTORY & POS SYSTEM
              </span>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
                Gestión de stock <br />
                <span className="font-semibold italic text-[#E8B4A0]">editorial & precisa.</span>
              </h1>
              <p className="text-xs sm:text-sm text-white/70 mt-3 font-light leading-relaxed max-w-sm">
                Control de inventarios por códigos de barra y QR, telemetría de almacén y registro comercial en tiempo real.
              </p>
            </div>
          </div>

          {/* Inferior: Atributos Clave */}
          <div className="pt-8 border-t border-white/10 relative z-10 space-y-2.5">
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
           ========================================================= */}
        <div className="bg-white p-8 sm:p-12 flex flex-col justify-center">
          
          {/* Selector Login / Registro con Píldora Deslizante Fluida */}
          <div className="relative p-1 bg-[#F8F9FA] border border-[#E5E7EB] rounded-full mb-6 select-none overflow-hidden">
            {/* Píldora deslizante animada */}
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

          {/* Encabezado con transición suave */}
          <div className="mb-6 min-h-[56px] flex flex-col justify-center">
            <h2 className="text-xl sm:text-2xl font-bold text-[#1E3A5F] tracking-tight transition-all duration-300 ease-out">
              {isRegister ? 'Crear nueva cuenta' : 'Bienvenido de nuevo'}
            </h2>
            <p className="text-xs text-[#616161] mt-1 font-light transition-all duration-300 ease-out">
              {isRegister
                ? 'Ingresa tus datos para habilitar tu catálogo de trabajo.'
                : 'Introduce tus credenciales para acceder a tus depósitos.'}
            </p>
          </div>

          {/* Alertas */}
          {errorMsg && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-light animate-in fade-in duration-200">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 font-light flex items-center gap-2 animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Formulario con animación fluida entre modos */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Campo Nombre Completo: Acordeón fluido con fade y slide */}
            <div
              className={`overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isRegister
                  ? 'max-h-28 opacity-100 transform translate-y-0'
                  : 'max-h-0 opacity-0 transform -translate-y-2 pointer-events-none'
              }`}
            >
              <div className="pb-1">
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
                  className="w-full min-h-[44px] bg-[#F8F9FA] border border-[#E5E7EB] focus:border-[#1E3A5F] rounded-2xl pl-10 pr-4 text-xs font-light text-[#1E3A5F] placeholder-[#616161] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F] transition-all"
                />
                <Lock className="w-4 h-4 text-[#616161] absolute left-3.5 top-3.5" />
              </div>
            </div>

            {/* Selector de Recordar Sesión */}
            <div className="flex items-center justify-between pt-1">
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
            </div>

            {/* Botón Principal en Azul Marino con animación suave */}
            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[44px] py-3 bg-[#1E3A5F] hover:bg-[#172E4C] text-white text-xs font-mono font-bold uppercase tracking-wider rounded-full transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm overflow-hidden"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#E8B4A0]" />
                  <span>PROCESANDO...</span>
                </>
              ) : (
                <div className="flex items-center gap-2 transition-all duration-300">
                  <span className="transition-opacity duration-300">
                    {isRegister ? 'CREAR CUENTA' : 'ENTRAR AL SISTEMA'}
                  </span>
                  <ArrowRight className="w-4 h-4 text-[#E8B4A0]" />
                </div>
              )}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
};
