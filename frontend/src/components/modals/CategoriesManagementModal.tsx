import React, { useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
import { CancelButton } from '../common/CancelButton';
import { MinimalDropdown } from '../ui/MinimalDropdown';
import {
  ModalShell,
  ModalHeader,
  ModalTabsBar,
  ModalBody,
  ModalFooter,
  modalFieldCompactInputClass,
  modalFieldLabelClass,
  modalSurfaceCardClass,
  modalPrimaryButtonClass
} from './ModalShell';

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

  const activeCreateFormId = mainTab === 'create'
    ? createType === 'category'
      ? 'create-category-form'
      : 'create-subcategory-form'
    : undefined;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="lg"
      disableDismiss={isSubmitting}
      formId={activeCreateFormId}
    >
      <ModalHeader
        title="Categorías y subcategorías"
        subtitle="Estructura taxonómica del catálogo de productos"
        icon={<Tag className="w-4 h-4 lg:w-5 lg:h-5" />}
        iconTone="indigo"
        onClose={onClose}
        closeDisabled={isSubmitting}
      />

      <ModalTabsBar>
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
      </ModalTabsBar>

      <ModalBody className="space-y-4">
        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-200">
            {errorMsg}
          </div>
        )}

        <AnimatePresence mode="wait" initial={false}>
          {mainTab === 'create' ? (
            <motion.div
              key="cat-create"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.14 }}
              className="space-y-4"
            >
              {/* Selector de Tipo a Crear */}
              <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
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

              {createType === 'category' ? (
                <form
                  id="create-category-form"
                  onSubmit={handleCreateCategory}
                  className={`${modalSurfaceCardClass} space-y-3.5`}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className={modalFieldLabelClass}>
                        Nombre de categoría <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={catName}
                        onChange={(e) => setCatName(e.target.value)}
                        placeholder="Ej. Bebidas, Ferretería, Lácteos..."
                        required
                        className={modalFieldCompactInputClass}
                      />
                    </div>

                    <div>
                      <label className={modalFieldLabelClass}>Color de etiqueta</label>
                      <div className="flex items-center gap-2.5 pt-1.5 flex-wrap">
                        {PRESET_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setCatColor(c)}
                            aria-label={`Color ${c}`}
                            style={{ backgroundColor: c }}
                            className={`w-7 h-7 lg:w-6 lg:h-6 rounded-full transition-[transform,opacity] duration-150 cursor-pointer ${
                              catColor === c
                                ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110'
                                : 'opacity-70 hover:opacity-100'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className={modalFieldLabelClass}>Descripción (opcional)</label>
                    <input
                      type="text"
                      value={catDesc}
                      onChange={(e) => setCatDesc(e.target.value)}
                      placeholder="Breve descripción o notas de la familia..."
                      className={modalFieldCompactInputClass}
                    />
                  </div>
                </form>
              ) : (
                <form
                  id="create-subcategory-form"
                  onSubmit={handleCreateSubcategory}
                  className={`${modalSurfaceCardClass} space-y-3.5`}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className={modalFieldLabelClass}>
                        Categoría padre <span className="text-rose-400">*</span>
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
                      <label className={modalFieldLabelClass}>
                        Nombre de subcategoría <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={subName}
                        onChange={(e) => setSubName(e.target.value)}
                        placeholder="Ej. Gaseosas, Jugos, Herramientas..."
                        required
                        className={modalFieldCompactInputClass}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={modalFieldLabelClass}>Descripción (opcional)</label>
                    <input
                      type="text"
                      value={subDesc}
                      onChange={(e) => setSubDesc(e.target.value)}
                      placeholder="Detalles sobre los artículos de esta subclasificación..."
                      className={modalFieldCompactInputClass}
                    />
                  </div>
                </form>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="cat-existing"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.14 }}
              className="space-y-3.5"
            >
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nombre o descripción..."
                  className={`${modalFieldCompactInputClass} pl-10 pr-8`}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-100 p-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
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

              {filterType === 'subcategories' && categories.length > 0 && (
                <div className="flex items-center gap-2.5">
                  <Filter className="w-4 h-4 text-slate-400 shrink-0" />
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

              <div className="max-h-[340px] overflow-y-auto overscroll-contain custom-scrollbar-dark space-y-2 border border-slate-800/80 rounded-2xl bg-slate-950/45 p-3">
                {filteredCategories.length === 0 && filteredSubcategories.length === 0 ? (
                  <div className="text-center py-10 text-xs text-slate-400 space-y-2">
                    <p>No se encontraron resultados para la consulta actual.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setFilterType('categories');
                        setParentCategoryFilter('all');
                      }}
                      className="text-xs text-indigo-300 underline font-semibold cursor-pointer"
                    >
                      Restablecer filtros
                    </button>
                  </div>
                ) : (
                  <>
                    {filteredCategories.length > 0 && (
                      <div className="space-y-1.5">
                        {filteredCategories.map((cat) => {
                          const catSubCount = subcategories.filter(s => s.category_id === cat.id).length;
                          return (
                            <div
                              key={cat.id}
                              className="p-3 bg-slate-900/90 rounded-xl border border-slate-800/80 flex items-center justify-between gap-2 hover:border-slate-700 transition-colors"
                            >
                              <div className="flex items-center gap-3 min-w-0 pr-2">
                                <span
                                  className="w-3.5 h-3.5 rounded-full ring-2 ring-slate-900 shrink-0"
                                  style={{ backgroundColor: cat.color || '#3B82F6' }}
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="text-xs font-semibold text-slate-100 truncate">
                                      {cat.name}
                                    </h4>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-mono tabular-nums font-medium">
                                      {catSubCount} {catSubCount === 1 ? 'subcat.' : 'subcats.'}
                                    </span>
                                  </div>
                                  {cat.description && (
                                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                      {cat.description}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleDeleteCategory(cat.id)}
                                className="min-h-[36px] min-w-[36px] lg:min-h-[32px] lg:min-w-[32px] flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer shrink-0"
                                title="Eliminar categoría"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {filteredSubcategories.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        {filteredSubcategories.map((sub) => {
                          const parentCat = categories.find((c) => c.id === sub.category_id);
                          return (
                            <div
                              key={sub.id}
                              className="p-3 bg-slate-900/90 rounded-xl border border-slate-800/80 flex items-center justify-between gap-2 hover:border-slate-700 transition-colors"
                            >
                              <div className="min-w-0 pr-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="text-xs font-semibold text-slate-100 truncate">
                                    {sub.name}
                                  </h4>
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-200 font-medium">
                                    {parentCat?.name || 'Categoría'}
                                  </span>
                                </div>
                                {sub.description && (
                                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                    {sub.description}
                                  </p>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() => handleDeleteSubcategory(sub.id)}
                                className="min-h-[36px] min-w-[36px] lg:min-h-[32px] lg:min-w-[32px] flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer shrink-0"
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
            </motion.div>
          )}
        </AnimatePresence>
      </ModalBody>

      <ModalFooter shortcutLabel={mainTab === 'create' ? 'para crear' : undefined}>
        <CancelButton onClick={onClose} label="Cerrar" disabled={isSubmitting} />
        {mainTab === 'create' && createType === 'category' && (
          <button
            type="submit"
            form="create-category-form"
            disabled={isSubmitting || !catName.trim()}
            className={modalPrimaryButtonClass}
          >
            {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            <span>Crear categoría</span>
          </button>
        )}
        {mainTab === 'create' && createType === 'subcategory' && (
          <button
            type="submit"
            form="create-subcategory-form"
            disabled={isSubmitting || !selectedCatId || !subName.trim()}
            className={modalPrimaryButtonClass}
          >
            {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            <span>Crear subcategoría</span>
          </button>
        )}
      </ModalFooter>
    </ModalShell>
  );
};
