import React, { useState, useMemo } from 'react';
import {
  X,
  Tag,
  Plus,
  Trash2,
  Layers,
  FolderPlus,
  Loader2,
  Search,
  Filter
} from 'lucide-react';
import { Category, Subcategory } from '../../types/database';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { matchesAnyField, normalizeText } from '../../utils/searchUtils';
import { PillOption } from '../common/PillOption';
import { MinimalDropdown } from '../ui/MinimalDropdown';

interface CategoriesManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  subcategories: Subcategory[];
  onRefresh: () => void;
}

const PRESET_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#64748B'
];

export const CategoriesManagementModal: React.FC<CategoriesManagementModalProps> = ({
  isOpen,
  onClose,
  categories,
  subcategories,
  onRefresh
}) => {
  const { currentInventory } = useAuth();

  // Pestaña Principal (RF-UI-CAT-011): 'create' | 'existing'
  const [mainTab, setMainTab] = useState<'create' | 'existing'>('create');

  // Sub-selector dentro de 'Crear': registrar categoría o subcategoría
  const [createType, setCreateType] = useState<'category' | 'subcategory'>('category');

  // Filtros y buscador dentro de 'Existentes'
  const [filterType, setFilterType] = useState<'categories' | 'subcategories'>('categories');
  const [searchQuery, setSearchQuery] = useState('');
  const [parentCategoryFilter, setParentCategoryFilter] = useState<string>('all');

  // Formulario Categoría
  const [catName, setCatName] = useState('');
  const [catColor, setCatColor] = useState(PRESET_COLORS[0]);
  const [catDesc, setCatDesc] = useState('');

  // Formulario Subcategoría
  const [subName, setSubName] = useState('');
  const [subDesc, setSubDesc] = useState('');
  const [selectedCatId, setSelectedCatId] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const totalCount = categories.length + subcategories.length;

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInventory || !catName.trim()) return;

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      const { error } = await supabase.from('categories').insert({
        inventory_id: currentInventory.id,
        name: catName.trim(),
        color: catColor,
        description: catDesc.trim() || null
      });

      if (error) throw error;

      setCatName('');
      setCatDesc('');
      onRefresh();
      setMainTab('existing');
      setFilterType('categories');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al crear la categoría.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInventory || !selectedCatId || !subName.trim()) return;

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      const { error } = await supabase.from('subcategories').insert({
        inventory_id: currentInventory.id,
        category_id: selectedCatId,
        name: subName.trim(),
        description: subDesc.trim() || null
      });

      if (error) throw error;

      setSubName('');
      setSubDesc('');
      onRefresh();
      setMainTab('existing');
      setFilterType('subcategories');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al crear la subcategoría.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('¿Eliminar esta categoría? También se eliminarán sus subcategorías asociadas.')) return;
    try {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
      onRefresh();
    } catch (err: any) {
      alert('Error eliminando categoría: ' + err.message);
    }
  };

  const handleDeleteSubcategory = async (id: string) => {
    if (!confirm('¿Eliminar esta subcategoría?')) return;
    try {
      const { error } = await supabase.from('subcategories').delete().eq('id', id);
      if (error) throw error;
      onRefresh();
    } catch (err: any) {
      alert('Error eliminando subcategoría: ' + err.message);
    }
  };

  // Filtrado reactivo en tiempo real para la pestaña 'Existentes' (RF-SEARCH-016: Tolerancia a acentos)
  const filteredCategories = useMemo(() => {
    if (filterType === 'subcategories') return [];
    const norm = normalizeText(searchQuery);
    return categories.filter((c) => {
      return !norm || matchesAnyField([c.name, c.description], norm);
    });
  }, [categories, filterType, searchQuery]);

  const filteredSubcategories = useMemo(() => {
    if (filterType === 'categories') return [];
    const norm = normalizeText(searchQuery);
    return subcategories.filter((s) => {
      const matchesSearch = !norm || matchesAnyField([s.name, s.description], norm);
      const matchesParent =
        parentCategoryFilter === 'all' || s.category_id === parentCategoryFilter;
      return matchesSearch && matchesParent;
    });
  }, [subcategories, filterType, searchQuery, parentCategoryFilter]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="mobile-dark-modal bg-[#ffffff] border border-[#ececec] rounded-2xl md:rounded-3xl w-full max-w-xl max-h-[85dvh] overflow-hidden shadow-2xl flex flex-col font-sans">
        
        {/* Cabecera Principal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#ececec] bg-[#ffffff] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#17191c]/10 text-[#17191c] flex items-center justify-center shrink-0">
              <Tag className="w-5 h-5 text-[#17191c]" />
            </div>
            <div>
              <h3 className="font-bold text-[#17191c] text-base uppercase tracking-tight">
                Categorías y Subcategorías
              </h3>
              <p className="text-[11px] text-[#777b86]">
                Estructura taxonómica del catálogo de productos
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#17191c] hover:bg-[#fafafb] border border-[#ececec] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Barra de Pestañas Tipo Píldora (RF-UI-CAT-011 & RF-UI-TABS-008) */}
        <div className="mobile-tabs-bar flex items-center gap-2 px-6 py-3 border-b border-[#ececec] bg-white shrink-0 overflow-x-auto">
          <PillOption
            active={mainTab === 'create'}
            onClick={() => setMainTab('create')}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            Crear
          </PillOption>

          <PillOption
            active={mainTab === 'existing'}
            onClick={() => setMainTab('existing')}
            badge={totalCount}
          >
            Existentes
          </PillOption>
        </div>

        {/* Mensaje de Error Global */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
            {errorMsg}
          </div>
        )}

        {/* Contenido según Pestaña */}
        <div className="p-6 overflow-y-auto space-y-4">
          
          {/* =========================================================
              VISTA 1: CREAR (Formulario Único sin Scroll Excesivo)
             ========================================================= */}
          {mainTab === 'create' && (
            <div className="space-y-4 animate-in fade-in">
              {/* Selector de Tipo a Crear: Categoría vs Subcategoría */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <PillOption
                  active={createType === 'category'}
                  onClick={() => setCreateType('category')}
                  icon={<FolderPlus className="w-3.5 h-3.5" />}
                  className="flex-1"
                >
                  Categoría
                </PillOption>
                <PillOption
                  active={createType === 'subcategory'}
                  onClick={() => setCreateType('subcategory')}
                  icon={<Layers className="w-3.5 h-3.5" />}
                  className="flex-1"
                >
                  Subcategoría
                </PillOption>
              </div>

              {/* Formulario 1A: Categoría */}
              {createType === 'category' ? (
                <form onSubmit={handleCreateCategory} className="p-4 bg-[#fafafb] rounded-2xl border border-[#ececec] space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#17191c] mb-1">
                        Nombre de Categoría <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={catName}
                        onChange={(e) => setCatName(e.target.value)}
                        placeholder="Ej. Bebidas, Ferretería, Lácteos..."
                        required
                        className="w-full bg-white border border-[#ececec] focus:border-[#17191c] rounded-xl px-3 py-2 text-xs text-[#17191c] placeholder:text-neutral-400 focus:outline-none transition-all box-border"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#17191c] mb-1">
                        Color de Etiqueta
                      </label>
                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        {PRESET_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setCatColor(c)}
                            style={{ backgroundColor: c }}
                            className={`w-6 h-6 rounded-full transition-[transform,opacity] duration-150 cursor-pointer ${
                              catColor === c
                                ? 'ring-2 ring-slate-900 ring-offset-1 scale-110'
                                : 'opacity-75 hover:opacity-100'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#17191c] mb-1">
                      Descripción (Opcional)
                    </label>
                    <input
                      type="text"
                      value={catDesc}
                      onChange={(e) => setCatDesc(e.target.value)}
                      placeholder="Breve descripción o notas de la familia de productos..."
                      className="w-full bg-white border border-[#ececec] focus:border-[#17191c] rounded-xl px-3 py-2 text-xs text-[#17191c] placeholder:text-neutral-400 focus:outline-none transition-all box-border"
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting || !catName.trim()}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#17191c] hover:bg-black text-white text-xs font-semibold rounded-xl shadow-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                      <span>Crear Categoría</span>
                    </button>
                  </div>
                </form>
              ) : (
                /* Formulario 1B: Subcategoría */
                <form onSubmit={handleCreateSubcategory} className="p-4 bg-[#fafafb] rounded-2xl border border-[#ececec] space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#17191c] mb-1">
                        Categoría Padre <span className="text-rose-500">*</span>
                      </label>
                      <MinimalDropdown
                        value={selectedCatId}
                        onChange={(val) => setSelectedCatId(val)}
                        placeholder="Selecciona una categoría..."
                        options={[
                          { value: '', label: 'Selecciona una categoría...' },
                          ...categories.map((c) => ({
                            value: c.id,
                            label: c.name
                          }))
                        ]}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#17191c] mb-1">
                        Nombre de Subcategoría <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={subName}
                        onChange={(e) => setSubName(e.target.value)}
                        placeholder="Ej. Gaseosas, Jugos, Herramientas manuales..."
                        required
                        className="w-full bg-white border border-[#ececec] focus:border-[#17191c] rounded-xl px-3 py-2 text-xs text-[#17191c] placeholder:text-neutral-400 focus:outline-none transition-all box-border"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#17191c] mb-1">
                      Descripción (Opcional)
                    </label>
                    <input
                      type="text"
                      value={subDesc}
                      onChange={(e) => setSubDesc(e.target.value)}
                      placeholder="Detalles sobre los artículos de esta subclasificación..."
                      className="w-full bg-white border border-[#ececec] focus:border-[#17191c] rounded-xl px-3 py-2 text-xs text-[#17191c] placeholder:text-neutral-400 focus:outline-none transition-all box-border"
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting || !selectedCatId || !subName.trim()}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#17191c] hover:bg-black text-white text-xs font-semibold rounded-xl shadow-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                      <span>Crear Subcategoría</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* =========================================================
              VISTA 2: EXISTENTES (Filtros Chips, Buscador y Lista Bounded)
             ========================================================= */}
          {mainTab === 'existing' && (
            <div className="space-y-3.5 animate-in fade-in">
              
              {/* Buscador Rápido Integrado */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nombre o descripción..."
                  className="w-full h-10 pl-9 pr-8 bg-zinc-100 rounded-xl text-xs text-[#17191c] placeholder:text-zinc-400 focus:bg-white focus:ring-1 focus:ring-[#17191c] focus:outline-none transition-all box-border"
                />
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3 pointer-events-none" />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-600 p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filtro de Visualización Secundario Tipo Píldora Estandarizada */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <PillOption
                  active={filterType === 'categories'}
                  onClick={() => setFilterType('categories')}
                  badge={categories.length}
                >
                  Categorías
                </PillOption>
                <PillOption
                  active={filterType === 'subcategories'}
                  onClick={() => setFilterType('subcategories')}
                  badge={subcategories.length}
                >
                  Subcategorías
                </PillOption>
              </div>

              {/* Filtro adicional por Categoría Padre si está en subcategorías */}
              {filterType === 'subcategories' && categories.length > 0 && (
                <div className="flex items-center gap-2 pt-0.5">
                  <Filter className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <div className="flex-1">
                    <MinimalDropdown
                      value={parentCategoryFilter}
                      onChange={(val) => setParentCategoryFilter(val)}
                      options={[
                        { value: 'all', label: 'Todas las categorías padre' },
                        ...categories.map((c) => ({
                          value: c.id,
                          label: `Filtrar por: ${c.name}`
                        }))
                      ]}
                    />
                  </div>
                </div>
              )}

              {/* Contenedor Scrolleable Independiente (Evita Scroll Infinito) */}
              <div className="max-h-[360px] overflow-y-auto overscroll-contain space-y-2.5 border border-[#ececec] rounded-2xl bg-[#fafafb]/40 p-3">
                {filteredCategories.length === 0 && filteredSubcategories.length === 0 ? (
                  <div className="text-center py-10 text-xs text-[#777b86] space-y-2">
                    <p>No se encontraron resultados para la consulta actual.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setFilterType('categories');
                        setParentCategoryFilter('all');
                      }}
                      className="text-xs text-[#17191c] underline font-semibold cursor-pointer"
                    >
                      Restablecer filtros
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Sección Categorías */}
                    {filteredCategories.length > 0 && (
                      <div className="space-y-1.5">
                        {filteredCategories.map((cat) => {
                          const catSubCount = subcategories.filter(s => s.category_id === cat.id).length;
                          return (
                            <div
                              key={cat.id}
                              className="p-3 bg-white rounded-xl border border-[#ececec] flex items-center justify-between group hover:border-[#17191c]/40 transition-colors shadow-2xs"
                            >
                              <div className="flex items-center gap-3 min-w-0 pr-2">
                                <span
                                  className="w-3.5 h-3.5 rounded-full ring-2 ring-white shrink-0 shadow-2xs"
                                  style={{ backgroundColor: cat.color || '#3B82F6' }}
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <h4 className="text-xs font-bold text-[#17191c] truncate">
                                      {cat.name}
                                    </h4>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-600 font-mono font-medium">
                                      {catSubCount} {catSubCount === 1 ? 'subcat.' : 'subcats.'}
                                    </span>
                                  </div>
                                  {cat.description && (
                                    <p className="text-[11px] text-[#777b86] truncate mt-0.5">
                                      {cat.description}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleDeleteCategory(cat.id)}
                                className="p-1.5 text-neutral-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer shrink-0"
                                title="Eliminar categoría"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Sección Subcategorías */}
                    {filteredSubcategories.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        {filteredSubcategories.map((sub) => {
                          const parentCat = categories.find((c) => c.id === sub.category_id);
                          return (
                            <div
                              key={sub.id}
                              className="p-3 bg-white rounded-xl border border-[#ececec] flex items-center justify-between group hover:border-[#17191c]/40 transition-colors shadow-2xs"
                            >
                              <div className="min-w-0 pr-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="text-xs font-bold text-[#17191c] truncate">
                                    {sub.name}
                                  </h4>
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#17191c]/10 text-[#17191c] font-semibold">
                                    {parentCat?.name || 'Categoría'}
                                  </span>
                                </div>
                                {sub.description && (
                                  <p className="text-[11px] text-[#777b86] truncate mt-0.5">
                                    {sub.description}
                                  </p>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() => handleDeleteSubcategory(sub.id)}
                                className="p-1.5 text-neutral-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer shrink-0"
                                title="Eliminar subcategoría"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
