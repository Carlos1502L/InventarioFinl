import React from 'react';
import { ChevronLeft, ShieldCheck, CheckCircle2, Cpu, Database, Lock } from 'lucide-react';

interface LegalPageProps {
  onBack?: () => void;
}

export const PrivacyPage: React.FC<LegalPageProps> = ({ onBack }) => {
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
    } else {
      window.location.replace('/');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black text-zinc-100 flex flex-col h-[100dvh] overflow-hidden selection:bg-white selection:text-black font-sans">
      {/* Header fijo móvil con botón de retorno explícito */}
      <header className="flex items-center justify-between px-5 py-4 border-b border-zinc-900 bg-black/90 backdrop-blur-md sticky top-0 z-10 shrink-0 select-none">
        <button
          type="button"
          onClick={handleBack}
          className="p-2 -ml-2 text-zinc-400 hover:text-white active:scale-95 transition-transform flex items-center gap-1.5 text-sm cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5 stroke-[2]" />
          <span>Atrás</span>
        </button>
        <span className="font-semibold text-sm text-zinc-200 tracking-tight">
          Política de Privacidad
        </span>
        <div className="w-14 text-right">
          <span className="text-[10px] font-mono text-zinc-500 uppercase">v2.4</span>
        </div>
      </header>

      {/* Contenedor scrolleable táctil nativo */}
      <div
        className="flex-1 overflow-y-auto px-5 sm:px-8 py-6 space-y-6 text-sm text-zinc-300 leading-relaxed overscroll-contain pb-[max(2.5rem,env(safe-area-inset-bottom))]"
        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
      >
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Cabecera */}
          <div className="border-b border-zinc-900 pb-5 space-y-2">
            <span className="text-[11px] font-mono uppercase tracking-widest text-zinc-500 font-semibold block">
              RF-LEGAL-001 / RF-LEGAL-002 · Privacidad
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Política de Privacidad y Datos
            </h1>
            <p className="text-xs text-zinc-400 font-light">
              Garantizamos la confidencialidad absoluta de tu información comercial y el control total de tus datos.
            </p>
          </div>

          {/* 1. Responsable */}
          <section className="p-5 sm:p-6 rounded-2xl bg-zinc-950 border border-zinc-900 space-y-2.5">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">
              01 // Responsable y Encargado del Tratamiento
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 font-light leading-relaxed">
              Stockly opera como encargado técnico de la custodia de inventarios y datos de negocio introducidos por los usuarios en la PWA, respetando el aislamiento estricto de cada cuenta mediante políticas RLS en PostgreSQL.
            </p>
          </section>

          {/* 2. Categorías de Datos */}
          <section className="p-5 sm:p-6 rounded-2xl bg-zinc-950 border border-zinc-900 space-y-3.5">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">
              02 // Datos Tratados
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
                <strong className="text-zinc-100 block">Cuenta y Perfil</strong>
                <p className="text-zinc-400 font-light text-xs">Correo de autenticación, nombre y roles asignados.</p>
              </div>
              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
                <strong className="text-zinc-100 block">Catálogo y Stock</strong>
                <p className="text-zinc-400 font-light text-xs">Productos, existencias, códigos, categorías y ubicaciones.</p>
              </div>
              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
                <strong className="text-zinc-100 block">Ventas y Precios</strong>
                <p className="text-zinc-400 font-light text-xs">Historial transaccional, comprobantes, montos y métodos de pago.</p>
              </div>
              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
                <strong className="text-zinc-100 block">Caché Local Offline</strong>
                <p className="text-zinc-400 font-light text-xs">IndexedDB y Service Workers para continuidad sin conexión.</p>
              </div>
            </div>
          </section>

          {/* 3. Inteligencia Artificial */}
          <section className="p-5 sm:p-6 rounded-2xl bg-zinc-950 border border-zinc-900 space-y-3">
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-amber-400 bg-amber-950/40 px-2.5 py-0.5 rounded-md w-fit border border-amber-900/60 font-semibold">
              <Cpu className="w-3.5 h-3.5 text-amber-400" />
              <span>Modelos de Inferencia</span>
            </div>
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">
              03 // Tratamiento de Imágenes & IA
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 font-light leading-relaxed">
              El análisis multimodal de imágenes para escaneo de códigos y rótulos se ejecuta de forma estrictamente efímera. Las imágenes no se conservan tras la extracción y nunca son utilizadas para entrenar modelos públicos de terceros.
            </p>
          </section>

          {/* 4. Subencargados y No Venta */}
          <section className="p-5 sm:p-6 rounded-2xl bg-zinc-950 border border-zinc-900 space-y-3">
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-emerald-400 bg-emerald-950/40 px-2.5 py-0.5 rounded-md w-fit border border-emerald-900/60 font-semibold">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Privacidad Garantizada</span>
            </div>
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">
              04 // Subencargados e Integridad Comercial
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 font-light leading-relaxed">
              La infraestructura opera sobre Supabase (PostgreSQL en AWS) y Vercel con comunicaciones cifradas en tránsito (TLS/HTTPS).
            </p>
            <div className="p-3.5 bg-emerald-950/30 border border-emerald-900/60 rounded-xl text-xs text-emerald-300 font-semibold leading-relaxed">
              DECLARACIÓN EXPRESA: Tus datos de ventas, catálogo, clientes y márgenes comerciales NUNCA son comercializados, vendidos ni transferidos a terceros para fines publicitarios.
            </div>
          </section>

          {/* 5. Supresión de Cuenta */}
          <section className="p-5 sm:p-6 rounded-2xl bg-zinc-950 border border-zinc-900 space-y-3">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">
              05 // Derecho de Supresión Total (RF-AUTH-006)
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 font-light leading-relaxed">
              El usuario puede ejercer en cualquier momento la eliminación definitiva de su cuenta desde Ajustes &gt; Zona de Peligro. La confirmación desencadena la purga permanente de los datos en el servidor y la limpieza total de bases locales en el navegador.
            </p>
          </section>

          {/* Footer interno */}
          <div className="pt-6 border-t border-zinc-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500 font-mono">
            <span>© 2026 Stockly · Todos los derechos reservados.</span>
            <div className="flex items-center gap-3">
              <a href="/terms" className="text-zinc-300 hover:text-white underline underline-offset-2">
                Ver Términos de Servicio
              </a>
              <span>·</span>
              <button
                type="button"
                onClick={handleBack}
                className="text-zinc-300 hover:text-white underline underline-offset-2 cursor-pointer"
              >
                Volver a la App
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPage;
