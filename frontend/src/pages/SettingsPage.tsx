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
import { formatDate, getApiUrl, supabase } from '../services/supabase';
import { EditInventoryModal } from '../components/modals/EditInventoryModal';
import { BatchLocationsPrintModal } from '../components/modals/BatchLocationsPrintModal';
import { CouponsManagementModal } from '../components/modals/CouponsManagementModal';
import { BackupManagementCard } from '../components/settings/BackupManagementCard';
import { BackupManagementModal } from '../components/modals/BackupManagementModal';

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
  const [confirmDeleteInput, setConfirmDeleteInput] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleAccountDeletion = async () => {
    if (confirmDeleteInput !== 'ELIMINAR') return;
    setIsDeletingAccount(true);
    setDeleteError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(getApiUrl('/users/me'), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Error al eliminar la cuenta');
      }

      // Purga completa de almacenamiento local y bases de datos IndexedDB
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {
        console.warn('Error clearing storage:', e);
      }

      if (typeof window !== 'undefined' && window.indexedDB && window.indexedDB.databases) {
        try {
          const dbs = await window.indexedDB.databases();
          for (const db of dbs) {
            if (db.name) {
              window.indexedDB.deleteDatabase(db.name);
            }
          }
        } catch (e) {
          console.warn('Error purging IndexedDB:', e);
        }
      }

      window.location.replace('/login');
    } catch (err: any) {
      console.error('Error al eliminar la cuenta:', err);
      setDeleteError(err.message || 'Error al procesar la eliminación');
      setIsDeletingAccount(false);
    }
  };

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

          {/* Zona de Peligro Móvil (RF-AUTH-006) */}
          <div className="pt-8 border-t border-neutral-100 mt-6 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <p className="text-[11px] font-mono font-bold uppercase tracking-widest text-red-600">
                Zona de Peligro
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setConfirmDeleteInput('');
                setDeleteError(null);
                setDeleteAccountModalOpen(true);
              }}
              className="w-full py-3.5 px-4 rounded-2xl bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-xs flex items-center justify-center gap-2 border border-red-200/60 active:scale-[0.99] transition-colors"
            >
              <Trash2 className="w-4 h-4 text-red-600" />
              <span>Eliminar cuenta definitivamente</span>
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
          VISTA DE ESCRITORIO (>= 768px / hidden md:block)
         ========================================================= */}
      <div className="hidden md:block space-y-6 pb-28 sm:pb-12 max-w-4xl mx-auto font-normal text-[#1E3A5F]">
      {/* 1. Cabecera Editorial */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-[#E8B4A0] uppercase block">
            PREFERENCES // CONTROL PANEL
          </span>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1E3A5F] uppercase">
            Configuración del Sistema
          </h1>
          <p className="text-xs text-[#616161] font-light mt-0.5">
            Estructura de catálogo, delimitación física, pasarelas de cobro y gobernanza del equipo.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3.5 py-1.5 rounded-full bg-[#F8F9FA] border border-[#E5E7EB] text-[#1E3A5F] font-mono text-xs uppercase">
            v2.4
          </span>
        </div>
      </div>

      {/* =========================================================
          BLOQUE 1: IDENTIDAD DEL DEPÓSITO ACTIVO
         ========================================================= */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#1E3A5F] text-[#E8B4A0] flex items-center justify-center flex-shrink-0 shadow-sm">
              <Layers className="w-6 h-6 stroke-[1.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#E8B4A0]">
                  DEPÓSITO ACTIVO
                </span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-[#F8F9FA] border border-[#E5E7EB] text-[#1E3A5F] flex items-center gap-1">
                  {currentInventory?.inventory_type === 'PERSONAL' ? (
                    <>
                      <User className="w-3 h-3 text-[#E8B4A0]" /> Personal
                    </>
                  ) : (
                    <>
                      <Briefcase className="w-3 h-3 text-[#E8B4A0]" /> Negocio
                    </>
                  )}
                </span>
              </div>
              <h2 className="font-bold text-xl text-[#1E3A5F] uppercase tracking-tight">
                {currentInventory?.name || 'SIN SELECCIONAR'}
              </h2>
              <p className="text-xs text-[#616161] font-light">
                {currentInventory?.description || 'Sin notas descriptivas del depósito.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditInventoryMode('info')}
              className="px-4 py-2 bg-[#F8F9FA] hover:bg-white text-[#1E3A5F] border border-[#E5E7EB] text-xs uppercase tracking-wider rounded-full transition-all active:scale-95 flex items-center gap-1.5 font-mono shadow-xs"
            >
              <Sliders className="w-3.5 h-3.5 text-[#1E3A5F]" />
              <span>{isOwner ? 'Editar Información' : 'Información de Inventario'}</span>
            </button>
            <button
              onClick={onOpenInventorySelector}
              className="px-4 py-2 bg-[#1E3A5F] hover:bg-[#152a45] text-white text-xs uppercase tracking-wider rounded-full shadow-xs transition-all active:scale-95 font-medium cursor-pointer"
            >
              Cambiar
            </button>
          </div>
        </div>

        {/* Metadatos en Fila */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[#E5E7EB] text-xs font-mono text-[#616161]">
          <div>
            <span className="text-[10px] uppercase block">Moneda de Manifiesto:</span>
            <span className="text-[#1E3A5F] font-medium">{currentInventory?.currency || 'PEN'}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase block">Tasa Operativa:</span>
            <span className="text-[#1E3A5F] font-medium font-mono">{Number(currentInventory?.exchange_rate || 1.000).toFixed(3)}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase block">Nivel de Acceso:</span>
            <span className="text-[#1E3A5F] font-medium uppercase">{currentInventory?.role || 'owner'}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase block">Fecha de Alta:</span>
            <span className="text-[#1E3A5F]">{formatDate(currentInventory?.created_at)}</span>
          </div>
        </div>
      </div>

      {/* =========================================================
          BLOQUE 2: OPERACIONES COMERCIALES (SÓLO SI ES NEGOCIO)
         ========================================================= */}
      {isBusiness && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E8B4A0]" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-[#1E3A5F]">
              01 // OPERACIONES & PAGOS
            </h3>
          </div>

          <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-xs divide-y divide-[#E5E7EB]">
            {/* Pasarela Yape / Plin */}
            <button
              onClick={() => setEditInventoryMode('payments')}
              className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-[#F8F9FA]/60 transition-colors text-left group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#F8F9FA] border border-[#E5E7EB] text-[#1E3A5F] flex items-center justify-center group-hover:border-[#E8B4A0] transition-colors">
                  <QrCode className="w-5 h-5 text-[#1E3A5F]" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#1E3A5F] uppercase">Método de Pago</h4>
                  <p className="text-xs text-[#616161] font-light">Configura tus códigos QR y números asociados para el cobro ágil a clientes</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#616161] group-hover:text-[#1E3A5F] transition-colors" />
            </button>

            {/* Cupones de Descuento */}
            <button
              onClick={() => setCouponsOpen(true)}
              className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-[#F8F9FA]/60 transition-colors text-left group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#F8F9FA] border border-[#E5E7EB] text-[#1E3A5F] flex items-center justify-center group-hover:border-[#E8B4A0] transition-colors">
                  <Ticket className="w-5 h-5 text-[#1E3A5F]" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#1E3A5F] uppercase">Cupones de Descuento Promocionales</h4>
                  <p className="text-xs text-[#616161] font-light">Crea y audita códigos de descuento por porcentaje o monto fijo</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#616161] group-hover:text-[#1E3A5F] transition-colors" />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================
          BLOQUE 3: ESTRUCTURA DEL CATÁLOGO & LOGÍSTICA
         ========================================================= */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#E8B4A0]" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-[#1E3A5F]">
            02 // ESTRUCTURA & LOGÍSTICA
          </h3>
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-xs divide-y divide-[#E5E7EB]">
          {/* Categorías y Subcategorías */}
          <button
            onClick={onOpenCategories}
            className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-[#F8F9FA]/60 transition-colors text-left group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#F8F9FA] border border-[#E5E7EB] text-[#1E3A5F] flex items-center justify-center group-hover:border-[#E8B4A0] transition-colors">
                <Tag className="w-5 h-5 text-[#1E3A5F]" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-[#1E3A5F] uppercase">Categorías & Subcategorías Dinámicas</h4>
                <p className="text-xs text-[#616161] font-light">Organización taxonómica, familias de artículos y paleta de distinción</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#616161] group-hover:text-[#1E3A5F] transition-colors" />
          </button>

          {/* Gestión de Ubicaciones Físicas */}
          <button
            onClick={onOpenLocations}
            className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-[#F8F9FA]/60 transition-colors text-left group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#F8F9FA] border border-[#E5E7EB] text-[#1E3A5F] flex items-center justify-center group-hover:border-[#E8B4A0] transition-colors">
                <MapPin className="w-5 h-5 text-[#1E3A5F]" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-[#1E3A5F] uppercase">Ubicaciones Físicas & Almacenes</h4>
                <p className="text-xs text-[#616161] font-light">Estructura espacial de pasillos, estanterías, depósitos y secciones</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#616161] group-hover:text-[#1E3A5F] transition-colors" />
          </button>

          {/* Imprimir Ubicaciones */}
          <button
            onClick={() => setBatchLocationsOpen(true)}
            className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-[#F8F9FA]/60 transition-colors text-left group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#F8F9FA] border border-[#E5E7EB] text-[#1E3A5F] flex items-center justify-center group-hover:border-[#E8B4A0] transition-colors">
                <Printer className="w-5 h-5 text-[#1E3A5F]" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-[#1E3A5F] uppercase">Impresión de Rótulos & Códigos QR</h4>
                <p className="text-xs text-[#616161] font-light">Generación de credenciales físicas para estanterías (formato estándar 85.6 × 53.9 mm)</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#616161] group-hover:text-[#1E3A5F] transition-colors" />
          </button>
        </div>
      </div>

      {/* =========================================================
          BLOQUE 4: GOBERNANZA, PWA & ACCESO
         ========================================================= */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#E8B4A0]" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-[#1E3A5F]">
            03 // GOBERNANZA & APLICACIÓN
          </h3>
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-xs divide-y divide-[#E5E7EB]">
          {/* Equipo y Colaboradores */}
          <button
            onClick={onOpenCollaborators}
            className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-[#F8F9FA]/60 transition-colors text-left group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#F8F9FA] border border-[#E5E7EB] text-[#1E3A5F] flex items-center justify-center group-hover:border-[#E8B4A0] transition-colors">
                <Users className="w-5 h-5 text-[#1E3A5F]" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-[#1E3A5F] uppercase">Equipo & Colaboradores</h4>
                <p className="text-xs text-[#616161] font-light">Invitaciones por correo, asignación de roles y control de privilegios</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#616161] group-hover:text-[#1E3A5F] transition-colors" />
          </button>
        </div>

        {/* =========================================================
            04 // COPIAS DE SEGURIDAD & RESTAURACIÓN (EXCLUSIVO OWNER)
           ========================================================= */}
        {isOwner && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E8B4A0]" />
              <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-[#1E3A5F]">
                04 // COPIAS DE SEGURIDAD & RESTAURACIÓN
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
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 sm:p-6 shadow-xs space-y-3">
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-5 h-5 text-[#1E3A5F]" />
            <h4 className="font-bold text-sm text-[#1E3A5F] uppercase">Aplicación Web Progresiva (PWA Móvil)</h4>
          </div>
          <p className="text-xs text-[#616161] leading-relaxed font-light">
            Esta plataforma está optimizada para smartphones Android e iOS. Puedes instalarla en la pantalla de inicio de tu dispositivo para obtener experiencia a pantalla completa y acceso rápido a la cámara escáner.
          </p>
          <div className="p-3.5 bg-[#F8F9FA] rounded-xl border border-[#E5E7EB] text-[11px] text-[#616161] space-y-1 font-mono">
            <div className="flex items-center gap-1.5 text-[#1E3A5F] font-medium">
              <Info className="w-3.5 h-3.5 text-[#E8B4A0]" /> GUÍA DE INSTALACIÓN RÁPIDA:
            </div>
            <p><strong>iOS (Safari):</strong> Toca "Compartir" y selecciona "Añadir a la pantalla de inicio".</p>
            <p><strong>Android (Chrome):</strong> Toca el menú de 3 puntos y selecciona "Instalar aplicación".</p>
          </div>
        </div>

        {/* Sesión de Usuario & Cierre */}
        <div className="p-4 sm:p-5 bg-white border border-[#E5E7EB] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#E8B4A0] block">
              SESIÓN AUTENTICADA
            </span>
            <p className="text-xs font-mono text-[#1E3A5F] mt-0.5">{user?.email}</p>
          </div>
          <button
            onClick={() => signOut()}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#F8F9FA] hover:bg-rose-50 text-rose-700 hover:text-rose-800 border border-[#E5E7EB] hover:border-rose-300 rounded-full text-xs uppercase tracking-wider font-mono transition-all active:scale-95 shadow-xs"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cerrar Sesión</span>
          </button>
        </div>

        {/* =========================================================
            05 // ZONA DE PELIGRO: ELIMINACIÓN DE CUENTA (RF-AUTH-006)
           ========================================================= */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 px-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-red-600">
              05 // ZONA DE PELIGRO (ELIMINACIÓN DEFINITIVA)
            </h3>
          </div>

          <div className="p-4 sm:p-5 bg-red-50/60 border border-red-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-red-950">Eliminar cuenta de usuario</h4>
              <p className="text-xs text-red-800/80 font-light leading-relaxed">
                Borra permanentemente tu cuenta, todos tus depósitos/inventarios propios, catálogo, ventas y datos locales almacenados. Esta acción es destructiva e irreversible.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setConfirmDeleteInput('');
                setDeleteError(null);
                setDeleteAccountModalOpen(true);
              }}
              className="shrink-0 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold uppercase tracking-wider transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              Eliminar cuenta
            </button>
          </div>
        </div>

        {/* Pie Legal y Enlaces a Términos y Privacidad (RF-LEGAL-001) */}
        <div className="pt-4 pb-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#616161] font-mono border-t border-[#E5E7EB]">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#1E3A5F]">STOCKLY</span>
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
              className="text-[#1E3A5F] hover:underline font-medium"
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
              className="text-[#1E3A5F] hover:underline font-medium"
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

      {/* Modal de Confirmación de Eliminación Definitiva (RF-AUTH-006) */}
      {deleteAccountModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-red-200 text-neutral-900 space-y-4 animate-in fade-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 id="delete-account-title" className="text-base font-bold text-red-950">
                  Eliminar Cuenta Definitivamente
                </h3>
                <p className="text-xs text-neutral-500 font-mono">
                  ACCIÓN DESTRUCTIVA E IRREVERSIBLE
                </p>
              </div>
            </div>

            <div className="p-3 bg-red-50/80 border border-red-200/70 rounded-xl text-xs text-red-900 space-y-2 leading-relaxed">
              <p>
                Esta acción eliminará de forma irreversible tu cuenta de usuario, tus inventarios propios, catálogo de productos, historial de movimientos, ventas y todas las cachés locales.
              </p>
              <p className="font-semibold text-red-950">
                Para confirmar la eliminación permanente, escribe <span className="font-mono bg-red-200/70 px-1 py-0.5 rounded text-red-900 font-bold">ELIMINAR</span> a continuación:
              </p>
            </div>

            <div>
              <input
                type="text"
                value={confirmDeleteInput}
                onChange={(e) => setConfirmDeleteInput(e.target.value)}
                placeholder="Escribe ELIMINAR"
                autoCapitalize="characters"
                disabled={isDeletingAccount}
                className="w-full px-3 py-2.5 border border-neutral-300 rounded-xl font-mono text-center tracking-widest uppercase text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-neutral-50"
              />
            </div>

            {deleteError && (
              <div className="p-2.5 rounded-lg bg-red-100 text-red-700 text-xs text-center font-medium">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (!isDeletingAccount) {
                    setDeleteAccountModalOpen(false);
                  }
                }}
                disabled={isDeletingAccount}
                className="px-4 py-2.5 rounded-xl border border-neutral-200 hover:bg-neutral-100 text-neutral-700 text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAccountDeletion}
                disabled={confirmDeleteInput !== 'ELIMINAR' || isDeletingAccount}
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-2 shadow-xs cursor-pointer active:scale-95"
              >
                {isDeletingAccount && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirmar Eliminación</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SettingsPage;
