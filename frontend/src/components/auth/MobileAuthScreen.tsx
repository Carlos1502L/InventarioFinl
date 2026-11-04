import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Check
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

interface LetterItem {
  char: string;
  initialX: number;
  initialY: number;
  rotate: number;
  delay: number;
}

// Coordenadas asimétricas para el ensamblaje cinético de la palabra STOCKLY
const LETTERS: LetterItem[] = [
  { char: 'S', initialX: -140, initialY: -100, rotate: -25, delay: 0.00 },
  { char: 'T', initialX: 0,    initialY: -140, rotate: 12,  delay: 0.08 },
  { char: 'O', initialX: -150, initialY: 20,   rotate: -15, delay: 0.16 },
  { char: 'C', initialX: -110, initialY: 140,  rotate: 20,  delay: 0.06 },
  { char: 'K', initialX: 120,  initialY: 130,  rotate: -20, delay: 0.14 },
  { char: 'L', initialX: 150,  initialY: -20,  rotate: 15,  delay: 0.10 },
  { char: 'Y', initialX: 130,  initialY: -120, rotate: -30, delay: 0.22 },
];

export function MobileAuthScreen() {
  // 'CONVERGING' -> 'EXPLODING' -> 'LOGIN_READY'
  const [stage, setStage] = useState<'CONVERGING' | 'EXPLODING' | 'LOGIN_READY'>('CONVERGING');

  const { signIn, signUp } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  // Manejador de Autenticación Supabase
  const handleAuth = async (e: React.FormEvent) => {
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

    if (isRegister && !fullName.trim()) {
      setErrorMsg('Por favor introduce tu nombre completo.');
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

  // Manejador de Recuperación de Contraseña
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg('Ingresa tu correo electrónico para recuperar la contraseña.');
      return;
    }

    try {
      setResetLoading(true);
      setErrorMsg(null);
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSuccessMsg('Te hemos enviado un enlace para restablecer tu contraseña. Revisa tu bandeja.');
    } catch (err: any) {
      console.error('Error recuperando contraseña:', err);
      setErrorMsg(err.message || 'Error al solicitar recuperación de contraseña.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <motion.div
      animate={{
        backgroundColor: stage === 'LOGIN_READY' ? '#F8F9FA' : '#000000',
      }}
      transition={{ duration: 0.55, ease: 'easeInOut' }}
      className="relative min-h-[100dvh] w-full text-[#1E3A5F] flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto overscroll-y-contain select-none pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))] font-sans"
    >
      {/* Acentos geométricos del estilo móvil que aparecen sutilmente al terminar la animación */}
      <AnimatePresence>
        {stage === 'LOGIN_READY' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="pointer-events-none"
          >
            <div className="fixed top-[-80px] right-[-80px] w-72 h-72 rounded-full bg-[#E8B4A0]/15 blur-3xl pointer-events-none" />
            <div className="fixed bottom-[-80px] left-[-80px] w-80 h-80 rounded-full bg-[#1E3A5F]/5 blur-3xl pointer-events-none" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* =========================================================
          FASE 1 Y 2: ANIMACIÓN CINÉTICA (LETRAS BLANCAS SOBRE FONDO NEGRO)
         ========================================================= */}
      {stage !== 'LOGIN_READY' && (
        <div className="relative z-20 flex items-center justify-center my-auto min-h-[60vh]">
          
          {/* Destello blanco de la onda expansiva en la explosión */}
          {stage === 'EXPLODING' && (
            <motion.div
              initial={{ scale: 0, opacity: 0.95 }}
              animate={{ scale: 4.5, opacity: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
              className="absolute w-32 h-32 rounded-full bg-white blur-2xl pointer-events-none"
            />
          )}

          {/* Letras blancas convergentes sobre fondo negro */}
          <motion.div
            className="flex text-4xl sm:text-5xl font-mono font-bold tracking-[0.2em] text-white select-none"
            animate={
              stage === 'EXPLODING'
                ? {
                    scale: [1, 0.88, 2.4],
                    opacity: [1, 1, 0],
                    filter: ['blur(0px)', 'blur(0px)', 'blur(10px)'],
                  }
                : { scale: 1, opacity: 1 }
            }
            transition={stage === 'EXPLODING' ? { duration: 0.5, ease: 'easeInOut' } : {}}
            onAnimationComplete={() => {
              if (stage === 'EXPLODING') setStage('LOGIN_READY');
            }}
          >
            {LETTERS.map((item, index) => (
              <motion.span
                key={index}
                initial={{
                  x: `${item.initialX}vw`,
                  y: `${item.initialY}vh`,
                  rotate: item.rotate,
                  opacity: 0,
                  filter: 'blur(12px)',
                }}
                animate={{
                  x: 0,
                  y: 0,
                  rotate: 0,
                  opacity: 1,
                  filter: 'blur(0px)',
                }}
                transition={{
                  duration: 1.05,
                  delay: item.delay,
                  ease: [0.16, 1, 0.3, 1],
                }}
                onAnimationComplete={() => {
                  // Pausa táctica con las letras en blanco centradas
                  if (index === LETTERS.length - 1 && stage === 'CONVERGING') {
                    setTimeout(() => setStage('EXPLODING'), 450);
                  }
                }}
                className="inline-block text-white drop-shadow-[0_0_24px_rgba(255,255,255,0.45)]"
              >
                {item.char}
              </motion.span>
            ))}
          </motion.div>
        </div>
      )}

      {/* =========================================================
          FASE 3: CARGA DEL LOGIN MÓVIL (LIMPIO, MINIMALISTA Y EXACTO)
          Adopta el diseño y estilo de la aplicación móvil de Stockly
         ========================================================= */}
      <AnimatePresence>
        {stage === 'LOGIN_READY' && (
          <motion.div
            initial={{ scale: 0.88, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-30 w-full max-w-sm sm:max-w-md bg-white border border-[#E5E7EB] rounded-2xl shadow-sm p-6 sm:p-8 flex flex-col justify-between my-auto"
          >
            {/* Encabezado: Logo e identificador Stockly */}
            <div className="flex items-center justify-center gap-2 mb-3.5 flex-shrink-0">
              <div className="w-8 h-8 rounded-lg bg-white border border-[#E5E7EB] overflow-hidden flex items-center justify-center shadow-xs">
                <img
                  src="/logo.png"
                  alt="Stockly"
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <span className="font-mono text-sm uppercase tracking-[0.2em] text-[#1E3A5F] font-bold">
                STOCKLY
              </span>
            </div>

            {/* Selector de modo con cápsula deslizante */}
            <div className="relative p-1 bg-[#F8F9FA] border border-[#E5E7EB] rounded-full mb-3.5 select-none overflow-hidden flex-shrink-0">
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
                    setIsResetPassword(false);
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className={`py-2 rounded-full transition-colors duration-200 text-center cursor-pointer ${
                    !isRegister && !isResetPassword ? 'text-white' : 'text-[#616161] hover:text-[#1E3A5F]'
                  }`}
                >
                  INICIAR SESIÓN
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(true);
                    setIsResetPassword(false);
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className={`py-2 rounded-full transition-colors duration-200 text-center cursor-pointer ${
                    isRegister ? 'text-white' : 'text-[#616161] hover:text-[#1E3A5F]'
                  }`}
                >
                  REGISTRARME
                </button>
              </div>
            </div>

            {/* Mensajes de Alerta y Notificación */}
            <div className="min-h-[16px] mb-2 flex-shrink-0">
              {errorMsg && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-light flex items-center gap-2 animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
              {successMsg && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-light flex items-center gap-2 animate-in fade-in duration-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}
            </div>

            {/* VISTA 1: RECUPERACIÓN DE CONTRASEÑA */}
            {isResetPassword ? (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-[#1E3A5F] tracking-tight">
                    Recuperar contraseña
                  </h2>
                  <p className="text-xs text-[#616161] mt-1 font-light">
                    Ingresa tu correo para recibir un enlace de restablecimiento.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#1E3A5F] mb-1.5">
                    CORREO ELECTRÓNICO
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="usuario@dominio.com"
                      required
                      className="w-full min-h-[44px] bg-[#F8F9FA] border border-[#E5E7EB] focus:border-[#1E3A5F] rounded-2xl pl-10 pr-4 text-xs font-light text-[#1E3A5F] placeholder-[#616161] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F] transition-all font-sans"
                    />
                    <Mail className="w-4 h-4 text-[#616161] absolute left-3.5 top-3.5" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full min-h-[44px] py-3 bg-[#1E3A5F] hover:bg-[#172E4C] text-white text-xs font-mono font-bold uppercase tracking-wider rounded-full transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  {resetLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#E8B4A0]" />
                      <span>ENVIANDO ENLACE...</span>
                    </>
                  ) : (
                    <>
                      <span>ENVIAR ENLACE</span>
                      <ArrowRight className="w-4 h-4 text-[#E8B4A0]" />
                    </>
                  )}
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsResetPassword(false);
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="text-xs font-mono text-[#1E3A5F] hover:underline cursor-pointer"
                  >
                    ← Volver a Iniciar Sesión
                  </button>
                </div>
              </form>
            ) : (
              /* VISTA 2: INICIAR SESIÓN O REGISTRO */
              <form onSubmit={handleAuth} className="space-y-3.5">
                {/* Título de bienvenida */}
                <div>
                  <h2 className="text-xl font-bold text-[#1E3A5F] tracking-tight">
                    {isRegister ? 'Crear nueva cuenta' : 'Bienvenido de nuevo'}
                  </h2>
                  <p className="text-xs text-[#616161] mt-1 font-light">
                    {isRegister
                      ? 'Ingresa tus datos para habilitar tu catálogo de trabajo.'
                      : 'Introduce tus credenciales para acceder a tus depósitos.'}
                  </p>
                </div>

                {/* Campo Nombre (solo en Registro) */}
                {isRegister && (
                  <div>
                    <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#1E3A5F] mb-1.5">
                      NOMBRE COMPLETO
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Carlos Pérez"
                        required={isRegister}
                        className="w-full min-h-[44px] bg-[#F8F9FA] border border-[#E5E7EB] focus:border-[#1E3A5F] rounded-2xl pl-10 pr-4 text-xs font-light text-[#1E3A5F] placeholder-[#616161] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F] transition-all font-sans"
                      />
                      <User className="w-4 h-4 text-[#616161] absolute left-3.5 top-3.5" />
                    </div>
                  </div>
                )}

                {/* Campo Correo Electrónico */}
                <div>
                  <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#1E3A5F] mb-1.5">
                    CORREO ELECTRÓNICO
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="usuario@dominio.com"
                      required
                      className="w-full min-h-[44px] bg-[#F8F9FA] border border-[#E5E7EB] focus:border-[#1E3A5F] rounded-2xl pl-10 pr-4 text-xs font-light text-[#1E3A5F] placeholder-[#616161] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F] transition-all font-sans"
                    />
                    <Mail className="w-4 h-4 text-[#616161] absolute left-3.5 top-3.5" />
                  </div>
                </div>

                {/* Campo Contraseña */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#1E3A5F]">
                      CONTRASEÑA
                    </label>
                    {!isRegister && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsResetPassword(true);
                          setErrorMsg(null);
                          setSuccessMsg(null);
                        }}
                        className="text-[11px] font-mono text-[#1E3A5F] hover:underline cursor-pointer"
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full min-h-[44px] bg-[#F8F9FA] border border-[#E5E7EB] focus:border-[#1E3A5F] rounded-2xl pl-10 pr-4 text-xs font-light text-[#1E3A5F] placeholder-[#616161] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F] transition-all font-sans"
                    />
                    <Lock className="w-4 h-4 text-[#616161] absolute left-3.5 top-3.5" />
                  </div>
                </div>

                {/* Opciones Adicionales */}
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
                    <span className="text-xs text-[#616161] font-light">
                      {isRegister ? 'Acepto condiciones de uso del sistema' : 'Recordar sesión'}
                    </span>
                  </label>
                </div>

                {/* Botón Principal Azul Marino con Acento Nude #E8B4A0 */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full min-h-[44px] py-3 bg-[#1E3A5F] hover:bg-[#172E4C] text-white text-xs font-mono font-bold uppercase tracking-wider rounded-full transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-[#E8B4A0]" />
                        <span>PROCESANDO...</span>
                      </>
                    ) : (
                      <>
                        <span>{isRegister ? 'CREAR CUENTA' : 'ENTRAR AL SISTEMA'}</span>
                        <ArrowRight className="w-4 h-4 text-[#E8B4A0]" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default MobileAuthScreen;
