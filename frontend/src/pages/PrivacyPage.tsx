import React from 'react';
import { ArrowLeft, ShieldCheck, Lock, CheckCircle2, Cpu, Database, Trash2, Eye } from 'lucide-react';

interface LegalPageProps {
  onBack?: () => void;
}

export const PrivacyPage: React.FC<LegalPageProps> = ({ onBack }) => {
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
            RF-LEGAL-001 // Privacidad
          </span>
        </div>
      </header>

      {/* Contenido Editorial */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-10">
        {/* Cabecera del Documento */}
        <div className="border-b border-[#E2E8F0] pb-8 space-y-3">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#E8B4A0] font-semibold">
            <ShieldCheck className="w-4 h-4 text-[#1E3A5F]" />
            <span>Política de Privacidad y Protección de Datos</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#1E3A5F] leading-tight">
            Política de Privacidad y Tratamiento de Información
          </h1>
          <p className="text-sm text-[#616161] leading-relaxed max-w-2xl font-normal">
            En Stockly nos comprometemos con la máxima transparencia respecto a qué datos recopilamos, cómo los procesamos mediante tecnologías modernas y cómo garantizamos tu control total sobre ellos.
          </p>
        </div>

        {/* 1. Responsable del Tratamiento */}
        <section className="space-y-3 bg-white p-6 sm:p-8 rounded-2xl border border-[#E2E8F0] shadow-sm">
          <h2 className="text-lg font-bold text-[#1E3A5F] flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-md bg-[#1E3A5F] text-white text-xs flex items-center justify-center font-mono">1</span>
            Responsable del Tratamiento
          </h2>
          <p className="text-sm text-[#475569] leading-relaxed">
            Stockly actúa como responsable del tratamiento de los datos de cuenta y como encargado tecnológico del tratamiento de los datos comerciales e inventarios introducidos por sus usuarios registrados.
          </p>
        </section>

        {/* 2. Datos Recopilados */}
        <section className="space-y-4 bg-white p-6 sm:p-8 rounded-2xl border border-[#E2E8F0] shadow-sm">
          <h2 className="text-lg font-bold text-[#1E3A5F] flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-md bg-[#1E3A5F] text-white text-xs flex items-center justify-center font-mono">2</span>
            Categorías de Datos Recopilados
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
              <span className="text-xs font-bold text-[#1E3A5F] uppercase tracking-wider block">Identificación y Perfil</span>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Correo electrónico institucional o personal, nombre o razón comercial y roles de acceso asignados (dueño o colaborador).
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
              <span className="text-xs font-bold text-[#1E3A5F] uppercase tracking-wider block">Catálogo y Existencias</span>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Productos, categorías, subcategorías, códigos de referencia o barras, ubicaciones en depósito y cantidades en existencias.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
              <span className="text-xs font-bold text-[#1E3A5F] uppercase tracking-wider block">Ventas y Precios</span>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Precios de costo, precios de venta al público, historial de transacciones, métodos de liquidación e historial de caja.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
              <span className="text-xs font-bold text-[#1E3A5F] uppercase tracking-wider block">Almacenamiento Local (PWA)</span>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Bases de datos técnicas en el navegador vía IndexedDB y Service Workers que permiten registrar ventas y salidas en modo offline sin conexión a internet.
              </p>
            </div>
          </div>
        </section>

        {/* 3. Tratamiento de Imágenes e Inteligencia Artificial */}
        <section className="space-y-4 bg-white p-6 sm:p-8 rounded-2xl border border-[#E2E8F0] shadow-sm">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-amber-800 bg-amber-50 px-3 py-1 rounded-lg w-fit border border-amber-200">
            <Cpu className="w-3.5 h-3.5 text-amber-600" />
            <span>Procesamiento de Imágenes & IA</span>
          </div>
          <h2 className="text-lg font-bold text-[#1E3A5F] flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-md bg-[#1E3A5F] text-white text-xs flex items-center justify-center font-mono">3</span>
            Tratamiento de Imágenes y Modelos de Inteligencia Artificial
          </h2>
          <p className="text-sm text-[#475569] leading-relaxed">
            Cuando utilizas herramientas de escaneo o reconocimiento asistido por visión artificial:
          </p>
          <ul className="space-y-2.5 text-sm text-[#475569]">
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <span><strong>Finalidad Restringida y Efímera:</strong> Las imágenes cargadas o capturadas por la cámara se procesan en memoria con el fin exclusivo de extraer códigos de barra, texto de etiquetas o especificaciones del producto. Una vez extraído el texto o código, el archivo volátil es descartado.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <span><strong>Sin Cesión de Propiedad Intelectual:</strong> El envío de imágenes para su lectura no otorga a Stockly ni a ningún proveedor de IA derechos de autor, licencias ni propiedad sobre las fotografías o marcas de tus productos.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <span><strong>Sin Entrenamiento de Modelos Públicos:</strong> Los datos y fotografías de tu negocio no son utilizados para alimentar, entrenar o calibrar modelos de IA de terceros para acceso público.</span>
            </li>
          </ul>
        </section>

        {/* 4. Subencargados y No Venta de Información */}
        <section className="space-y-4 bg-white p-6 sm:p-8 rounded-2xl border border-[#E2E8F0] shadow-sm">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-emerald-800 bg-emerald-50 px-3 py-1 rounded-lg w-fit border border-emerald-200">
            <Lock className="w-3.5 h-3.5 text-emerald-600" />
            <span>Compromiso de Privacidad Absoluta</span>
          </div>
          <h2 className="text-lg font-bold text-[#1E3A5F] flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-md bg-[#1E3A5F] text-white text-xs flex items-center justify-center font-mono">4</span>
            Transferencia a Terceros y No Comercialización
          </h2>
          <p className="text-sm text-[#475569] leading-relaxed">
            La información únicamente transita y se aloja en proveedores de infraestructura tecnológica debidamente certificados:
          </p>
          <ul className="space-y-2 text-sm text-[#475569] list-disc list-inside">
            <li><strong>Supabase / AWS:</strong> Almacenamiento seguro en PostgreSQL, autenticación y backups cifrados.</li>
            <li><strong>Vercel:</strong> Entrega de la interfaz estática optimizada para PWA bajo cifrado HTTPS.</li>
            <li><strong>APIs de Visión / IA Segura:</strong> Procesamiento efímero de imágenes vía conexiones SSL encriptadas.</li>
          </ul>
          <div className="p-4 bg-[#F0FDF4] border border-emerald-300 rounded-xl text-xs text-emerald-900 leading-relaxed font-semibold">
            PROHIBICIÓN TOTAL DE VENTA DE DATOS: Bajo ninguna circunstancia Stockly vende, renta, comercializa, transfiere ni comparte datos comerciales, de clientes, ventas o inventarios con agencias de publicidad, corredores de datos («data brokers») ni plataformas de monetización publicitaria.
          </div>
        </section>

        {/* 5. Derechos ARCO y Supresión Definitiva (RF-AUTH-006) */}
        <section className="space-y-4 bg-white p-6 sm:p-8 rounded-2xl border border-[#E2E8F0] shadow-sm">
          <h2 className="text-lg font-bold text-[#1E3A5F] flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-md bg-[#1E3A5F] text-white text-xs flex items-center justify-center font-mono">5</span>
            Derechos ARCO y Supresión de Cuenta (RF-AUTH-006)
          </h2>
          <p className="text-sm text-[#475569] leading-relaxed">
            Como usuario y titular de los datos, cuentas con pleno derecho para:
          </p>
          <div className="space-y-2.5 text-sm text-[#475569]">
            <p><strong>• Acceso y Rectificación:</strong> Consultar y editar en tiempo real toda la información de tu perfil, inventarios y colaboradores desde el sistema.</p>
            <p><strong>• Cancelación y Oposición:</strong> Revocar accesos a colaboradores o transferir la propiedad de tus depósitos.</p>
            <p><strong>• Supresión Total e Irreversible (RF-AUTH-006):</strong> Eliminar tu cuenta y todos los depósitos asociados mediante el botón de eliminación de cuenta en la sección de Configuración. Tras confirmar con la clave de seguridad requerida, la totalidad de tus datos se purgan física y lógicamente de la base de datos sin copias retenidas.</p>
          </div>
        </section>

        {/* Footer y Enlace de Retorno */}
        <div className="pt-6 border-t border-[#E2E8F0] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#616161]">
          <p>© 2026 Stockly. Todos los derechos reservados.</p>
          <div className="flex items-center gap-4">
            <a href="/terms" className="text-[#1E3A5F] hover:underline font-medium">
              Términos de Servicio
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

export default PrivacyPage;
