import React, { useState } from 'react';
import { X, Tag, Plus, Trash2, Layers, FolderPlus, Loader2 } from 'lucide-react';
import { Category, Subcategory } from '../types/database';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Cabecera */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-xl">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Categorías y Subcategorías Dinámicas</h3>
              <p className="text-xs text-slate-400">Estructura libre para clasificar tus productos</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pestañas */}
        <div className="flex border-b border-slate-800 bg-slate-950/40">
          <button
            onClick={() => setActiveTab('categories')}
            className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition-all ${
              activeTab === 'categories'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Tag className="w-4 h-4" /> Categorías ({categories.length})
          </button>
          <button
            onClick={() => setActiveTab('subcategories')}
            className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition-all ${
              activeTab === 'subcategories'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" /> Subcategorías ({subcategories.length})
          </button>
        </div>

        {/* Contenido con scroll */}
        <div className="p-5 overflow-y-auto space-y-6">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
              {errorMsg}
            </div>
          )}

          {activeTab === 'categories' ? (
            <>
              {/* Formulario Nueva Categoría */}
              <form onSubmit={handleCreateCategory} className="p-4 bg-slate-800/40 rounded-2xl border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <FolderPlus className="w-4 h-4 text-blue-400" /> Nueva Categoría
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Nombre</label>
                    <input
                      type="text"
                      value={catName}
                      onChange={e => setCatName(e.target.value)}
                      placeholder="Ej: Materiales Eléctricos"
                      required
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Color de Etiqueta</label>
                    <div className="flex items-center gap-1.5 pt-1">
                      {PRESET_COLORS.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCatColor(c)}
                          style={{ backgroundColor: c }}
                          className={`w-6 h-6 rounded-full transition-all ${
                            catColor === c ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Descripción (Opcional)</label>
                  <input
                    type="text"
                    value={catDesc}
                    onChange={e => setCatDesc(e.target.value)}
                    placeholder="Breve descripción o notas..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting || !catName.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-600/20 disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Añadir Categoría
                  </button>
                </div>
              </form>

              {/* Lista de Categorías */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Categorías Creadas ({categories.length})
                </span>
                {categories.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-500">No hay categorías creadas aún.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {categories.map(cat => {
                      const countSub = subcategories.filter(s => s.category_id === cat.id).length;
                      return (
                        <div
                          key={cat.id}
                          className="p-3 bg-slate-800/60 rounded-xl border border-slate-800 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: cat.color || '#3B82F6' }}
                            />
                            <div>
                              <p className="text-xs font-bold text-white">{cat.name}</p>
                              <span className="text-[10px] text-slate-400">
                                {countSub} subcategoría{countSub === 1 ? '' : 's'}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Formulario Nueva Subcategoría */}
              <form onSubmit={handleCreateSubcategory} className="p-4 bg-slate-800/40 rounded-2xl border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-blue-400" /> Nueva Subcategoría
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Categoría Padre</label>
                    <select
                      value={selectedCatId}
                      onChange={e => setSelectedCatId(e.target.value)}
                      required
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="" disabled>Selecciona categoría...</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Nombre de Subcategoría</label>
                    <input
                      type="text"
                      value={subName}
                      onChange={e => setSubName(e.target.value)}
                      placeholder="Ej: Transformadores, Interruptores..."
                      required
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting || !selectedCatId || !subName.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-600/20 disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Añadir Subcategoría
                  </button>
                </div>
              </form>

              {/* Lista de Subcategorías */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Subcategorías Registradas ({subcategories.length})
                </span>
                {subcategories.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-500">No hay subcategorías creadas aún.</div>
                ) : (
                  <div className="space-y-2">
                    {subcategories.map(sub => {
                      const parentCat = categories.find(c => c.id === sub.category_id);
                      return (
                        <div
                          key={sub.id}
                          className="p-3 bg-slate-800/60 rounded-xl border border-slate-800 flex items-center justify-between"
                        >
                          <div>
                            <p className="text-xs font-bold text-white">{sub.name}</p>
                            <span className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                              <span
                                className="w-2 h-2 rounded-full inline-block"
                                style={{ backgroundColor: parentCat?.color || '#94A3B8' }}
                              />
                              Pertenece a: <strong>{parentCat?.name || 'General'}</strong>
                            </span>
                          </div>
                          <button
                            onClick={() => handleDeleteSubcategory(sub.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
