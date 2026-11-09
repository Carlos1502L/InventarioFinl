import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronDown,
  ShieldCheck,
  Check,
  FileText,
  Lock,
  Cpu
} from 'lucide-react';

export type LegalTab = 'terms' | 'privacy';

export interface LegalPageProps {
  onBack?: () => void;
  initialTab?: LegalTab;
}

interface ClauseItem {
  id: string;
  number: string;
  title: string;
  badge?: string;
  renderContent: () => React.ReactNode;
}

export const LegalCenterPage: React.FC<LegalPageProps> = ({
  onBack,
  initialTab = 'terms'
}) => {
  const [activeTab, setActiveTab] = useState<LegalTab>(() => {
    if (typeof window !== 'undefined') {
      if (window.location.pathname === '/privacy') return 'privacy';
      if (window.location.pathname === '/terms') return 'terms';
    }
    return initialTab;
  });

  // Estado independiente por cláusula (abierto/cerrado)
  const [openClauses, setOpenClauses] = useState<Record<string, boolean>>({
    'terms-1': true,
    'privacy-1': true
  });

  const handleBack = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('stockly_splash_shown', 'true');
    }
    if (onBack) {
      onBack();
    } else if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
    } else if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const handleTabChange = (newTab: LegalTab) => {
    setActiveTab(newTab);
    if (typeof window !== 'undefined') {
      const targetPath = newTab === 'terms' ? '/terms' : '/privacy';
      window.history.replaceState({}, '', targetPath);
    }
  };

  const toggleClause = (clauseId: string) => {
    setOpenClauses(prev => ({
      ...prev,
      [clauseId]: !prev[clauseId]
    }));
  };

  const setAllCurrentClauses = (open: boolean) => {
    const clausesToUpdate = activeTab === 'terms' ? TERMS_CLAUSES : PRIVACY_CLAUSES;
    setOpenClauses(prev => {
      const next = { ...prev };
      clausesToUpdate.forEach(c => {
        next[c.id] = open;
      });
      return next;
    });
  };

  // ============================================================================
  // DEFINICIÓN DE CONTENIDO: TÉRMINOS Y CONDICIONES DE USO
  // ============================================================================
  const TERMS_CLAUSES: ClauseItem[] = [
    {
      id: 'terms-1',
      number: '01',
      title: 'Objeto y Alcance del Servicio',
      badge: 'Alcance Operativo',
      renderContent: () => (
        <p className="text-neutral-600 font-normal leading-relaxed text-xs sm:text-sm">
          Stockly es una Progressive Web App (PWA) de gestión de inventarios, control de existencias, bodegas y terminal de punto de venta (POS), diseñada para operar de forma online y en modo offline diferido en dispositivos móviles y de escritorio.
        </p>
      )
    },
    {
      id: 'terms-2',
      number: '02',
      title: 'Cláusula de Recopilación de Datos',
      badge: 'Datos Recabados',
      renderContent: () => (
        <div className="space-y-3">
          <p className="text-neutral-600 font-normal leading-relaxed text-xs sm:text-sm">
            Para brindar el servicio, se recopila exclusivamente la información estrictamente necesaria:
          </p>
          <ul className="space-y-2.5 text-xs sm:text-sm text-neutral-800">
            <li className="flex items-start gap-2.5">
              <Check className="w-4 h-4 text-neutral-950 mt-0.5 shrink-0 stroke-[2.5]" />
              <span>
                <strong className="text-neutral-950 font-semibold">Correo de Registro:</strong> Identificador principal de cuenta, correo electrónico y credenciales seguras.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <Check className="w-4 h-4 text-neutral-950 mt-0.5 shrink-0 stroke-[2.5]" />
              <span>
                <strong className="text-neutral-950 font-semibold">Catálogo de Inventario:</strong> Nombres de productos, códigos de barra (EAN/UPC/QR), existencias, precios de costo y venta, categorías y ubicaciones de almacén.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <Check className="w-4 h-4 text-neutral-950 mt-0.5 shrink-0 stroke-[2.5]" />
              <span>
                <strong className="text-neutral-950 font-semibold">Registros de Ventas y Precios:</strong> Transacciones emitidas, fechas, montos liquidados, medios de pago y notas de despacho.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <Check className="w-4 h-4 text-neutral-950 mt-0.5 shrink-0 stroke-[2.5]" />
              <span>
                <strong className="text-neutral-950 font-semibold">Almacenamiento Técnico Local (PWA):</strong> Uso de IndexedDB y Service Workers en el navegador para garantizar operatividad y sincronización sin conexión.
              </span>
            </li>
          </ul>
        </div>
      )
    },
    {
      id: 'terms-3',
      number: '03',
      title: 'Procesamiento de Inteligencia Artificial y Visión',
      badge: 'IA & Privacidad',
      renderContent: () => (
        <div className="space-y-3 text-xs sm:text-sm text-neutral-600 leading-relaxed">
          <div className="bg-neutral-50 border border-neutral-200/80 rounded-2xl p-3.5 space-y-1 text-neutral-950">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-neutral-950 shrink-0" />
              <span className="font-bold text-xs uppercase tracking-wider text-neutral-950">
                Inferencia Multimodal Efímera
              </span>
            </div>
            <p className="text-xs text-neutral-600 leading-relaxed font-normal">
              El procesamiento asistido por cámara no almacena copias de fotografías ni metadatos personales una vez concluido el reconocimiento.
            </p>
          </div>
          <p>
            <strong className="text-neutral-950 font-semibold">Procesamiento Efímero:</strong> Las imágenes transmitidas mediante escaneo o cámara se procesan en memoria de manera estrictamente temporal para la extracción de códigos y detalles de producto. No se almacenan permanentemente en los servidores de inferencia.
          </p>
          <p>
            <strong className="text-neutral-950 font-semibold">Consentimiento y Propiedad Intelectual:</strong> El usuario otorga consentimiento expreso para dicho análisis sin que esto constituya cesión de propiedad intelectual. Los datos nunca se utilizan para entrenar modelos fundacionales públicos de terceros.
          </p>
        </div>
      )
    },
    {
      id: 'terms-4',
      number: '04',
      title: 'Transferencia a Terceros y Subencargados',
      badge: 'Proveedores Certificados',
      renderContent: () => (
        <div className="space-y-3 text-xs sm:text-sm text-neutral-600 leading-relaxed">
          <p>
            Los datos transitan exclusivamente por proveedores tecnológicos certificados: Supabase / PostgreSQL (base de datos y auth cifrado), Vercel (distribución CDN segura) y APIs de visión multimodal bajo protocolos HTTPS.
          </p>
          <div className="bg-neutral-950 text-white rounded-2xl p-4 space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-white shrink-0" />
              <span className="font-bold text-xs uppercase tracking-wider text-white">
                Garantía de No Comercialización
              </span>
            </div>
            <p className="text-xs text-neutral-300 font-normal leading-relaxed">
              Los datos de inventario y negocio NO son vendidos, comercializados, alquilados ni cedidos a terceros con fines publicitarios bajo ninguna modalidad.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'terms-5',
      number: '05',
      title: 'Derechos ARCO y Supresión de Cuenta',
      badge: 'Control Total',
      renderContent: () => (
        <div className="space-y-2 text-xs sm:text-sm text-neutral-600 leading-relaxed">
          <p>
            El usuario puede ejercer sus derechos de acceso, rectificación, cancelación y oposición. La eliminación definitiva e irrevocable de la cuenta puede ejecutarse directamente desde la sección Configuración &gt; Zona de Peligro, purgando irreversiblemente todos los datos vinculados.
          </p>
        </div>
      )
    }
  ];

  // ============================================================================
  // DEFINICIÓN DE CONTENIDO: POLÍTICA DE PRIVACIDAD
  // ============================================================================
  const PRIVACY_CLAUSES: ClauseItem[] = [
    {
      id: 'privacy-1',
      number: '01',
      title: 'Responsable y Encargado del Tratamiento',
      badge: 'Seguridad RLS',
      renderContent: () => (
        <p className="text-neutral-600 font-normal leading-relaxed text-xs sm:text-sm">
          Stockly opera como encargado técnico de la custodia de inventarios y datos de negocio introducidos por los usuarios en la PWA, respetando el aislamiento estricto de cada cuenta mediante políticas RLS en PostgreSQL.
        </p>
      )
    },
    {
      id: 'privacy-2',
      number: '02',
      title: 'Datos Tratados',
      badge: 'Estructura de Datos',
      renderContent: () => (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/80 space-y-1">
              <strong className="text-neutral-950 font-bold block text-xs">
                Cuenta y Perfil
              </strong>
              <p className="text-neutral-600 font-normal text-xs leading-relaxed">
                Correo de autenticación, nombre y roles asignados.
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/80 space-y-1">
              <strong className="text-neutral-950 font-bold block text-xs">
                Catálogo y Stock
              </strong>
              <p className="text-neutral-600 font-normal text-xs leading-relaxed">
                Productos, existencias, códigos, categorías y ubicaciones.
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/80 space-y-1">
              <strong className="text-neutral-950 font-bold block text-xs">
                Ventas y Precios
              </strong>
              <p className="text-neutral-600 font-normal text-xs leading-relaxed">
                Historial transaccional, comprobantes, montos y métodos de pago.
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/80 space-y-1">
              <strong className="text-neutral-950 font-bold block text-xs">
                Caché Local Offline
              </strong>
              <p className="text-neutral-600 font-normal text-xs leading-relaxed">
                IndexedDB y Service Workers para continuidad sin conexión.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'privacy-3',
      number: '03',
      title: 'Tratamiento de Imágenes e IA',
      badge: 'Análisis Efímero',
      renderContent: () => (
        <div className="space-y-3 text-xs sm:text-sm text-neutral-600 leading-relaxed">
          <p>
            El análisis multimodal de imágenes para escaneo de códigos y rótulos se ejecuta de forma estrictamente efímera. Las imágenes no se conservan tras la extracción y nunca son utilizadas para entrenar modelos públicos de terceros.
          </p>
        </div>
      )
    },
    {
      id: 'privacy-4',
      number: '04',
      title: 'Subencargados e Integridad Comercial',
      badge: 'Cifrado en Tránsito',
      renderContent: () => (
        <div className="space-y-3 text-xs sm:text-sm text-neutral-600 leading-relaxed">
          <p>
            La infraestructura opera sobre Supabase (PostgreSQL en AWS) y Vercel con comunicaciones cifradas en tránsito (TLS/HTTPS).
          </p>
          <div className="bg-neutral-950 text-white rounded-2xl p-4 space-y-1">
            <span className="font-bold text-xs uppercase tracking-wider text-white block">
              Declaración Expresa:
            </span>
            <p className="text-xs text-neutral-300 font-normal leading-relaxed">
              Tus datos de ventas, catálogo, clientes y márgenes comerciales NUNCA son comercializados, vendidos ni transferidos a terceros para fines publicitarios.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'privacy-5',
      number: '05',
      title: 'Derecho de Supresión Total',
      badge: 'Purga Permanente',
      renderContent: () => (
        <div className="space-y-2 text-xs sm:text-sm text-neutral-600 leading-relaxed">
          <p>
            El usuario puede ejercer en cualquier momento la eliminación definitiva de su cuenta desde Ajustes &gt; Zona de Peligro. La confirmación desencadena la purga permanente de los datos en el servidor y la limpieza total de bases locales en el navegador.
          </p>
        </div>
      )
    }
  ];

  const currentClauses = activeTab === 'terms' ? TERMS_CLAUSES : PRIVACY_CLAUSES;
  const allCurrentOpen = currentClauses.every(c => openClauses[c.id]);

  return (
    <div className="fixed inset-0 z-50 bg-white text-neutral-900 flex flex-col h-[100dvh] overflow-hidden select-none font-sans">
      {/* =========================================================
          1. HEADER OSCURO NATIVO MÓVIL (Con orbes y esquinas redondeadas)
         ========================================================= */}
      <header className="shrink-0 bg-neutral-950 text-white rounded-b-[2.5rem] z-20 select-none px-6 pt-[max(1.25rem,env(safe-area-inset-top))] pb-6 transition-all duration-300 relative overflow-hidden shadow-sm">
        {/* Orbes de luz ambiental de fondo */}
        <div className="absolute -top-12 -right-8 w-52 h-52 rounded-full bg-sky-500/15 blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 -left-12 w-52 h-52 rounded-full bg-indigo-500/15 blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between gap-4 relative z-10 max-w-xl mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={handleBack}
              className="w-10 h-10 rounded-full border border-neutral-700/80 bg-neutral-900/80 hover:bg-neutral-800 text-neutral-200 flex items-center justify-center transition-colors active:scale-95 shadow-xs shrink-0 cursor-pointer"
              aria-label="Volver"
            >
              <ChevronLeft className="w-5 h-5 stroke-[2]" />
            </button>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-white truncate">
                Centro Legal
              </h1>
              <p className="text-xs text-neutral-400 truncate mt-0.5 font-medium">
                Términos y Privacidad de Stockly
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-neutral-800/80 text-neutral-300 text-xs font-medium tabular-nums border border-neutral-700/60">
              Nov 2026
            </span>
          </div>
        </div>
      </header>

      {/* =========================================================
          2. CUERPO BLANCO GLOBAL CON SCROLL TÁCTIL NATIVO
         ========================================================= */}
      <main
        className="flex-1 min-h-0 w-full bg-white overflow-y-auto overscroll-contain px-5 pt-4 pb-[max(2.5rem,env(safe-area-inset-bottom))]"
        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
      >
        <div className="max-w-xl mx-auto space-y-4">
          {/* =========================================================
              SELECTOR NATIVO MÓVIL (Segmented Control)
             ========================================================= */}
          <div
            role="tablist"
            aria-label="Secciones del Centro Legal"
            className="p-1 bg-neutral-100 rounded-2xl flex items-center select-none"
          >
            <button
              type="button"
              role="tab"
              id="tab-terms"
              aria-controls="panel-terms"
              aria-selected={activeTab === 'terms'}
              onClick={() => handleTabChange('terms')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'terms'
                  ? 'bg-white text-neutral-950 shadow-xs font-bold'
                  : 'text-neutral-500 hover:text-neutral-950'
              }`}
            >
              <FileText className={`w-4 h-4 ${activeTab === 'terms' ? 'text-neutral-950' : 'text-neutral-400'}`} />
              <span className="truncate">Términos de Uso</span>
            </button>

            <button
              type="button"
              role="tab"
              id="tab-privacy"
              aria-controls="panel-privacy"
              aria-selected={activeTab === 'privacy'}
              onClick={() => handleTabChange('privacy')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'privacy'
                  ? 'bg-white text-neutral-950 shadow-xs font-bold'
                  : 'text-neutral-500 hover:text-neutral-950'
              }`}
            >
              <Lock className={`w-4 h-4 ${activeTab === 'privacy' ? 'text-neutral-950' : 'text-neutral-400'}`} />
              <span className="truncate">Privacidad y Datos</span>
            </button>
          </div>

          {/* =========================================================
              TARJETA EDITORIAL DE ENCABEZADO
             ========================================================= */}
          <div className="bg-neutral-50 border border-neutral-200/80 rounded-3xl p-5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                {activeTab === 'terms' ? 'Condiciones de Servicio' : 'Protección de Datos'}
              </span>
              <button
                type="button"
                onClick={() => setAllCurrentClauses(!allCurrentOpen)}
                className="text-xs font-semibold text-neutral-700 hover:text-neutral-950 underline underline-offset-2 cursor-pointer"
              >
                {allCurrentOpen ? 'Colapsar todo' : 'Expandir todo'}
              </button>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-neutral-950 tracking-tight">
              {activeTab === 'terms' ? 'Términos y Condiciones de Uso' : 'Política de Privacidad y Datos'}
            </h2>
            <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed font-normal">
              {activeTab === 'terms'
                ? 'Última actualización: Noviembre de 2026. Al registrarte o utilizar la plataforma Stockly, aceptas las siguientes condiciones de servicio.'
                : 'Garantizamos la confidencialidad absoluta de tu información comercial y el control total de tus datos.'}
            </p>
          </div>

          {/* =========================================================
              ACORDEÓN DE CLÁUSULAS CON ESTILO MÓVIL
             ========================================================= */}
          <div
            id={activeTab === 'terms' ? 'panel-terms' : 'panel-privacy'}
            role="tabpanel"
            aria-labelledby={activeTab === 'terms' ? 'tab-terms' : 'tab-privacy'}
            className="space-y-3 select-text"
          >
            {currentClauses.map(clause => {
              const isOpen = Boolean(openClauses[clause.id]);

              return (
                <div
                  key={clause.id}
                  className={`bg-white border rounded-3xl transition-all duration-200 overflow-hidden ${
                    isOpen
                      ? 'border-neutral-950/25 shadow-sm'
                      : 'border-neutral-200/80 hover:border-neutral-300'
                  }`}
                >
                  {/* Encabezado Táctil */}
                  <button
                    type="button"
                    id={`clause-header-${clause.id}`}
                    aria-expanded={isOpen}
                    aria-controls={`clause-content-${clause.id}`}
                    onClick={() => toggleClause(clause.id)}
                    className="w-full flex items-center justify-between gap-3 p-4 sm:p-5 text-left cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-8 h-8 rounded-full bg-neutral-100 border border-neutral-200/80 flex items-center justify-center font-bold text-xs text-neutral-950 shrink-0">
                        {clause.number}
                      </span>
                      <div className="min-w-0">
                        <span className="font-bold text-sm text-neutral-950 block truncate">
                          {clause.title}
                        </span>
                        {clause.badge && (
                          <span className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider block mt-0.5">
                            {clause.badge}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Botón Circular Chevron Móvil con rotación 180° */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 shrink-0 ${
                        isOpen
                          ? 'bg-neutral-950 text-white rotate-180'
                          : 'bg-neutral-100 text-neutral-700'
                      }`}
                    >
                      <ChevronDown className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
                    </div>
                  </button>

                  {/* Contenedor del contenido con animación de altura y opacidad */}
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        id={`clause-content-${clause.id}`}
                        role="region"
                        aria-labelledby={`clause-header-${clause.id}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.28, ease: [0.04, 0.62, 0.23, 0.98] }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 pt-1 border-t border-neutral-100 text-neutral-600 text-xs sm:text-sm leading-relaxed">
                          {clause.renderContent()}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          {/* =========================================================
              PIE EDITORIAL MÓVIL
             ========================================================= */}
          <footer className="pt-6 pb-4 border-t border-neutral-100 flex flex-col items-center gap-3 text-center text-xs text-neutral-500">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleTabChange(activeTab === 'terms' ? 'privacy' : 'terms')}
                className="text-neutral-950 font-semibold underline underline-offset-2 hover:text-neutral-700 cursor-pointer"
              >
                {activeTab === 'terms' ? 'Ver Política de Privacidad' : 'Ver Términos de Servicio'}
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={handleBack}
                className="text-neutral-950 font-semibold underline underline-offset-2 hover:text-neutral-700 cursor-pointer"
              >
                Volver
              </button>
            </div>
            <p className="text-[11px] text-neutral-400">
              © 2026 Stockly PWA. Todos los derechos reservados.
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
};

export default LegalCenterPage;
