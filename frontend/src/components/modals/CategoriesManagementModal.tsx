import React, { useState } from 'react';
import { X, Tag, Plus, Trash2, Layers, FolderPlus, Loader2 } from 'lucide-react';
import { Category, Subcategory } from '../../types/database';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
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
  const [activeTab, setActiveTab] = useState<'categories' | 'subcategories'>('categories');

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="mobile-dark-modal bg-[#ffffff] border border-[#E5E7EB] rounded-2xl w-full max-w-xl overflow-hidden shadow-xl flex flex-col max-h-[90vh]">
        {/* Cabecera */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB] bg-[#ffffff]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1E3A5F]/10 text-[#1E3A5F] flex items-center justify-center">
              <Tag className="w-5 h-5 text-[#1E3A5F]" />
            </div>
            <div>
              <h3 className="font-bold text-[#1E3A5F] text-base uppercase tracking-tight">Categorías y Subcategorías</h3>
              <p className="text-[11px] text-[#616161]">Estructura de clasificación de productos</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#1E3A5F] hover:bg-[#F8F9FA] border border-[#E5E7EB] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Pestañas */}
        <div className="mobile-tabs-bar flex border-b border-[#E5E7EB] bg-[#F8F9FA]">
          <button
            onClick={() => setActiveTab('categories')}
            className={`flex-1 py-3 text-xs uppercase tracking-wider font-mono flex items-center justify-center gap-2 border-b-2 transition-all ${
              activeTab === 'categories'
                ? 'border-[#1E3A5F] text-[#1E3A5F] bg-white font-medium mobile-tab-active'
                : 'border-transparent text-[#616161] hover:text-[#1E3A5F]'
            }`}
          >
            <Tag className="w-3.5 h-3.5" /> Categorías ({categories.length})
          </button>
          <button
            onClick={() => setActiveTab('subcategories')}
            className={`flex-1 py-3 text-xs uppercase tracking-wider font-mono flex items-center justify-center gap-2 border-b-2 transition-all ${
              activeTab === 'subcategories'
                ? 'border-[#1E3A5F] text-[#1E3A5F] bg-white font-medium mobile-tab-active'
                : 'border-transparent text-[#616161] hover:text-[#1E3A5F]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Subcategorías ({subcategories.length})
          </button>
        </div>

        {/* Contenido con scroll */}
        <div className="p-6 overflow-y-auto space-y-6 font-mono">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
              {errorMsg}
            </div>
          )}

          {activeTab === 'categories' ? (
            <>
              {/* Formulario Nueva Categoría */}
              <form onSubmit={handleCreateCategory} className="mobile-flat-section p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-300 flex items-center gap-1.5">
                  <FolderPlus className="w-4 h-4 text-blue-500 dark:text-blue-400" /> Nueva Categoría
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">Nombre</label>
                    <input
                      type="text"
                      value={catName}
                      onChange={e => setCatName(e.target.value)}
                      placeholder="Ej: Materiales Eléctricos"
                      required
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">Color de Etiqueta</label>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {PRESET_COLORS.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCatColor(c)}
                          style={{ backgroundColor: c }}
                          className={`w-6 h-6 rounded-full transition-all ${
                            catColor === c ? 'ring-2 ring-slate-800 dark:ring-white scale-110 shadow-sm' : 'opacity-70 hover:opacity-100'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">Descripción (Opcional)</label>
                  <input
                    type="text"
                    value={catDesc}
                    onChange={e => setCatDesc(e.target.value)}
                    placeholder="Breve descripción o notas..."
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Crear Categoría
                  </button>
                </div>
              </form>

              {/* Lista de Categorías Existentes */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Categorías Creadas</span>
                {categories.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">No hay categorías aún. Crea la primera arriba.</p>
                ) : (
                  categories.map(cat => (
                    <div
                      key={cat.id}
                      className="mobile-flat-row p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between group hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="w-3.5 h-3.5 rounded-full ring-2 ring-white dark:ring-slate-900"
                          style={{ backgroundColor: cat.color || '#3B82F6' }}
                        />
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">{cat.name}</h4>
                          {cat.description && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">{cat.description}</p>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-colors"
                        title="Eliminar categoría"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              {/* Formulario Nueva Subcategoría */}
              <form onSubmit={handleCreateSubcategory} className="mobile-flat-section p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-300 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-blue-500 dark:text-blue-400" /> Nueva Subcategoría
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">Categoría Padre <span className="text-blue-500">*</span></label>
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
                    {false && (
                    <select
                      value={selectedCatId}
                      onChange={e => setSelectedCatId(e.target.value)}
                      required
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">Selecciona una categoría...</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">Nombre Subcategoría</label>
                    <input
                      type="text"
                      value={subName}
                      onChange={e => setSubName(e.target.value)}
                      placeholder="Ej: Cables, Interruptores..."
                      required
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">Descripción (Opcional)</label>
                  <input
                    type="text"
                    value={subDesc}
                    onChange={e => setSubDesc(e.target.value)}
                    placeholder="Detalles..."
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={isSubmitting || !selectedCatId}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Crear Subcategoría
                  </button>
                </div>
              </form>

              {/* Lista de Subcategorías */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Subcategorías Existentes</span>
                {subcategories.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">No hay subcategorías registradas.</p>
                ) : (
                  subcategories.map(sub => {
                    const parentCat = categories.find(c => c.id === sub.category_id);
                    return (
                      <div
                        key={sub.id}
                        className="mobile-flat-row p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between group hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white">{sub.name}</h4>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                              {parentCat?.name || 'Categoría'}
                            </span>
                          </div>
                          {sub.description && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{sub.description}</p>
                          )}
                        </div>

                        <button
                          onClick={() => handleDeleteSubcategory(sub.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-colors"
                          title="Eliminar subcategoría"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
