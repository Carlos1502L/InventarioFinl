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
      <div className="hidden md:block space-y-6 pb-28 sm:pb-12 max-w-4xl mx-auto font-sans text-slate-900">
      {/* 1. Cabecera Directa */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-[-0.03em] text-slate-900">
            Configuración y preferencias
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Estructura de catálogo, pasarelas de cobro y gobernanza del equipo.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-mono text-slate-700 text-xs font-medium">
            v2.4.0
          </span>
        </div>
      </div>

      {/* =========================================================
          BLOQUE 1: IDENTIDAD DEL DEPÓSITO ACTIVO
         ========================================================= */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-ui-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center flex-shrink-0">
              <Layers className="w-5 h-5 stroke-[1.8]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[11px] text-slate-500 font-medium">
                  Depósito activo
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 font-medium inline-flex items-center gap-1">
                  {currentInventory?.inventory_type === 'PERSONAL' ? (
                    <>
                      <User className="w-3 h-3" /> Personal
                    </>
                  ) : (
                    <>
                      <Briefcase className="w-3 h-3" /> Negocio
                    </>
                  )}
                </span>
              </div>
              <h2 className="font-semibold text-lg text-slate-900 tracking-tight truncate">
                {currentInventory?.name || 'Sin seleccionar'}
              </h2>
              <p className="text-xs text-slate-500 truncate">
                {currentInventory?.description || 'Sin notas descriptivas del depósito.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setEditInventoryMode('info')}
              className="px-3.5 min-h-[36px] bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 hover:border-slate-300 text-xs font-medium rounded-xl transition-[background-color,border-color,transform] duration-150 active:scale-[0.97] flex items-center gap-1.5 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{isOwner ? 'Editar información' : 'Información'}</span>
            </button>
            <button
              onClick={onOpenInventorySelector}
              className="px-4 min-h-[36px] bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-xl transition-[background-color,transform] duration-150 active:scale-[0.97] cursor-pointer"
            >
              Cambiar
            </button>
          </div>
        </div>

        {/* Metadatos en Fila */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100 text-xs">
          <div>
            <span className="text-[11px] text-slate-500 block">Moneda base</span>
            <span className="font-mono text-slate-900 font-semibold">{currentInventory?.currency || 'PEN'}</span>
          </div>
          <div>
            <span className="text-[11px] text-slate-500 block">Tasa operativa</span>
            <span className="font-mono text-slate-900 font-semibold tabular-nums">{Number(currentInventory?.exchange_rate || 1.000).toFixed(3)}</span>
          </div>
          <div>
            <span className="text-[11px] text-slate-500 block">Nivel de acceso</span>
            <span className="text-slate-900 font-semibold capitalize">{currentInventory?.role || 'owner'}</span>
          </div>
          <div>
            <span className="text-[11px] text-slate-500 block">Fecha de alta</span>
            <span className="text-slate-900 font-semibold tabular-nums">{formatDate(currentInventory?.created_at)}</span>
          </div>
        </div>
      </div>

      {/* =========================================================
          BLOQUE 2: OPERACIONES COMERCIALES (SÓLO SI ES NEGOCIO)
         ========================================================= */}
      {isBusiness && (
        <div className="space-y-2.5">
          <h3 className="text-xs font-semibold text-slate-500 px-1">
            Operaciones y pagos
          </h3>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-ui-card divide-y divide-slate-100">
            <button
              onClick={() => setEditInventoryMode('payments')}
              className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-slate-50 transition-colors duration-150 text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                  <QrCode className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-semibold text-sm text-slate-900">Método de pago</h4>
                  <p className="text-xs text-slate-500 truncate">Configura tus códigos QR Yape/Plin y números asociados</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 transition-colors shrink-0" />
            </button>

            <button
              onClick={() => setCouponsOpen(true)}
              className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-slate-50 transition-colors duration-150 text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                  <Ticket className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-semibold text-sm text-slate-900">Cupones promocionales</h4>
                  <p className="text-xs text-slate-500 truncate">Crea y audita códigos de descuento porcentuales o fijos</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 transition-colors shrink-0" />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================
          BLOQUE 3: ESTRUCTURA DEL CATÁLOGO & LOGÍSTICA
         ========================================================= */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-semibold text-slate-500 px-1">
          Estructura y logística
        </h3>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-ui-card divide-y divide-slate-100">
          <button
            onClick={onOpenCategories}
            className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-slate-50 transition-colors duration-150 text-left group cursor-pointer"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                <Tag className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="font-semibold text-sm text-slate-900">Categorías y subcategorías</h4>
                <p className="text-xs text-slate-500 truncate">Taxonomía de familias de productos y clasificación</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 transition-colors shrink-0" />
          </button>

          <button
            onClick={onOpenLocations}
            className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-slate-50 transition-colors duration-150 text-left group cursor-pointer"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="font-semibold text-sm text-slate-900">Ubicaciones físicas y almacenes</h4>
                <p className="text-xs text-slate-500 truncate">Estructura espacial de pasillos, estanterías y zonas</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 transition-colors shrink-0" />
          </button>

          <button
            onClick={() => setBatchLocationsOpen(true)}
            className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-slate-50 transition-colors duration-150 text-left group cursor-pointer"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                <Printer className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="font-semibold text-sm text-slate-900">Impresión de rótulos QR</h4>
                <p className="text-xs text-slate-500 truncate">Credenciales de estantería en formato estándar 85.6 × 53.9 mm</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 transition-colors shrink-0" />
          </button>
        </div>
      </div>

      {/* =========================================================
          BLOQUE 4: GOBERNANZA, PWA & ACCESO
         ========================================================= */}
      <div className="space-y-4">
        <div className="space-y-2.5">
          <h3 className="text-xs font-semibold text-slate-500 px-1">
            Gobernanza y aplicación
          </h3>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-ui-card">
            <button
              onClick={onOpenCollaborators}
              className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-slate-50 transition-colors duration-150 text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-semibold text-sm text-slate-900">Equipo y colaboradores</h4>
                  <p className="text-xs text-slate-500 truncate">Invitaciones por correo, asignación de roles y permisos</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 transition-colors shrink-0" />
            </button>
          </div>
        </div>

        {/* COPIAS DE SEGURIDAD */}
        {isOwner && (
          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold text-slate-500 px-1">
              Copias de seguridad y restauración
            </h3>

            <BackupManagementCard
              onRestoreCompleted={() => {
                refreshInventories();
                if (onRefreshInventoryData) onRefreshInventoryData();
              }}
            />
          </div>
        )}

        {/* Tarjeta de Aplicación PWA */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-ui-card space-y-3">
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-4 h-4 text-slate-700" />
            <h4 className="font-semibold text-sm text-slate-900">Aplicación web progresiva (PWA móvil)</h4>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Instala Stockly en dispositivos Android o iOS para operar en pantalla completa y activar el escáner con cámara nativa.
          </p>
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-600 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-900 font-medium">
              <Info className="w-3.5 h-3.5" /> Instalación rápida:
            </div>
            <p><strong>iOS (Safari):</strong> Toca "Compartir" y selecciona "Añadir a la pantalla de inicio".</p>
            <p><strong>Android (Chrome):</strong> Toca el menú de 3 puntos y selecciona "Instalar aplicación".</p>
          </div>
        </div>

        {/* Sesión de Usuario & Cierre */}
        <div className="p-4 sm:p-5 bg-white border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-ui-card">
          <div>
            <span className="text-[11px] text-slate-500 font-medium block">
              Sesión autenticada
            </span>
            <p className="text-xs font-mono font-medium text-slate-900 mt-0.5">{user?.email}</p>
          </div>
          <button
            onClick={() => signOut()}
            className="inline-flex items-center justify-center gap-2 px-4 min-h-[38px] bg-white hover:bg-red-50 text-red-600 border border-slate-200 hover:border-red-200 rounded-xl text-xs font-medium transition-[background-color,border-color,transform] duration-150 active:scale-[0.97] cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cerrar sesión</span>
          </button>
        </div>

        {/* ZONA DE PELIGRO */}
        <div className="space-y-2.5 pt-2">
          <h3 className="text-xs font-semibold text-red-600 px-1">
            Zona de peligro
          </h3>

          <div className="bg-white border border-red-200 rounded-2xl overflow-hidden shadow-ui-card">
            <button
              type="button"
              onClick={() => setDeleteAccountModalOpen(true)}
              className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-red-50/50 transition-colors duration-150 text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-semibold text-sm text-slate-900 group-hover:text-red-600 transition-colors">
                    Eliminar cuenta
                  </h4>
                  <p className="text-xs text-slate-500 truncate">
                    Cierre definitivo de cuenta, baja de depósitos propios y purga irreversible
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-red-600 transition-colors shrink-0" />
            </button>
          </div>
        </div>

        {/* Pie Legal */}
        <div className="pt-4 pb-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 border-t border-slate-200">
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="font-semibold text-slate-900">STOCKLY</span>
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
              className="text-slate-700 hover:text-slate-900 hover:underline font-medium"
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
              className="text-slate-700 hover:text-slate-900 hover:underline font-medium"
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
