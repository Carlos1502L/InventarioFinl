import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

interface LetterItem {
  char: string;
  initialX: number;
  initialY: number;
  rotate: number;
  delay: number;
}

const LETTERS: LetterItem[] = [
  { char: 'S', initialX: -120, initialY: -80,  rotate: -25, delay: 0.00 },
  { char: 'T', initialX: 0,    initialY: -110, rotate: 10,  delay: 0.06 },
  { char: 'O', initialX: -130, initialY: 15,   rotate: -15, delay: 0.12 },
  { char: 'C', initialX: -90,  initialY: 120,  rotate: 20,  delay: 0.04 },
  { char: 'K', initialX: 100,  initialY: 110,  rotate: -20, delay: 0.10 },
  { char: 'L', initialX: 130,  initialY: -10,  rotate: 15,  delay: 0.05 },
  { char: 'Y', initialX: 110,  initialY: -90,  rotate: -30, delay: 0.14 },
];

export function MobileAuthScreen() {
  // 'CONVERGING' -> 'EXPLODING' -> 'LOGIN_READY'
  const [stage, setStage] = useState<'CONVERGING' | 'EXPLODING' | 'LOGIN_READY'>('CONVERGING');

  const { signIn, signUp } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
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

  // Manejador Google OAuth
  const handleGoogleSignIn = async () => {
    try {
      setErrorMsg(null);
      setGoogleLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err: any) {
      console.error('Error con Google OAuth:', err);
      setErrorMsg(err.message || 'No se pudo conectar con Google.');
      setGoogleLoading(false);
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
        redirectTo: `${window.location.origin}/reset-password`
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
    <div className="relative min-h-[100dvh] w-full bg-[#070d18] text-slate-100 flex items-center justify-center p-4 sm:p-6 overflow-hidden select-none pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      
      {/* Fondo tenue con brillo central */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.08)_0%,transparent_70%)] pointer-events-none" />

      {/* FASE 1 Y 2: LOGOTIPO ANIMADO Y EXPLOSIÓN */}
      {stage !== 'LOGIN_READY' && (
        <div className="relative z-20 flex items-center justify-center">
          
          {/* Destello central de la explosión */}
          {stage === 'EXPLODING' && (
            <motion.div
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: 4, opacity: 0 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className="absolute w-28 h-28 rounded-full bg-sky-400 blur-xl pointer-events-none"
            />
          )}

          {/* Letras convergentes */}
          <motion.div
            className="flex text-4xl sm:text-5xl font-extrabold tracking-wider font-mono text-white"
            animate={
              stage === 'EXPLODING'
                ? { scale: [1, 0.85, 2.2], opacity: [1, 1, 0], filter: ['blur(0px)', 'blur(0px)', 'blur(8px)'] }
                : { scale: 1, opacity: 1 }
            }
            transition={stage === 'EXPLODING' ? { duration: 0.4, ease: 'easeInOut' } : {}}
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
                  filter: 'blur(10px)',
                }}
                animate={{
                  x: 0,
                  y: 0,
                  rotate: 0,
                  opacity: 1,
                  filter: 'blur(0px)',
                }}
                transition={{
                  duration: 0.75,
                  delay: item.delay,
                  ease: [0.16, 1, 0.3, 1], // easeOutExpo para frenada nítida
                }}
                onAnimationComplete={() => {
                  // Cuando la última letra termina de encajar
                  if (index === LETTERS.length - 1 && stage === 'CONVERGING') {
                    setTimeout(() => setStage('EXPLODING'), 200);
                  }
                }}
                className="inline-block text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-100 to-sky-400 drop-shadow-[0_0_12px_rgba(56,189,248,0.4)]"
              >
                {item.char}
              </motion.span>
            ))}
          </motion.div>
        </div>
      )}

      {/* FASE 3: FORMULARIO DE LOGIN REVELADO TRAS LA EXPLOSIÓN */}
      <AnimatePresence>
        {stage === 'LOGIN_READY' && (
          <motion.div
            initial={{ scale: 0.4, opacity: 0, filter: 'blur(14px)' }}
            animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-30 w-full max-w-sm rounded-2xl bg-[#0b1524]/90 border border-sky-500/25 p-6 sm:p-7 shadow-[0_0_40px_rgba(56,189,248,0.12)] backdrop-blur-xl"
          >
            {/* Cabecera del formulario */}
            <div className="mb-5 text-center">
              <h2 className="text-xl font-bold font-mono tracking-widest text-white">STOCKLY</h2>
              <p className="text-xs text-sky-400/80 font-sans mt-1">Acceso seguro a inventario</p>
            </div>

            {/* Selector Modo Iniciar Sesión / Registrarme */}
            <div className="grid grid-cols-2 p-1 bg-[#060c16] rounded-xl border border-slate-800 mb-4 text-xs font-mono">
              <button
                type="button"
                onClick={() => {
                  setIsRegister(false);
                  setIsResetPassword(false);
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                  !isRegister && !isResetPassword
                    ? 'bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30'
                    : 'text-slate-400 hover:text-white'
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
                className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                  isRegister
                    ? 'bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                REGISTRARME
              </button>
            </div>

            {/* Mensajes de feedback */}
            {errorMsg && (
              <div className="p-3 mb-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="flex-1 leading-relaxed">{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="p-3 mb-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-start gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span className="flex-1 leading-relaxed">{successMsg}</span>
              </div>
            )}

            {/* Formulario de Recuperación o Autenticación */}
            {isResetPassword ? (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Correo para recuperación
                  </label>
                  <input
                    type="text"
                    inputMode="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck="false"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@correo.com"
                    required
                    className="w-full rounded-xl bg-[#060c16] border border-slate-700/80 px-3.5 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400/40 transition-all font-sans"
                  />
                </div>

                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {resetLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Enviando enlace...</span>
                    </>
                  ) : (
                    <span>Enviar Enlace de Recuperación</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsResetPassword(false);
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="w-full text-center text-xs text-sky-400 hover:underline pt-1 cursor-pointer"
                >
                  ← Volver a Iniciar Sesión
                </button>
              </form>
            ) : (
              <form className="space-y-4" onSubmit={handleAuth}>
                {isRegister && (
                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                      Nombre Completo
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Juan Pérez"
                      required={isRegister}
                      className="w-full rounded-xl bg-[#060c16] border border-slate-700/80 px-3.5 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400/40 transition-all font-sans"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Correo Electrónico
                  </label>
                  <input
                    type="text"
                    inputMode="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck="false"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@correo.com"
                    required
                    className="w-full rounded-xl bg-[#060c16] border border-slate-700/80 px-3.5 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400/40 transition-all font-sans"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400">
                      Contraseña
                    </label>
                    {!isRegister && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsResetPassword(true);
                          setErrorMsg(null);
                          setSuccessMsg(null);
                        }}
                        className="text-[11px] text-sky-400 hover:underline font-sans cursor-pointer"
                      >
                        ¿Olvidaste?
                      </button>
                    )}
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full rounded-xl bg-[#060c16] border border-slate-700/80 px-3.5 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400/40 transition-all font-sans"
                  />
                </div>

                {/* Botón principal */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>{isRegister ? 'Creando cuenta...' : 'Ingresando...'}</span>
                    </>
                  ) : (
                    <span>{isRegister ? 'Crear Cuenta' : 'Ingresar al Sistema'}</span>
                  )}
                </button>
              </form>
            )}

            {/* Separador */}
            <div className="my-5 flex items-center justify-between">
              <span className="h-[1px] w-full bg-slate-800" />
              <span className="px-3 text-[10px] font-mono uppercase tracking-wider text-slate-500">O</span>
              <span className="h-[1px] w-full bg-slate-800" />
            </div>

            {/* Botón secundario OAuth Google */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-slate-700 bg-[#060c16] py-2.5 text-xs font-medium text-slate-200 hover:border-slate-500 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
            >
              {googleLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.4l3.7 2.9C6.5 7.4 9 5 12 5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.6 14.7c-.2-.7-.4-1.5-.4-2.3 0-.8.2-1.6.4-2.3L1.9 7.2C.7 9.6 0 12.2 0 15s.7 5.4 1.9 7.8l3.7-2.9z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.4C3.7 20.2 7.5 23 12 23z"
                  />
                </svg>
              )}
              <span>Continuar con Google</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
