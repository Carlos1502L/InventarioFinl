import React from 'react';
import { ChevronLeft, ShieldCheck, CheckCircle2, Cpu, Database, Trash2 } from 'lucide-react';

interface LegalPageProps {
  onBack?: () => void;
}

export const TermsPage: React.FC<LegalPageProps> = ({ onBack }) => {
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
          Términos de Servicio
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
              RF-LEGAL-001 / RF-LEGAL-002 · Legal
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Términos y Condiciones de Uso
            </h1>
            <p className="text-xs text-zinc-400 font-light">
              Última actualización: Noviembre de 2026. Al registrarte o utilizar la plataforma Stockly, aceptas las siguientes condiciones de servicio.
            </p>
          </div>

          {/* 1. Objeto */}
          <section className="p-5 sm:p-6 rounded-2xl bg-zinc-950 border border-zinc-900 space-y-2.5">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">
              01 // Objeto y Alcance del Servicio
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 font-light leading-relaxed">
              Stockly es una Progressive Web App (PWA) de gestión de inventarios, control de existencias, bodegas y terminal de punto de venta (POS), diseñada para operar de forma online y en modo offline diferido en dispositivos móviles y de escritorio.
            </p>
          </section>

          {/* 2. Recopilación de Datos */}
          <section className="p-5 sm:p-6 rounded-2xl bg-zinc-950 border border-zinc-900 space-y-3.5">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">
              02 // Cláusula de Recopilación de Datos
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 font-light leading-relaxed">
              Para brindar el servicio, se recopila exclusivamente la información estrictamente necesaria:
            </p>
            <ul className="space-y-2 text-xs sm:text-sm text-zinc-300">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <span><strong className="text-zinc-100">Correo de Registro:</strong> Identificador principal de cuenta, correo electrónico y credenciales seguras.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <span><strong className="text-zinc-100">Catálogo de Inventario:</strong> Nombres de productos, códigos de barra (EAN/UPC/QR), existencias, precios de costo y venta, categorías y ubicaciones de almacén.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <span><strong className="text-zinc-100">Registros de Ventas y Precios:</strong> Transacciones emitidas, fechas, montos liquidados, medios de pago y notas de despacho.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <span><strong className="text-zinc-100">Almacenamiento Técnico Local (PWA):</strong> Uso de IndexedDB y Service Workers en el navegador para garantizar operatividad y sincronización sin conexión.</span>
              </li>
            </ul>
          </section>

          {/* 3. Inteligencia Artificial */}
          <section className="p-5 sm:p-6 rounded-2xl bg-zinc-950 border border-zinc-900 space-y-3">
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-amber-400 bg-amber-950/40 px-2.5 py-0.5 rounded-md w-fit border border-amber-900/60 font-semibold">
              <Cpu className="w-3.5 h-3.5 text-amber-400" />
              <span>Inteligencia Artificial & Visión</span>
            </div>
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">
              03 // Cláusula de Procesamiento de IA
            </h2>
            <div className="space-y-2 text-xs sm:text-sm text-zinc-400 font-light leading-relaxed">
              <p>
                <strong className="text-zinc-200">Procesamiento Efímero:</strong> Las imágenes transmitidas mediante escaneo o cámara se procesan en memoria de manera estrictamente temporal para la extracción de códigos y detalles de producto. No se almacenan permanentemente en los servidores de inferencia.
              </p>
              <p>
                <strong className="text-zinc-200">Consentimiento y Propiedad Intelectual:</strong> El usuario otorga consentimiento expreso para dicho análisis sin que esto constituya cesión de propiedad intelectual. Los datos <strong className="text-zinc-200">nunca</strong> se utilizan para entrenar modelos fundacionales públicos de terceros.
              </p>
            </div>
          </section>

          {/* 4. Subencargados y Terceros */}
          <section className="p-5 sm:p-6 rounded-2xl bg-zinc-950 border border-zinc-900 space-y-3">
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-sky-400 bg-sky-950/40 px-2.5 py-0.5 rounded-md w-fit border border-sky-900/60 font-semibold">
              <Database className="w-3.5 h-3.5 text-sky-400" />
              <span>Infraestructura Cloud</span>
            </div>
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">
              04 // Transferencia a Terceros (Subencargados)
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 font-light leading-relaxed">
              Los datos transitan exclusivamente por proveedores tecnológicos certificados: Supabase / PostgreSQL (base de datos y auth cifrado), Vercel (distribución CDN segura) y APIs de visión multimodal bajo protocolos HTTPS.
            </p>
            <div className="p-3.5 bg-emerald-950/30 border border-emerald-900/60 rounded-xl text-xs text-emerald-300 font-medium flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>Los datos de inventario y negocio <strong>NO son vendidos, comercializados, alquilados ni cedidos a terceros con fines publicitarios</strong> bajo ninguna modalidad.</span>
            </div>
          </section>

          {/* 5. Derechos ARCO y Supresión */}
          <section className="p-5 sm:p-6 rounded-2xl bg-zinc-950 border border-zinc-900 space-y-3">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">
              05 // Derechos ARCO y Supresión de Cuenta (RF-AUTH-006)
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 font-light leading-relaxed">
              El usuario puede ejercer sus derechos de acceso, rectificación, cancelación y oposición. La eliminación definitiva e irrevocable de la cuenta puede ejecutarse directamente desde la sección Configuración &gt; Zona de Peligro, purgando irreversiblemente todos los datos vinculados.
            </p>
          </section>

          {/* Footer interno */}
          <div className="pt-6 border-t border-zinc-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500 font-mono">
            <span>© 2026 Stockly · Todos los derechos reservados.</span>
            <div className="flex items-center gap-3">
              <a href="/privacy" className="text-zinc-300 hover:text-white underline underline-offset-2">
                Ver Política de Privacidad
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

export default TermsPage;
