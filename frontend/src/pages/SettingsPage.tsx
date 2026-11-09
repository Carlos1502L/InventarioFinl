import React, { useState } from 'react';
import {
  Settings,
  Tag,
  MapPin,
  Users,
  Layers,
  Smartphone,
  Info,
  ChevronRight,
  LogOut,
  QrCode,
  Briefcase,
  User,
  Sliders,
  Printer,
  Ticket,
  Database,
  AlertTriangle,
  Trash2,
  Loader2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../services/supabase';
import { EditInventoryModal } from '../components/modals/EditInventoryModal';
import { BatchLocationsPrintModal } from '../components/modals/BatchLocationsPrintModal';
import { CouponsManagementModal } from '../components/modals/CouponsManagementModal';
import { BackupManagementCard } from '../components/settings/BackupManagementCard';
import { BackupManagementModal } from '../components/modals/BackupManagementModal';
import { DeleteAccountModal } from '../components/modals/DeleteAccountModal';

interface SettingsPageProps {
  onOpenCategories: () => void;
  onOpenLocations: () => void;
  onOpenCollaborators: () => void;
  onOpenInventorySelector: () => void;
  onRefreshInventoryData?: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  onOpenCategories,
  onOpenLocations,
  onOpenCollaborators,
  onOpenInventorySelector,
  onRefreshInventoryData
}) => {
  const { currentInventory, user, profile, signOut, refreshInventories } = useAuth();
  const [editInventoryMode, setEditInventoryMode] = useState<'info' | 'payments' | null>(null);
  const [batchLocationsOpen, setBatchLocationsOpen] = useState(false);
  const [couponsOpen, setCouponsOpen] = useState(false);
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [deleteAccountModalOpen, setDeleteAccountModalOpen] = useState(false);

  const isOwner =
    currentInventory?.role?.toLowerCase() === 'owner' ||
    currentInventory?.is_owner === true ||
    (Boolean(user?.id) && Boolean(currentInventory?.owner_id) && currentInventory?.owner_id === user?.id) ||
    !currentInventory?.role;

  const isBusiness = currentInventory?.inventory_type !== 'PERSONAL';

  const displayName =
    profile?.full_name?.trim() ||
    (typeof user?.user_metadata?.full_name === 'string' && user.user_metadata.full_name.trim()) ||
    user?.email?.split('@')[0] ||
    'Usuario';

  const userInitial = displayName.charAt(0).toUpperCase();

  return (
    <>
      {/* =========================================================
          VISTA MÓVIL ULTRA MINIMALISTA (< 768px / md:hidden)
         ========================================================= */}
      <div className="md:hidden fixed inset-0 h-[100dvh] w-full flex flex-col overflow-hidden bg-white text-neutral-900">
        
        {/* 1. HEADER OSCURO FIJO: Avatar/inicial, nombre, correo y etiqueta de rol */}
        <header className="shrink-0 bg-neutral-950 text-white rounded-b-[2.5rem] z-10 select-none px-6 pt-[max(1.25rem,env(safe-area-inset-top))] pb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-neutral-800 text-white flex items-center justify-center text-xl font-semibold flex-shrink-0">
              {userInitial}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-semibold tracking-tight text-white truncate">
                {displayName}
              </h1>
              <p className="text-xs text-neutral-400 truncate mt-0.5">
                {user?.email}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-neutral-800/80 text-neutral-300 text-[11px] font-medium uppercase tracking-wide">
                  {currentInventory?.role || 'owner'}
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-neutral-800/80 text-neutral-300 text-[11px] font-medium truncate max-w-[160px]">
                  {currentInventory?.name || 'Depósito'}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* 2. CUERPO BLANCO CON SCROLL AISLADO: Menú de opciones en lista plana estilo ajustes */}
        <section className="flex-1 min-h-0 w-full bg-white overflow-y-auto overscroll-none px-5 pt-3 pb-24">
          <div className="divide-y divide-neutral-100">
            <button
              type="button"
              onClick={onOpenInventorySelector}
              className="w-full py-4 flex items-center justify-between gap-3 text-left active:opacity-70 transition-opacity"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <Layers className="w-4 h-4 text-neutral-500 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-900 truncate">
                    Cambiar o Crear Depósito
                  </p>
                  <p className="text-xs text-neutral-400 truncate">
                    Activo: {currentInventory?.name || 'Sin seleccionar'}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-400 flex-shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => setEditInventoryMode('info')}
              className="w-full py-4 flex items-center justify-between gap-3 text-left active:opacity-70 transition-opacity"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <Sliders className="w-4 h-4 text-neutral-500 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-900 truncate">
                    {isOwner ? 'Editar Información' : 'Información de Inventario'}
                  </p>
                  <p className="text-xs text-neutral-400 truncate">
                    {isOwner
                      ? `Nombre, moneda (${currentInventory?.currency || 'PEN'}), tasa y tipo`
                      : `Moneda (${currentInventory?.currency || 'PEN'}), tasa y detalles del depósito`}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-400 flex-shrink-0" />
            </button>

            {isBusiness && (
              <>
                <button
                  type="button"
                  onClick={() => setEditInventoryMode('payments')}
                  className="w-full py-4 flex items-center justify-between gap-3 text-left active:opacity-70 transition-opacity"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <QrCode className="w-4 h-4 text-neutral-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-neutral-900 truncate">
                        Método de Pago
                      </p>
                      <p className="text-xs text-neutral-400 truncate">
                        Códigos QR y números de cobro
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => setCouponsOpen(true)}
                  className="w-full py-4 flex items-center justify-between gap-3 text-left active:opacity-70 transition-opacity"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <Ticket className="w-4 h-4 text-neutral-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-neutral-900 truncate">
                        Cupones de Descuento
                      </p>
                      <p className="text-xs text-neutral-400 truncate">
                        Códigos promocionales para ventas
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onOpenCategories}
              className="w-full py-4 flex items-center justify-between gap-3 text-left active:opacity-70 transition-opacity"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <Tag className="w-4 h-4 text-neutral-500 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-900 truncate">
                    Categorías y Subcategorías
                  </p>
                  <p className="text-xs text-neutral-400 truncate">
                    Clasificación del catálogo
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-400 flex-shrink-0" />
            </button>

            <button
              type="button"
              onClick={onOpenLocations}
              className="w-full py-4 flex items-center justify-between gap-3 text-left active:opacity-70 transition-opacity"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <MapPin className="w-4 h-4 text-neutral-500 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-900 truncate">
                    Ubicaciones Físicas y Estantes
                  </p>
                  <p className="text-xs text-neutral-400 truncate">
                    Administrar zonas y almacenes
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-400 flex-shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => setBatchLocationsOpen(true)}
              className="w-full py-4 flex items-center justify-between gap-3 text-left active:opacity-70 transition-opacity"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <Printer className="w-4 h-4 text-neutral-500 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-900 truncate">
                    Impresión de Rótulos y QR
                  </p>
                  <p className="text-xs text-neutral-400 truncate">
                    Credenciales físicas para estanterías
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-400 flex-shrink-0" />
            </button>

            <button
              type="button"
              onClick={onOpenCollaborators}
              className="w-full py-4 flex items-center justify-between gap-3 text-left active:opacity-70 transition-opacity"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <Users className="w-4 h-4 text-neutral-500 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-900 truncate">
                    Equipo y Colaboradores
                  </p>
                  <p className="text-xs text-neutral-400 truncate">
                    Accesos y roles del depósito
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-400 flex-shrink-0" />
            </button>

            {/* Copias de Seguridad (Exclusivo Propietario / Owner) */}
            {isOwner && (
              <button
                type="button"
                onClick={() => setBackupModalOpen(true)}
                className="w-full py-4 flex items-center justify-between gap-3 text-left active:opacity-70 transition-opacity"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <Database className="w-4 h-4 text-neutral-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-900 truncate">
                      Copias de Seguridad (Backups)
                    </p>
                    <p className="text-xs text-neutral-400 truncate">
                      Respaldo manual, programado y restauración
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-neutral-400 flex-shrink-0" />
              </button>
            )}

            {/* Eliminar Cuenta */}
            <button
              type="button"
              onClick={() => setDeleteAccountModalOpen(true)}
              className="w-full py-4 flex items-center justify-between gap-3 text-left active:opacity-70 transition-opacity"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <Trash2 className="w-4 h-4 text-rose-500 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-900 truncate">
                    Eliminar Cuenta
                  </p>
                  <p className="text-xs text-neutral-400 truncate">
                    Baja permanente y purga de información
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-400 flex-shrink-0" />
            </button>
          </div>

          {/* Botón de cerrar sesión en tono sobrio al final de la lista */}
          <div className="pt-6">
            <button
              type="button"
              onClick={() => signOut()}
              className="w-full py-4 rounded-2xl bg-neutral-100 hover:bg-neutral-200 text-neutral-900 font-semibold text-sm flex items-center justify-center gap-2 transition-colors active:scale-[0.99]"
            >
              <LogOut className="w-4 h-4 text-neutral-600" />
              <span>Cerrar Sesión</span>
            </button>
          </div>

          

          {/* Pie Legal Móvil (RF-LEGAL-001) */}
          <div className="pt-6 pb-2 flex flex-col items-center gap-2 text-xs text-neutral-400 font-mono">
            <div className="flex items-center gap-3">
              <a
                href="/terms"
                onClick={(e) => {
                  e.preventDefault();
                  window.history.pushState({}, '', '/terms');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}
                className="text-neutral-500 hover:text-neutral-800 underline"
              >
                Términos de Servicio
              </a>
              <span>·</span>
              <a
                href="/privacy"
                onClick={(e) => {
                  e.preventDefault();
                  window.history.pushState({}, '', '/privacy');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}
                className="text-neutral-500 hover:text-neutral-800 underline"
              >
                Privacidad
              </a>
            </div>
            <span className="text-[10px]">STOCKLY v2.4.0</span>
          </div>
        </section>
      </div>

      {/* =========================================================
          VISTA DE ESCRITORIO (>= 768px / hidden md:block) - Ui CLINICAL BLUEPRINT
         ========================================================= */}
      <div className="hidden md:block space-y-6 pb-28 sm:pb-12 max-w-4xl mx-auto font-normal text-[#0a0a0a]">
      {/* 1. Cabecera Editorial */}
      <div className="bg-white border border-[#e5e5e5] rounded-3xl p-6 shadow-ui-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-[0.05em] text-[#737373] font-medium block mb-1">
            Centro de Control y Preferencias
          </span>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-[-0.04em] text-[#0a0a0a]">
            Configuración y Preferencias
          </h1>
          <p className="text-xs text-[#737373] mt-1">
            Estructura de catálogo, delimitación física, pasarelas de cobro y gobernanza del equipo.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3.5 py-1.5 rounded-[18px] bg-[#f5f5f5] border border-[#e5e5e5] text-[#0a0a0a] text-xs font-medium">
            v2.4
          </span>
        </div>
      </div>

      {/* =========================================================
          BLOQUE 1: IDENTIDAD DEL DEPÓSITO ACTIVO
         ========================================================= */}
      <div className="bg-white border border-[#e5e5e5] rounded-3xl p-6 shadow-ui-subtle space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#0a0a0a] text-[#fafafa] flex items-center justify-center flex-shrink-0 shadow-ui-subtle">
              <Layers className="w-6 h-6 stroke-[1.8]" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] uppercase tracking-[0.05em] text-[#737373] font-medium">
                  Depósito Activo
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-[12px] bg-[#f5f5f5] border border-[#e5e5e5] text-[#0a0a0a] font-medium flex items-center gap-1">
                  {currentInventory?.inventory_type === 'PERSONAL' ? (
                    <>
                      <User className="w-3 h-3 text-[#0a0a0a]" /> Personal
                    </>
                  ) : (
                    <>
                      <Briefcase className="w-3 h-3 text-[#0a0a0a]" /> Negocio
                    </>
                  )}
                </span>
              </div>
              <h2 className="font-semibold text-xl text-[#0a0a0a] tracking-tight">
                {currentInventory?.name || 'Sin seleccionar'}
              </h2>
              <p className="text-xs text-[#737373]">
                {currentInventory?.description || 'Sin notas descriptivas del depósito.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditInventoryMode('info')}
              className="px-4 py-2 bg-[#f5f5f5] hover:bg-[#ebebeb] text-[#0a0a0a] border border-[#e5e5e5] text-xs font-medium rounded-[18px] transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-[#0a0a0a]" />
              <span>{isOwner ? 'Editar Información' : 'Información de Inventario'}</span>
            </button>
            <button
              onClick={onOpenInventorySelector}
              className="px-5 py-2 bg-[#0a0a0a] hover:bg-[#262626] text-[#fafafa] text-xs font-medium rounded-[18px] shadow-ui-subtle transition-all active:scale-95 cursor-pointer"
            >
              Cambiar
            </button>
          </div>
        </div>

        {/* Metadatos en Fila */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-[#e5e5e5] text-xs text-[#737373]">
          <div>
            <span className="text-[10px] uppercase tracking-[0.05em] text-[#737373] font-medium block">Moneda de Manifiesto:</span>
            <span className="text-[#0a0a0a] font-medium">{currentInventory?.currency || 'PEN'}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-[0.05em] text-[#737373] font-medium block">Tasa Operativa:</span>
            <span className="text-[#0a0a0a] font-medium tabular-nums">{Number(currentInventory?.exchange_rate || 1.000).toFixed(3)}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-[0.05em] text-[#737373] font-medium block">Nivel de Acceso:</span>
            <span className="text-[#0a0a0a] font-medium capitalize">{currentInventory?.role || 'owner'}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-[0.05em] text-[#737373] font-medium block">Fecha de Alta:</span>
            <span className="text-[#0a0a0a] font-medium">{formatDate(currentInventory?.created_at)}</span>
          </div>
        </div>
      </div>

      {/* =========================================================
          BLOQUE 2: OPERACIONES COMERCIALES (SÓLO SI ES NEGOCIO)
         ========================================================= */}
      {isBusiness && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <h3 className="text-xs font-semibold uppercase tracking-[0.05em] text-[#737373]">
              Operaciones y Pagos
            </h3>
          </div>

          <div className="bg-white border border-[#e5e5e5] rounded-3xl overflow-hidden shadow-ui-subtle divide-y divide-[#e5e5e5]">
            {/* Pasarela Yape / Plin */}
            <button
              onClick={() => setEditInventoryMode('payments')}
              className="w-full p-5 flex items-center justify-between hover:bg-[#fafafa] transition-colors text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-[#0a0a0a] flex items-center justify-center transition-colors">
                  <QrCode className="w-5 h-5 text-[#0a0a0a]" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-[#0a0a0a]">Método de Pago</h4>
                  <p className="text-xs text-[#737373]">Configura tus códigos QR y números asociados para el cobro ágil a clientes</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#737373] group-hover:text-[#0a0a0a] transition-colors" />
            </button>

            {/* Cupones de Descuento */}
            <button
              onClick={() => setCouponsOpen(true)}
              className="w-full p-5 flex items-center justify-between hover:bg-[#fafafa] transition-colors text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-[#0a0a0a] flex items-center justify-center transition-colors">
                  <Ticket className="w-5 h-5 text-[#0a0a0a]" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-[#0a0a0a]">Cupones de Descuento Promocionales</h4>
                  <p className="text-xs text-[#737373]">Crea y audita códigos de descuento por porcentaje o monto fijo</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#737373] group-hover:text-[#0a0a0a] transition-colors" />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================
          BLOQUE 3: ESTRUCTURA DEL CATÁLOGO & LOGÍSTICA
         ========================================================= */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <h3 className="text-xs font-semibold uppercase tracking-[0.05em] text-[#737373]">
            Estructura y Logística
          </h3>
        </div>

        <div className="bg-white border border-[#e5e5e5] rounded-3xl overflow-hidden shadow-ui-subtle divide-y divide-[#e5e5e5]">
          {/* Categorías y Subcategorías */}
          <button
            onClick={onOpenCategories}
            className="w-full p-5 flex items-center justify-between hover:bg-[#fafafa] transition-colors text-left group cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-[#0a0a0a] flex items-center justify-center transition-colors">
                <Tag className="w-5 h-5 text-[#0a0a0a]" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-[#0a0a0a]">Categorías y Subcategorías Dinámicas</h4>
                <p className="text-xs text-[#737373]">Organización taxonómica, familias de artículos y paleta de distinción</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#737373] group-hover:text-[#0a0a0a] transition-colors" />
          </button>

          {/* Gestión de Ubicaciones Físicas */}
          <button
            onClick={onOpenLocations}
            className="w-full p-5 flex items-center justify-between hover:bg-[#fafafa] transition-colors text-left group cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-[#0a0a0a] flex items-center justify-center transition-colors">
                <MapPin className="w-5 h-5 text-[#0a0a0a]" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-[#0a0a0a]">Ubicaciones Físicas y Almacenes</h4>
                <p className="text-xs text-[#737373]">Estructura espacial de pasillos, estanterías, depósitos y secciones</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#737373] group-hover:text-[#0a0a0a] transition-colors" />
          </button>

          {/* Imprimir Ubicaciones */}
          <button
            onClick={() => setBatchLocationsOpen(true)}
            className="w-full p-5 flex items-center justify-between hover:bg-[#fafafa] transition-colors text-left group cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-[#0a0a0a] flex items-center justify-center transition-colors">
                <Printer className="w-5 h-5 text-[#0a0a0a]" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-[#0a0a0a]">Impresión de Rótulos y Códigos QR</h4>
                <p className="text-xs text-[#737373]">Generación de credenciales físicas para estanterías (formato estándar 85.6 × 53.9 mm)</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#737373] group-hover:text-[#0a0a0a] transition-colors" />
          </button>
        </div>
      </div>

      {/* =========================================================
          BLOQUE 4: GOBERNANZA, PWA & ACCESO
         ========================================================= */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <h3 className="text-xs font-semibold uppercase tracking-[0.05em] text-[#737373]">
            Gobernanza y Aplicación
          </h3>
        </div>

        <div className="bg-white border border-[#e5e5e5] rounded-3xl overflow-hidden shadow-ui-subtle divide-y divide-[#e5e5e5]">
          {/* Equipo y Colaboradores */}
          <button
            onClick={onOpenCollaborators}
            className="w-full p-5 flex items-center justify-between hover:bg-[#fafafa] transition-colors text-left group cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-[#0a0a0a] flex items-center justify-center transition-colors">
                <Users className="w-5 h-5 text-[#0a0a0a]" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-[#0a0a0a]">Equipo y Colaboradores</h4>
                <p className="text-xs text-[#737373]">Invitaciones por correo, asignación de roles y control de privilegios</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#737373] group-hover:text-[#0a0a0a] transition-colors" />
          </button>
        </div>

        {/* =========================================================
            COPIAS DE SEGURIDAD & RESTAURACIÓN (EXCLUSIVO OWNER)
           ========================================================= */}
        {isOwner && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <h3 className="text-xs font-semibold uppercase tracking-[0.05em] text-[#737373]">
                Copias de Seguridad y Restauración
              </h3>
            </div>

            <BackupManagementCard
              onRestoreCompleted={() => {
                refreshInventories();
                if (onRefreshInventoryData) onRefreshInventoryData();
              }}
            />
          </div>
        )}

        {/* Tarjeta de Aplicación PWA */}
        <div className="bg-white border border-[#e5e5e5] rounded-3xl p-6 shadow-ui-subtle space-y-3">
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-5 h-5 text-[#0a0a0a]" />
            <h4 className="font-semibold text-sm text-[#0a0a0a]">Aplicación Web Progresiva (PWA Móvil)</h4>
          </div>
          <p className="text-xs text-[#737373] leading-relaxed">
            Esta plataforma está optimizada para smartphones Android e iOS. Puedes instalarla en la pantalla de inicio de tu dispositivo para obtener experiencia a pantalla completa y acceso rápido a la cámara escáner.
          </p>
          <div className="p-4 bg-[#fafafa] rounded-2xl border border-[#e5e5e5] text-xs text-[#737373] space-y-1">
            <div className="flex items-center gap-1.5 text-[#0a0a0a] font-medium">
              <Info className="w-3.5 h-3.5 text-[#0a0a0a]" /> Guía de instalación rápida:
            </div>
            <p><strong>iOS (Safari):</strong> Toca "Compartir" y selecciona "Añadir a la pantalla de inicio".</p>
            <p><strong>Android (Chrome):</strong> Toca el menú de 3 puntos y selecciona "Instalar aplicación".</p>
          </div>
        </div>

        {/* Sesión de Usuario & Cierre */}
        <div className="p-5 bg-white border border-[#e5e5e5] rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-ui-subtle">
          <div>
            <span className="text-[10px] uppercase tracking-[0.05em] text-[#737373] font-medium block">
              Sesión Autenticada
            </span>
            <p className="text-xs font-medium text-[#0a0a0a] mt-0.5">{user?.email}</p>
          </div>
          <button
            onClick={() => signOut()}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#f5f5f5] hover:bg-[#fee2e2] text-[#e7000b] border border-[#e5e5e5] hover:border-[#fecaca] rounded-[18px] text-xs font-medium transition-all active:scale-95 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cerrar Sesión</span>
          </button>
        </div>

        {/* =========================================================
            ZONA DE PELIGRO: ELIMINAR CUENTA
           ========================================================= */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 px-1">
            <h3 className="text-xs font-semibold uppercase tracking-[0.05em] text-[#e7000b]">
              Zona de Peligro
            </h3>
          </div>

          <div className="bg-white border border-[#fecaca] rounded-3xl overflow-hidden shadow-ui-subtle">
            <button
              type="button"
              onClick={() => setDeleteAccountModalOpen(true)}
              className="w-full p-5 flex items-center justify-between hover:bg-[#fee2e2]/40 transition-colors text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#fee2e2] border border-[#fecaca] text-[#e7000b] flex items-center justify-center transition-colors">
                  <Trash2 className="w-5 h-5 text-[#e7000b]" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-[#0a0a0a] group-hover:text-[#e7000b] transition-colors">
                    Eliminar Cuenta
                  </h4>
                  <p className="text-xs text-[#737373]">
                    Cierre definitivo de cuenta, baja de depósitos propios y purga irreversible de datos
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#737373] group-hover:text-[#e7000b] transition-colors" />
            </button>
          </div>
        </div>

        {/* Pie Legal y Enlaces a Términos y Privacidad (RF-LEGAL-001) */}
        <div className="pt-4 pb-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#737373] border-t border-[#e5e5e5]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#0a0a0a]">STOCKLY</span>
            <span>·</span>
            <span>v2.4.0</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <a
              href="/terms"
              onClick={(e) => {
                e.preventDefault();
                window.history.pushState({}, '', '/terms');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className="text-[#0a0a0a] hover:underline font-medium"
            >
              Términos de Servicio
            </a>
            <span>·</span>
            <a
              href="/privacy"
              onClick={(e) => {
                e.preventDefault();
                window.history.pushState({}, '', '/privacy');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className="text-[#0a0a0a] hover:underline font-medium"
            >
              Política de Privacidad
            </a>
          </div>
        </div>
      </div>
    </div>

      {/* Modales vinculados */}
      <EditInventoryModal
        isOpen={editInventoryMode !== null}
        onClose={() => setEditInventoryMode(null)}
        inventory={currentInventory}
        onUpdated={refreshInventories}
        mode={editInventoryMode || 'info'}
      />

      <BatchLocationsPrintModal
        isOpen={batchLocationsOpen}
        onClose={() => setBatchLocationsOpen(false)}
      />

      {isBusiness && (
        <CouponsManagementModal
          isOpen={couponsOpen}
          onClose={() => setCouponsOpen(false)}
        />
      )}

      {/* Modal Móvil de Copias de Seguridad */}
      {isOwner && (
        <BackupManagementModal
          isOpen={backupModalOpen}
          onClose={() => setBackupModalOpen(false)}
          onRestoreCompleted={() => {
            refreshInventories();
            if (onRefreshInventoryData) onRefreshInventoryData();
          }}
        />
      )}

      {/* Modal de Confirmación de Eliminación Definitiva */}
      <DeleteAccountModal
        isOpen={deleteAccountModalOpen}
        onClose={() => setDeleteAccountModalOpen(false)}
      />
    </>
  );
};

export default SettingsPage;
