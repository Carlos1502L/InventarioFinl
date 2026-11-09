import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronDown,
  ShieldCheck,
  CheckCircle2,
  FileText,
  Lock,
  Cpu,
  Database,
  ArrowRight,
  ExternalLink
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

  // Estado de los acordeones: id -> boolean (abierto/cerrado)
  // Por defecto la primera cláusula de cada sección se presenta abierta para invitar a la interacción
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
        <p className="text-slate-600 font-normal leading-relaxed text-sm">
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
        <div className="space-y-3.5">
          <p className="text-slate-600 font-normal leading-relaxed text-sm">
            Para brindar el servicio, se recopila exclusivamente la información estrictamente necesaria:
          </p>
          <ul className="space-y-2.5 text-sm text-slate-700">
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <span>
                <strong className="text-slate-900 font-semibold">Correo de Registro:</strong> Identificador principal de cuenta, correo electrónico y credenciales seguras.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <span>
                <strong className="text-slate-900 font-semibold">Catálogo de Inventario:</strong> Nombres de productos, códigos de barra (EAN/UPC/QR), existencias, precios de costo y venta, categorías y ubicaciones de almacén.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <span>
                <strong className="text-slate-900 font-semibold">Registros de Ventas y Precios:</strong> Transacciones emitidas, fechas, montos liquidados, medios de pago y notas de despacho.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <span>
                <strong className="text-slate-900 font-semibold">Almacenamiento Técnico Local (PWA):</strong> Uso de IndexedDB y Service Workers en el navegador para garantizar operatividad y sincronización sin conexión.
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
        <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
          <div className="flex items-start gap-2.5 bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5 text-amber-950">
            <Cpu className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <span className="font-semibold text-xs uppercase tracking-wider text-amber-900 block">
                Inferencia Multimodal Efímera
              </span>
              <p className="text-xs text-amber-900/90 leading-relaxed">
                El procesamiento asistido por cámara no almacena copias de fotografías ni metadatos personales una vez concluido el reconocimiento.
              </p>
            </div>
          </div>
          <p>
            <strong className="text-slate-900 font-semibold">Procesamiento Efímero:</strong> Las imágenes transmitidas mediante escaneo o cámara se procesan en memoria de manera estrictamente temporal para la extracción de códigos y detalles de producto. No se almacenan permanentemente en los servidores de inferencia.
          </p>
          <p>
            <strong className="text-slate-900 font-semibold">Consentimiento y Propiedad Intelectual:</strong> El usuario otorga consentimiento expreso para dicho análisis sin que esto constituya cesión de propiedad intelectual. Los datos nunca se utilizan para entrenar modelos fundacionales públicos de terceros.
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
        <div className="space-y-3.5 text-sm text-slate-600 leading-relaxed">
          <p>
            Los datos transitan exclusivamente por proveedores tecnológicos certificados: Supabase / PostgreSQL (base de datos y auth cifrado), Vercel (distribución CDN segura) y APIs de visión multimodal bajo protocolos HTTPS.
          </p>
          <div className="flex items-start gap-3 bg-emerald-50/80 border border-emerald-200/90 rounded-xl p-3.5 text-emerald-950">
            <ShieldCheck className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
            <div className="space-y-0.5">
              <strong className="text-emerald-900 font-semibold text-xs uppercase tracking-wider block">
                Garantía de No Comercialización
              </strong>
              <p className="text-xs text-emerald-900/90 font-medium">
                Los datos de inventario y negocio NO son vendidos, comercializados, alquilados ni cedidos a terceros con fines publicitarios bajo ninguna modalidad.
              </p>
            </div>
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
        <div className="space-y-2.5 text-sm text-slate-600 leading-relaxed">
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
        <p className="text-slate-600 font-normal leading-relaxed text-sm">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 space-y-1">
              <strong className="text-slate-900 font-semibold block text-xs uppercase tracking-wider">
                Cuenta y Perfil
              </strong>
              <p className="text-slate-600 text-xs font-normal">
                Correo de autenticación, nombre y roles asignados.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 space-y-1">
              <strong className="text-slate-900 font-semibold block text-xs uppercase tracking-wider">
                Catálogo y Stock
              </strong>
              <p className="text-slate-600 text-xs font-normal">
                Productos, existencias, códigos, categorías y ubicaciones.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 space-y-1">
              <strong className="text-slate-900 font-semibold block text-xs uppercase tracking-wider">
                Ventas y Precios
              </strong>
              <p className="text-slate-600 text-xs font-normal">
                Historial transaccional, comprobantes, montos y métodos de pago.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 space-y-1">
              <strong className="text-slate-900 font-semibold block text-xs uppercase tracking-wider">
                Caché Local Offline
              </strong>
              <p className="text-slate-600 text-xs font-normal">
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
        <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
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
        <div className="space-y-3.5 text-sm text-slate-600 leading-relaxed">
          <p>
            La infraestructura opera sobre Supabase (PostgreSQL en AWS) y Vercel con comunicaciones cifradas en tránsito (TLS/HTTPS).
          </p>
          <div className="bg-emerald-50/80 border border-emerald-200/90 rounded-xl p-3.5 text-emerald-950 space-y-1">
            <span className="font-bold text-xs uppercase tracking-wider text-emerald-900 block">
              Declaración Expresa:
            </span>
            <p className="text-xs text-emerald-900 font-medium leading-relaxed">
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
        <div className="space-y-2.5 text-sm text-slate-600 leading-relaxed">
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
    <div className="fixed inset-0 z-50 bg-[#F8F9FA] text-slate-900 flex flex-col h-[100dvh] overflow-hidden selection:bg-[#1E3A5F] selection:text-white font-sans">
      {/* =========================================================
          ENCABEZADO FIJO SUPERIOR: NAVEGACIÓN Y MARCA
         ========================================================= */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-3.5 sticky top-0 z-30 shrink-0 shadow-xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-[#1E3A5F] bg-slate-100/80 hover:bg-slate-200/70 active:scale-95 rounded-xl transition-all cursor-pointer border border-slate-200/60"
            aria-label="Volver a la pantalla anterior"
          >
            <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
            <span>Volver</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#1E3A5F] text-[#E8B4A0] flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-4 h-4 stroke-[2]" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xs uppercase tracking-wider text-[#1E3A5F]">
                Stockly Legal
              </span>
              <span className="text-[10px] text-slate-500 font-medium hidden sm:inline">
                Centro de Confianza & Gobernanza
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold bg-slate-100 text-slate-600 border border-slate-200/80">
              Noviembre 2026
            </span>
          </div>
        </div>
      </header>

      {/* =========================================================
          CONTENEDOR PRINCIPAL SCROLLEABLE
         ========================================================= */}
      <main
        className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 sm:py-8 overscroll-contain pb-[max(3rem,env(safe-area-inset-bottom))]"
        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
      >
        <div className="max-w-3xl mx-auto space-y-6">
          {/* =========================================================
              SELECTOR DE SECCIONES (TABS INDEPENDIENTES)
             ========================================================= */}
          <div
            role="tablist"
            aria-label="Secciones del Centro Legal"
            className="p-1.5 bg-slate-200/70 border border-slate-300/60 rounded-2xl grid grid-cols-2 gap-1.5 select-none shadow-xs"
          >
            <button
              type="button"
              role="tab"
              id="tab-terms"
              aria-controls="panel-terms"
              aria-selected={activeTab === 'terms'}
              onClick={() => handleTabChange('terms')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
                activeTab === 'terms'
                  ? 'bg-white text-[#1E3A5F] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
              }`}
            >
              <FileText className={`w-4 h-4 ${activeTab === 'terms' ? 'text-[#1E3A5F]' : 'text-slate-400'}`} />
              <span className="truncate">Términos y Condiciones</span>
            </button>

            <button
              type="button"
              role="tab"
              id="tab-privacy"
              aria-controls="panel-privacy"
              aria-selected={activeTab === 'privacy'}
              onClick={() => handleTabChange('privacy')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
                activeTab === 'privacy'
                  ? 'bg-white text-[#1E3A5F] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
              }`}
            >
              <Lock className={`w-4 h-4 ${activeTab === 'privacy' ? 'text-[#1E3A5F]' : 'text-slate-400'}`} />
              <span className="truncate">Política de Privacidad</span>
            </button>
          </div>

          {/* =========================================================
              ENCABEZADO DE LA SECCIÓN ACTIVA
             ========================================================= */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-2">
            {activeTab === 'terms' ? (
              <>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1E3A5F]">
                  Términos y Condiciones de Uso
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
                  Última actualización: Noviembre de 2026. Al registrarte o utilizar la plataforma Stockly, aceptas las siguientes condiciones de servicio.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1E3A5F]">
                  Política de Privacidad y Datos
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
                  Garantizamos la confidencialidad absoluta de tu información comercial y el control total de tus datos.
                </p>
              </>
            )}

            {/* Barra de utilidades del acordeón */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="font-mono text-[11px]">
                {currentClauses.length} cláusulas disponibles
              </span>
              <button
                type="button"
                onClick={() => setAllCurrentClauses(!allCurrentOpen)}
                className="font-medium text-[#1E3A5F] hover:underline cursor-pointer text-xs"
              >
                {allCurrentOpen ? 'Colapsar todas' : 'Expandir todas'}
              </button>
            </div>
          </div>

          {/* =========================================================
              LISTADO DE CLÁUSULAS CON COMPONENTE ACORDEÓN
             ========================================================= */}
          <div
            id={activeTab === 'terms' ? 'panel-terms' : 'panel-privacy'}
            role="tabpanel"
            aria-labelledby={activeTab === 'terms' ? 'tab-terms' : 'tab-privacy'}
            className="space-y-3"
          >
            {currentClauses.map(clause => {
              const isOpen = Boolean(openClauses[clause.id]);

              return (
                <div
                  key={clause.id}
                  className={`bg-white border transition-colors duration-200 rounded-2xl overflow-hidden shadow-xs ${
                    isOpen ? 'border-[#1E3A5F]/40 shadow-sm' : 'border-slate-200/90 hover:border-slate-300'
                  }`}
                >
                  {/* Encabezado accesible del acordeón */}
                  <button
                    type="button"
                    id={`clause-header-${clause.id}`}
                    aria-expanded={isOpen}
                    aria-controls={`clause-content-${clause.id}`}
                    onClick={() => toggleClause(clause.id)}
                    className="w-full flex items-center justify-between gap-3 p-4 sm:p-5 text-left cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] focus-visible:ring-offset-2 transition-colors hover:bg-slate-50/60"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-mono font-bold text-xs text-[#1E3A5F] shrink-0">
                        {clause.number}
                      </span>
                      <div className="min-w-0">
                        <span className="font-bold text-sm sm:text-base text-slate-900 block truncate">
                          {clause.title}
                        </span>
                        {clause.badge && (
                          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider block mt-0.5">
                            {clause.badge}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Ícono Chevron con rotación suave de 180° */}
                    <div className="p-1 rounded-lg bg-slate-100/70 border border-slate-200/60 shrink-0">
                      <ChevronDown
                        className={`w-4 h-4 text-slate-600 transition-transform duration-300 ease-in-out ${
                          isOpen ? 'rotate-180 text-[#1E3A5F]' : 'rotate-0'
                        }`}
                        aria-hidden="true"
                      />
                    </div>
                  </button>

                  {/* Contenedor del contenido con animación fluida de altura y opacidad */}
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
                        <div className="px-4 sm:px-5 pb-5 pt-1 border-t border-slate-100">
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
              PIE DE PÁGINA EDITORIAL
             ========================================================= */}
          <footer className="pt-6 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 font-sans">
            <span>© 2026 Stockly. Todos los derechos reservados.</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleTabChange(activeTab === 'terms' ? 'privacy' : 'terms')}
                className="text-[#1E3A5F] hover:underline font-medium cursor-pointer"
              >
                {activeTab === 'terms' ? 'Ver Política de Privacidad' : 'Ver Términos de Servicio'}
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={handleBack}
                className="text-slate-700 hover:text-[#1E3A5F] font-semibold underline underline-offset-2 cursor-pointer"
              >
                Volver a la aplicación
              </button>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
};

export default LegalCenterPage;
