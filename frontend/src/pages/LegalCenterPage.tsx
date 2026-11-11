import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronDown } from 'lucide-react';

export type LegalTab = 'terms' | 'privacy';

export interface LegalPageProps {
  onBack?: () => void;
  initialTab?: LegalTab;
}

interface ClauseItem {
  id: string;
  title: string;
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
      title: '01 // Objeto y Alcance del Servicio',
      renderContent: () => (
        <p className="text-neutral-600 font-normal leading-relaxed text-xs sm:text-sm">
          Stockly es una Progressive Web App (PWA) de gestión de inventarios, control de existencias, bodegas y terminal de punto de venta (POS), diseñada para operar de forma online y en modo offline diferido en dispositivos móviles y de escritorio.
        </p>
      )
    },
    {
      id: 'terms-2',
      title: '02 // Cláusula de Recopilación de Datos',
      renderContent: () => (
        <div className="space-y-3 text-xs sm:text-sm text-neutral-600">
          <p className="font-normal leading-relaxed">
            Para brindar el servicio, se recopila exclusivamente la información estrictamente necesaria:
          </p>
          <ul className="space-y-2 border-l border-neutral-200 pl-3.5 text-neutral-700">
            <li className="leading-relaxed">
              <span className="font-semibold text-neutral-900">Correo de Registro:</span> Identificador principal de cuenta, correo electrónico y credenciales seguras.
            </li>
            <li className="leading-relaxed">
              <span className="font-semibold text-neutral-900">Catálogo de Inventario:</span> Nombres de productos, códigos de barra (EAN/UPC/QR), existencias, precios de costo y venta, categorías y ubicaciones de almacén.
            </li>
            <li className="leading-relaxed">
              <span className="font-semibold text-neutral-900">Registros de Ventas y Precios:</span> Transacciones emitidas, fechas, montos liquidados, medios de pago y notas de despacho.
            </li>
            <li className="leading-relaxed">
              <span className="font-semibold text-neutral-900">Almacenamiento Técnico Local (PWA):</span> Uso de IndexedDB y Service Workers en el navegador para garantizar operatividad y sincronización sin conexión.
            </li>
          </ul>
        </div>
      )
    },
    {
      id: 'terms-3',
      title: '03 // Procesamiento de Inteligencia Artificial y Visión',
      renderContent: () => (
        <div className="space-y-3 text-xs sm:text-sm text-neutral-600 leading-relaxed font-normal">
          <p>
            <strong className="text-neutral-900 font-semibold">Procesamiento Efímero:</strong> Las imágenes transmitidas mediante escaneo o cámara se procesan en memoria de manera estrictamente temporal para la extracción de códigos y detalles de producto. No se almacenan permanentemente en los servidores de inferencia.
          </p>
          <p>
            <strong className="text-neutral-900 font-semibold">Consentimiento y Propiedad Intelectual:</strong> El usuario otorga consentimiento expreso para dicho análisis sin que esto constituya cesión de propiedad intelectual. Los datos nunca se utilizan para entrenar modelos fundacionales públicos de terceros.
          </p>
        </div>
      )
    },
    {
      id: 'terms-4',
      title: '04 // Transferencia a Terceros y Subencargados',
      renderContent: () => (
        <div className="space-y-3 text-xs sm:text-sm text-neutral-600 leading-relaxed font-normal">
          <p>
            Los datos transitan exclusivamente por proveedores tecnológicos certificados: Supabase / PostgreSQL (base de datos y auth cifrado), Vercel (distribución CDN segura) y APIs de visión multimodal bajo protocolos HTTPS.
          </p>
          <div className="border-l-2 border-neutral-950 pl-3.5 py-0.5 text-neutral-900 font-medium">
            Los datos de inventario y negocio NO son vendidos, comercializados, alquilados ni cedidos a terceros con fines publicitarios bajo ninguna modalidad.
          </div>
        </div>
      )
    },
    {
      id: 'terms-5',
      title: '05 // Derechos ARCO y Supresión de Cuenta',
      renderContent: () => (
        <p className="text-neutral-600 font-normal leading-relaxed text-xs sm:text-sm">
          El usuario puede ejercer sus derechos de acceso, rectificación, cancelación y oposición. La eliminación definitiva e irrevocable de la cuenta puede ejecutarse directamente desde la sección Configuración &gt; Zona de Peligro, purgando irreversiblemente todos los datos vinculados.
        </p>
      )
    }
  ];

  // ============================================================================
  // DEFINICIÓN DE CONTENIDO: POLÍTICA DE PRIVACIDAD
  // ============================================================================
  const PRIVACY_CLAUSES: ClauseItem[] = [
    {
      id: 'privacy-1',
      title: '01 // Responsable y Encargado del Tratamiento',
      renderContent: () => (
        <p className="text-neutral-600 font-normal leading-relaxed text-xs sm:text-sm">
          Stockly opera como encargado técnico de la custodia de inventarios y datos de negocio introducidos por los usuarios en la PWA, respetando el aislamiento estricto de cada cuenta mediante políticas RLS en PostgreSQL.
        </p>
      )
    },
    {
      id: 'privacy-2',
      title: '02 // Datos Tratados',
      renderContent: () => (
        <ul className="space-y-2 border-l border-neutral-200 pl-3.5 text-xs sm:text-sm text-neutral-700">
          <li className="leading-relaxed">
            <span className="font-semibold text-neutral-900">Cuenta y Perfil:</span> Correo de autenticación, nombre y roles asignados.
          </li>
          <li className="leading-relaxed">
            <span className="font-semibold text-neutral-900">Catálogo y Stock:</span> Productos, existencias, códigos, categorías y ubicaciones.
          </li>
          <li className="leading-relaxed">
            <span className="font-semibold text-neutral-900">Ventas y Precios:</span> Historial transaccional, comprobantes, montos y métodos de pago.
          </li>
          <li className="leading-relaxed">
            <span className="font-semibold text-neutral-900">Caché Local Offline:</span> IndexedDB y Service Workers para continuidad sin conexión.
          </li>
        </ul>
      )
    },
    {
      id: 'privacy-3',
      title: '03 // Tratamiento de Imágenes e IA',
      renderContent: () => (
        <p className="text-neutral-600 font-normal leading-relaxed text-xs sm:text-sm">
          El análisis multimodal de imágenes para escaneo de códigos y rótulos se ejecuta de forma estrictamente efímera. Las imágenes no se conservan tras la extracción y nunca son utilizadas para entrenar modelos públicos de terceros.
        </p>
      )
    },
    {
      id: 'privacy-4',
      title: '04 // Subencargados e Integridad Comercial',
      renderContent: () => (
        <div className="space-y-3 text-xs sm:text-sm text-neutral-600 leading-relaxed font-normal">
          <p>
            La infraestructura opera sobre Supabase (PostgreSQL en AWS) y Vercel con comunicaciones cifradas en tránsito (TLS/HTTPS).
          </p>
          <div className="border-l-2 border-neutral-950 pl-3.5 py-0.5 text-neutral-900 font-medium">
            <span className="font-semibold">Declaración Expresa:</span> Tus datos de ventas, catálogo, clientes y márgenes comerciales NUNCA son comercializados, vendidos ni transferidos a terceros para fines publicitarios.
          </div>
        </div>
      )
    },
    {
      id: 'privacy-5',
      title: '05 // Derecho de Supresión Total',
      renderContent: () => (
        <p className="text-neutral-600 font-normal leading-relaxed text-xs sm:text-sm">
          El usuario puede ejercer en cualquier momento la eliminación definitiva de su cuenta desde Ajustes &gt; Zona de Peligro. La confirmación desencadena la purga permanente de los datos en el servidor y la limpieza total de bases locales en el navegador.
        </p>
      )
    }
  ];

  const currentClauses = activeTab === 'terms' ? TERMS_CLAUSES : PRIVACY_CLAUSES;
  const allCurrentOpen = currentClauses.every(c => openClauses[c.id]);

  return (
    <div className="fixed inset-0 z-50 bg-white text-neutral-900 flex flex-col h-[100dvh] overflow-hidden select-none font-sans selection:bg-neutral-950 selection:text-white">
      {/* =========================================================
          1. HEADER SOBRIO / FLAT CLEAN (Estilo iOS / HIG)
         ========================================================= */}
      <header className="shrink-0 bg-white/95 backdrop-blur-md border-b border-neutral-200/80 px-5 sm:px-8 py-3.5 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1 text-sm font-medium text-neutral-700 hover:text-neutral-950 active:opacity-60 transition-opacity cursor-pointer -ml-1.5 py-1 px-1.5"
            aria-label="Volver"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2]" />
            <span>Volver</span>
          </button>

          <span className="text-xs font-semibold tracking-wider uppercase text-neutral-400 font-mono">
            Stockly Legal
          </span>

          <span className="text-xs text-neutral-400 font-mono tabular-nums">
            Nov 2026
          </span>
        </div>
      </header>

      {/* =========================================================
          2. CONTENIDO PRINCIPAL: ESPACIO EN BLANCO Y LISTA PLANA
         ========================================================= */}
      <main
        className="flex-1 overflow-y-auto px-5 sm:px-8 py-6 sm:py-8 overscroll-contain pb-[max(3rem,env(safe-area-inset-bottom))]"
        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
      >
        <div className="max-w-2xl mx-auto space-y-6">
          {/* =========================================================
              TABS CON DIVISOR SUTIL (Underline Nav estilo iOS)
             ========================================================= */}
          <nav
            role="tablist"
            aria-label="Pestañas del Centro Legal"
            className="flex items-center gap-8 border-b border-neutral-200"
          >
            <button
              type="button"
              role="tab"
              id="tab-terms"
              aria-controls="panel-terms"
              aria-selected={activeTab === 'terms'}
              onClick={() => handleTabChange('terms')}
              className={`pb-3 text-sm transition-colors relative cursor-pointer ${
                activeTab === 'terms'
                  ? 'text-neutral-950 font-semibold'
                  : 'text-neutral-500 hover:text-neutral-800 font-normal'
              }`}
            >
              <span>Términos y Condiciones</span>
              {activeTab === 'terms' && (
                <motion.div
                  layoutId="legalTabUnderline"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-950"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
            </button>

            <button
              type="button"
              role="tab"
              id="tab-privacy"
              aria-controls="panel-privacy"
              aria-selected={activeTab === 'privacy'}
              onClick={() => handleTabChange('privacy')}
              className={`pb-3 text-sm transition-colors relative cursor-pointer ${
                activeTab === 'privacy'
                  ? 'text-neutral-950 font-semibold'
                  : 'text-neutral-500 hover:text-neutral-800 font-normal'
              }`}
            >
              <span>Política de Privacidad</span>
              {activeTab === 'privacy' && (
                <motion.div
                  layoutId="legalTabUnderline"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-950"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
            </button>
          </nav>

          {/* =========================================================
              ENCABEZADO EDITORIAL DE SECCIÓN (Whitespace & Tipografía)
             ========================================================= */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-baseline justify-between gap-4">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-950">
                {activeTab === 'terms'
                  ? 'Términos y Condiciones de Uso'
                  : 'Política de Privacidad y Datos'}
              </h1>
              <button
                type="button"
                onClick={() => setAllCurrentClauses(!allCurrentOpen)}
                className="text-xs text-neutral-500 hover:text-neutral-950 transition-colors cursor-pointer shrink-0"
              >
                {allCurrentOpen ? 'Colapsar todo' : 'Expandir todo'}
              </button>
            </div>
            <p className="text-xs sm:text-sm text-neutral-500 leading-relaxed font-normal">
              {activeTab === 'terms'
                ? 'Última actualización: Noviembre de 2026. Al registrarte o utilizar la plataforma Stockly, aceptas las siguientes condiciones de servicio.'
                : 'Garantizamos la confidencialidad absoluta de tu información comercial y el control total de tus datos.'}
            </p>
          </div>

          {/* =========================================================
              LISTA PLANA CON ACORDEÓN BASADO EN LÍNEAS (Flush List)
             ========================================================= */}
          <div
            id={activeTab === 'terms' ? 'panel-terms' : 'panel-privacy'}
            role="tabpanel"
            aria-labelledby={activeTab === 'terms' ? 'tab-terms' : 'tab-privacy'}
            className="divide-y divide-neutral-200 border-y border-neutral-200 select-text"
          >
            {currentClauses.map(clause => {
              const isOpen = Boolean(openClauses[clause.id]);

              return (
                <div key={clause.id} className="transition-colors">
                  <button
                    type="button"
                    id={`clause-header-${clause.id}`}
                    aria-expanded={isOpen}
                    aria-controls={`clause-content-${clause.id}`}
                    onClick={() => toggleClause(clause.id)}
                    className="w-full py-4 sm:py-4.5 flex items-center justify-between gap-4 text-left cursor-pointer select-none group focus-visible:outline-none"
                  >
                    <span className="text-sm sm:text-base font-semibold text-neutral-900 group-hover:text-neutral-600 transition-colors">
                      {clause.title}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-neutral-400 group-hover:text-neutral-900 transition-transform duration-200 ease-out shrink-0 ${
                        isOpen ? 'rotate-180 text-neutral-950' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        id={`clause-content-${clause.id}`}
                        role="region"
                        aria-labelledby={`clause-header-${clause.id}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="pb-5 pt-0.5 text-xs sm:text-sm text-neutral-600 leading-relaxed font-normal">
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
              PIE EDITORIAL MINIMALISTA
             ========================================================= */}
          <footer className="pt-6 pb-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-400">
            <span>© 2026 Stockly PWA. Todos los derechos reservados.</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleTabChange(activeTab === 'terms' ? 'privacy' : 'terms')}
                className="text-neutral-600 hover:text-neutral-950 underline underline-offset-2 transition-colors cursor-pointer"
              >
                {activeTab === 'terms' ? 'Política de Privacidad' : 'Términos de Servicio'}
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={handleBack}
                className="text-neutral-600 hover:text-neutral-950 underline underline-offset-2 transition-colors cursor-pointer"
              >
                Volver
              </button>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
};

export default LegalCenterPage;
