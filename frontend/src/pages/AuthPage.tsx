import React, { useState } from 'react';
import {
  Layers,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  Star,
  Sparkles,
  Sun,
  Moon,
  Info
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';

export const AuthPage: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Estados del Formulario
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Estados de Proceso y Feedback
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
        setSuccessMsg('¡Cuenta creada exitosamente! Revisa tu correo si requiere confirmación o inicia sesión.');
      } else {
        const { error } = await signIn(email.trim(), password);
        if (error) throw error;
      }
    } catch (err: any) {
      console.error('Error de autenticación:', err);
      if (err.message?.includes('Invalid login credentials')) {
        setErrorMsg('Credenciales inválidas. Verifica tu correo y contraseña.');
      } else if (err.message?.includes('User already registered')) {
        setErrorMsg('Este correo ya está registrado. Intenta iniciar sesión.');
      } else {
        setErrorMsg(err.message || 'Error al autenticar.');
      }
    } finally {
      setLoading(false);
    }
  };

  // RF-02.3: Función de relleno rápido para tarjeta flotante de acceso demo
  const handleFillDemo = () => {
    setEmail('demo@inventariocoop.com');
    setPassword('demo123456');
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#F8F9FA] dark:bg-[#0E131F] text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200">
      {/* Botón flotante de Tema (Claro / Oscuro) */}
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 z-50 p-2.5 rounded-xl bg-white/90 dark:bg-[#1A2035]/90 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 shadow-md backdrop-blur-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95"
        title="Cambiar tema"
      >
        {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
      </button>

      {/* ==============================================================================
          COLUMNA IZQUIERDA: PANEL DE BRANDING (RF-01.1 Desktop 50/50)
          Fondo Azul Marino Profundo (#1A2035)
         ============================================================================== */}
      <aside className="w-full lg:w-1/2 bg-[#1A2035] text-white flex flex-col justify-between p-6 sm:p-10 lg:p-16 relative overflow-hidden select-none">
        {/* Glows y Luces de Fondo */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#FF6B00]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* 1. Logotipo Superior */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-[#FF6B00] to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
            <Layers className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-1.5">
              InventarioCoop <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-[#FF6B00]/20 text-[#FF6B00] border border-[#FF6B00]/30">Pro</span>
            </h1>
            <p className="text-[11px] text-slate-400">Plataforma Empresarial de Gestión</p>
          </div>
        </div>

        {/* 2. Cuerpo Principal de Branding */}
        <div className="relative z-10 my-8 lg:my-0 max-w-lg space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-xs font-semibold text-slate-200">
            <Sparkles className="w-3.5 h-3.5 text-[#FF6B00]" /> Nueva Versión 2.0 Lista para Producción
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight tracking-tight">
            Todo tu inventario, <span className="text-[#FF6B00]">bajo control.</span>
          </h2>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Optimiza la gestión de existencias, control de stock mínimo, trazabilidad por código QR y registro de ventas con cobro rápido desde cualquier dispositivo móvil o de escritorio.
          </p>

          {/* Indicadores Sociales / Avatares (RF-01.1) */}
          <div className="pt-4 flex flex-col sm:flex-row sm:items-center gap-4 border-t border-white/10">
            <div className="flex -space-x-3 overflow-hidden">
              <img
                className="inline-block h-10 w-10 rounded-full ring-2 ring-[#1A2035] object-cover"
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
                alt="Usuario 1"
              />
              <img
                className="inline-block h-10 w-10 rounded-full ring-2 ring-[#1A2035] object-cover"
                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80"
                alt="Usuario 2"
              />
              <img
                className="inline-block h-10 w-10 rounded-full ring-2 ring-[#1A2035] object-cover"
                src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80"
                alt="Usuario 3"
              />
              <img
                className="inline-block h-10 w-10 rounded-full ring-2 ring-[#1A2035] object-cover"
                src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80"
                alt="Usuario 4"
              />
            </div>

            <div>
              <div className="flex items-center gap-1 text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                ))}
              </div>
              <p className="text-xs text-slate-300 font-semibold mt-0.5">
                Más de 2.000 negocios confían en nosotros
              </p>
            </div>
          </div>
        </div>

        {/* 3. Enlaces de Pie de Página (Branding Footer) */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 pt-6 border-t border-white/10">
          <p>© 2026 InventarioCoop. Todos los derechos reservados.</p>
          <div className="flex items-center gap-4">
            <a href="#privacidad" onClick={e => e.preventDefault()} className="hover:text-white transition-colors">Privacidad</a>
            <a href="#terminos" onClick={e => e.preventDefault()} className="hover:text-white transition-colors">Términos</a>
            <a href="#soporte" onClick={e => e.preventDefault()} className="hover:text-white transition-colors">Soporte</a>
          </div>
        </div>
      </aside>

      {/* ==============================================================================
          COLUMNA DERECHA: FORMULARIO DE ACCESO (RF-01.1 Desktop & RF-01.2 Mobile)
          Fondo Claro (#FFFFFF o #F8F9FA)
         ============================================================================== */}
      <main className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 lg:p-12 relative">
        <div className="w-full max-w-md mx-auto space-y-6">
          {/* Encabezado del Formulario (RF-02.1) */}
          <div className="space-y-1.5 text-left">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {isRegister ? 'Crea tu cuenta' : 'Bienvenido de nuevo'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              {isRegister
                ? 'Regístrate para empezar a gestionar tus existencias.'
                : 'Introduce tus datos para acceder al panel.'}
            </p>
          </div>

          {/* Tarjeta del Formulario */}
          <Card className="p-6 sm:p-8 border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#1A2035]/60 shadow-xl dark:shadow-2xl space-y-5">
            {/* Mensajes de Feedback */}
            {errorMsg && (
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs text-rose-600 dark:text-rose-400 flex items-start gap-2.5 animate-in fade-in">
                <span className="font-bold">Error:</span>
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Campo Nombre Completo (solo en Registro) */}
              {isRegister && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Nombre Completo
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <Input
                      type="text"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      placeholder="Lucía Martín"
                      required={isRegister}
                      className="pl-10"
                    />
                  </div>
                </div>
              )}

              {/* Campo Correo Electrónico (RF-02.2) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <Input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="nombre@empresa.com"
                    required
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Campo Contraseña con Ojo de Visibilidad (RF-02.2) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Contraseña
                  </label>
                  {!isRegister && (
                    <button
                      type="button"
                      onClick={() => alert('Para restablecer tu contraseña, contacta al soporte o verifica tu correo registrado.')}
                      className="text-xs font-bold text-[#FF6B00] hover:underline transition-colors"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  )}
                </div>

                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="pl-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Acciones: Recordarme (RF-02.3) */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="rememberMe"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(Boolean(checked))}
                  />
                  <label
                    htmlFor="rememberMe"
                    className="text-xs font-medium text-slate-600 dark:text-slate-400 cursor-pointer select-none"
                  >
                    Recordarme en este dispositivo
                  </label>
                </div>
              </div>

              {/* Botón Principal CTA en Naranja Vibrante (#FF6B00) con Flecha (RF-02.3) */}
              <Button
                type="submit"
                variant="orange"
                disabled={loading}
                className="w-full h-12 text-sm font-bold flex items-center justify-center gap-2 group shadow-lg shadow-orange-500/25"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Verificando datos...
                  </>
                ) : (
                  <>
                    <span>{isRegister ? 'Crear mi cuenta' : 'Iniciar sesión'}</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
            </form>

            {/* Alternar entre Iniciar Sesión y Registro */}
            <div className="pt-2 text-center text-xs text-slate-500 dark:text-slate-400">
              {isRegister ? (
                <span>
                  ¿Ya tienes una cuenta?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegister(false);
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="font-bold text-[#FF6B00] hover:underline"
                  >
                    Inicia sesión aquí
                  </button>
                </span>
              ) : (
                <span>
                  ¿No tienes una cuenta aún?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegister(true);
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="font-bold text-[#FF6B00] hover:underline"
                  >
                    Regístrate gratis
                  </button>
                </span>
              )}
            </div>
          </Card>

          {/* Tarjeta Flotante de Acceso Demo (RF-02.3) */}
          <div
            onClick={handleFillDemo}
            className="p-3.5 bg-white dark:bg-[#1A2035]/80 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm hover:shadow-md cursor-pointer transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-orange-50 dark:bg-orange-950/40 text-[#FF6B00]">
                <Info className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-[#FF6B00] transition-colors">
                  Acceso de Demostración Rápida
                </p>
                <p className="text-[11px] text-slate-400">
                  Haz clic para rellenar automáticamente credenciales de prueba
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-[#FF6B00] group-hover:translate-x-0.5 transition-transform">
              Rellenar →
            </span>
          </div>
        </div>
      </main>
    </div>
  );
};
