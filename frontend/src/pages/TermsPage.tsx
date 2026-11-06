import React from 'react';
import { ArrowLeft, ShieldCheck, FileText, CheckCircle2, Cpu, Database, Trash2, Lock } from 'lucide-react';

interface LegalPageProps {
  onBack?: () => void;
}

export const TermsPage: React.FC<LegalPageProps> = ({ onBack }) => {
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1E3A5F] font-sans selection:bg-[#1E3A5F] selection:text-white">
      {/* Barra Superior de Navegación */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#E5E7EB] transition-colors">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="w-9 h-9 rounded-full bg-[#F8F9FA] hover:bg-[#EAEFF5] border border-[#CBD5E1] flex items-center justify-center text-[#1E3A5F] transition-all cursor-pointer active:scale-95"
              title="Volver"
              aria-label="Volver"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2]" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#1E3A5F] text-white flex items-center justify-center font-mono font-bold text-sm">
                S
              </div>
              <span className="font-bold text-base tracking-tight text-[#1E3A5F]">
                Stockly
              </span>
            </div>
          </div>
          <span className="text-[11px] font-mono uppercase tracking-wider text-[#616161] bg-[#F1F5F9] px-3 py-1 rounded-full border border-[#E2E8F0]">
            RF-LEGAL-001 // v2.4
          </span>
        </div>
      </header>

      {/* Contenido Editorial */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-10">
        {/* Cabecera del Documento */}
        <div className="border-b border-[#E2E8F0] pb-8 space-y-3">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#E8B4A0] font-semibold">
            <FileText className="w-4 h-4 text-[#1E3A5F]" />
            <span>Documento Legal Oficial</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#1E3A5F] leading-tight">
            Términos y Condiciones de Servicio
          </h1>
          <p className="text-sm text-[#616161] leading-relaxed max-w-2xl font-normal">
            Última actualización: Noviembre de 2026. Al registrarte o utilizar la plataforma Stockly (la «Aplicación» o el «Servicio»), aceptas cumplir y quedar vinculado a los presentes términos.
          </p>
        </div>

        {/* 1. Objeto y Alcance del Servicio */}
        <section className="space-y-3 bg-white p-6 sm:p-8 rounded-2xl border border-[#E2E8F0] shadow-sm">
          <h2 className="text-lg font-bold text-[#1E3A5F] flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-md bg-[#1E3A5F] text-white text-xs flex items-center justify-center font-mono">1</span>
            Objeto y Alcance del Servicio
          </h2>
          <p className="text-sm text-[#475569] leading-relaxed">
            Stockly es una Progressive Web App (PWA) de gestión operativa de inventarios, control de existencias físicas, administración de almacenes y registro de ventas minoristas y comerciales (POS), diseñada para operar tanto en entornos con conectividad continua como en modalidades sin conexión a internet (modo offline diferido).
          </p>
        </section>

        {/* 2. Cláusula de Recopilación de Datos */}
        <section className="space-y-4 bg-white p-6 sm:p-8 rounded-2xl border border-[#E2E8F0] shadow-sm">
          <h2 className="text-lg font-bold text-[#1E3A5F] flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-md bg-[#1E3A5F] text-white text-xs flex items-center justify-center font-mono">2</span>
            Cláusula de Recopilación y Naturaleza de los Datos
          </h2>
          <p className="text-sm text-[#475569] leading-relaxed">
            Para prestar las funcionalidades del sistema, Stockly recopila y almacena estrictamente la información necesaria para el funcionamiento de tu catálogo y operaciones de negocio:
          </p>
          <ul className="space-y-2.5 text-sm text-[#475569]">
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <span><strong>Datos de Autenticación:</strong> Correo electrónico de registro, nombre completo o identificador comercial y credenciales cifradas administradas mediante tokens seguros.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <span><strong>Catálogo de Inventario:</strong> Nombres de productos, descripciones, unidades de medida, códigos de referencia o códigos de barras (EAN/UPC/QR), precios de costo y venta, categorías, subcategorías y asignaciones físicas en almacén.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <span><strong>Registros de Operaciones y Ventas:</strong> Historial transaccional, fecha y hora de emisión, montos totales, ítems despachados, medios de pago (efectivo, Yape, Plin, transferencia, tarjeta) y notas operativas.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <span><strong>Almacenamiento Técnico Local:</strong> Uso activo de tecnologías de almacenamiento local en el navegador (IndexedDB y Service Workers) para garantizar persistencia offline, colas de sincronización diferida y disponibilidad del catálogo sin red.</span>
            </li>
          </ul>
        </section>

        {/* 3. Cláusula de Procesamiento de Inteligencia Artificial */}
        <section className="space-y-4 bg-white p-6 sm:p-8 rounded-2xl border border-[#E2E8F0] shadow-sm">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-amber-700 bg-amber-50 px-3 py-1 rounded-lg w-fit border border-amber-200">
            <Cpu className="w-3.5 h-3.5 text-amber-600" />
            <span>Procesamiento Multimodal & Visión Artificial</span>
          </div>
          <h2 className="text-lg font-bold text-[#1E3A5F] flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-md bg-[#1E3A5F] text-white text-xs flex items-center justify-center font-mono">3</span>
            Cláusula de Procesamiento mediante Inteligencia Artificial
          </h2>
          <p className="text-sm text-[#475569] leading-relaxed">
            En caso de que el usuario utilice las capacidades de escaneo óptico, lectura de comprobantes o extracción asistida de productos mediante cámaras o carga de fotografías:
          </p>
          <div className="space-y-3 text-sm text-[#475569] bg-[#F8FAFC] p-4 sm:p-5 rounded-xl border border-[#E2E8F0]">
            <p className="leading-relaxed">
              <strong>a) Procesamiento Efímero:</strong> Las imágenes transmitidas son procesadas de manera volátil y estrictamente temporal con el único fin de detectar caracteres, códigos de barra y atributos técnicos del producto. Las imágenes no se almacenan permanentemente en los servidores de inferencia una vez finalizada la extracción.
            </p>
            <p className="leading-relaxed">
              <strong>b) Consentimiento Expreso:</strong> Al activar la cámara o cargar imágenes, el usuario otorga su consentimiento expreso para dicho análisis automatizado.
            </p>
            <p className="leading-relaxed">
              <strong>c) Propiedad Intelectual y Modelos Base:</strong> El procesamiento de imágenes no constituye cesión ni renuncia de derechos de propiedad intelectual por parte del usuario. Los datos, imágenes o consultas del usuario <strong>no se utilizan</strong> para entrenar modelos fundacionales públicos de terceros.
            </p>
          </div>
        </section>

        {/* 4. Cláusula de Transferencia a Terceros (Subencargados de Tratamiento) */}
        <section className="space-y-4 bg-white p-6 sm:p-8 rounded-2xl border border-[#E2E8F0] shadow-sm">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-sky-800 bg-sky-50 px-3 py-1 rounded-lg w-fit border border-sky-200">
            <Database className="w-3.5 h-3.5 text-sky-600" />
            <span>Subencargados de Infraestructura</span>
          </div>
          <h2 className="text-lg font-bold text-[#1E3A5F] flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-md bg-[#1E3A5F] text-white text-xs flex items-center justify-center font-mono">4</span>
            Transferencia a Terceros y Subencargados del Tratamiento
          </h2>
          <p className="text-sm text-[#475569] leading-relaxed">
            Stockly utiliza proveedores de infraestructura de primer nivel para alojar y procesar la información de forma segura:
          </p>
          <ul className="space-y-2 text-sm text-[#475569] list-disc list-inside">
            <li><strong>Supabase Inc.:</strong> Base de datos relacional PostgreSQL con cifrado en reposo y tránsito, motor de autenticación JWT y almacenamiento de archivos.</li>
            <li><strong>Vercel Inc.:</strong> Alojamiento en la nube perimetral (Edge CDN), compresión y distribución segura de la Progressive Web App.</li>
            <li><strong>Proveedores de APIs de Visión/IA:</strong> Servicios seguros de inferencia multimodal para análisis óptico de productos bajo acuerdos estrictos de privacidad empresarial.</li>
          </ul>
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 leading-relaxed font-medium flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span><strong>Declaración de no comercialización:</strong> Se declara explícitamente que los datos de inventario, precios, proveedores, clientes y ventas de tu negocio <strong>no son vendidos, alquilados, comercializados ni cedidos</strong> a ningún tercero ni utilizados con fines de perfilamiento publicitario.</span>
          </div>
        </section>

        {/* 5. Derechos ARCO y Supresión de Cuenta (RF-AUTH-006) */}
        <section className="space-y-4 bg-white p-6 sm:p-8 rounded-2xl border border-[#E2E8F0] shadow-sm">
          <h2 className="text-lg font-bold text-[#1E3A5F] flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-md bg-[#1E3A5F] text-white text-xs flex items-center justify-center font-mono">5</span>
            Derechos ARCO y Supresión Total de la Cuenta (RF-AUTH-006)
          </h2>
          <p className="text-sm text-[#475569] leading-relaxed">
            De conformidad con la legislación aplicable en materia de protección de datos personales, el titular de la cuenta goza de los derechos de Acceso, Rectificación, Cancelación y Oposición (ARCO).
          </p>
          <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900">
            <Trash2 className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="block font-semibold">Derecho de Supresión Irrevocable:</strong>
              <p className="leading-relaxed">
                El usuario puede solicitar en cualquier momento la eliminación definitiva de su cuenta y todos sus inventarios, ventas y registros asociados directamente a través del panel de Configuración (RF-AUTH-006). Esta acción purga de manera permanente e irreversible todos los datos vinculados en los servidores de base de datos.
              </p>
            </div>
          </div>
        </section>

        {/* 6. Seguridad y Resguardo Técnico */}
        <section className="space-y-3 bg-white p-6 sm:p-8 rounded-2xl border border-[#E2E8F0] shadow-sm">
          <h2 className="text-lg font-bold text-[#1E3A5F] flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-md bg-[#1E3A5F] text-white text-xs flex items-center justify-center font-mono">6</span>
            Seguridad de la Información
          </h2>
          <p className="text-sm text-[#475569] leading-relaxed">
            Implementamos protocolos de seguridad estándar de la industria, incluyendo comunicaciones cifradas bajo HTTPS con certificados TLS modernos, políticas de seguridad a nivel de fila (Row Level Security - RLS) en PostgreSQL para aislamiento estricto multi-tenant por usuario y protección contra inyecciones e intrusiones.
          </p>
        </section>

        {/* Footer y Enlace de Retorno */}
        <div className="pt-6 border-t border-[#E2E8F0] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#616161]">
          <p>© 2026 Stockly. Todos los derechos reservados.</p>
          <div className="flex items-center gap-4">
            <a href="/privacy" className="text-[#1E3A5F] hover:underline font-medium">
              Política de Privacidad
            </a>
            <span>·</span>
            <button
              onClick={handleBack}
              className="text-[#1E3A5F] hover:underline font-medium cursor-pointer"
            >
              Volver al sistema
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TermsPage;
