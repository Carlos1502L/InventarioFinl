import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { requireAuth } from '../middlewares/auth.js';
import { generateInventoryReportPDF } from '../services/pdfService.js';
import { generateInventoryReportExcel } from '../services/excelService.js';

const router = express.Router();

// Helper para validar membresía en el inventario
const verifyInventoryAccess = async (userId, inventoryId) => {
  const { data: isMember, error } = await supabaseAdmin.rpc('is_inventory_member', {
    inv_id: inventoryId
  });

  // Si la función RPC no está disponible o falla, consultar manualmente
  if (error || isMember === null) {
    const { data: inv } = await supabaseAdmin
      .from('inventories')
      .select('id, owner_id')
      .eq('id', inventoryId)
      .single();

    if (inv && inv.owner_id === userId) return true;

    const { data: member } = await supabaseAdmin
      .from('inventory_users')
      .select('id')
      .eq('inventory_id', inventoryId)
      .eq('user_id', userId)
      .single();

    return !!member;
  }

  return !!isMember;
};

// Helper para obtener productos con filtros
const fetchFilteredProducts = async (inventoryId, queryParams) => {
  let query = supabaseAdmin
    .from('products')
    .select(`
      id,
      name,
      code,
      description,
      price,
      stock,
      min_stock,
      status,
      created_at,
      categories (id, name),
      subcategories (id, name),
      locations (id, name, code)
    `)
    .eq('inventory_id', inventoryId)
    .order('name', { ascending: true });

  if (queryParams.category_id) {
    query = query.eq('category_id', queryParams.category_id);
  }
  if (queryParams.location_id) {
    query = query.eq('location_id', queryParams.location_id);
  }
  if (queryParams.status) {
    query = query.eq('status', queryParams.status);
  } else {
    // Por defecto excluir productos eliminados/archivados a menos que se pidan explícitamente
    query = query.neq('status', 'ARCHIVED');
  }

  const { data: products, error } = await query;
  if (error) throw error;
  return products || [];
};

/**
 * GET /api/reports/pdf
 * Descarga reporte de inventario en formato PDF
 */
router.get('/pdf', requireAuth, async (req, res) => {
  try {
    const { inventory_id, category_id, location_id, status } = req.query;

    if (!inventory_id) {
      return res.status(400).json({ error: 'El parámetro inventory_id es obligatorio.' });
    }

    const hasAccess = await verifyInventoryAccess(req.user.id, inventory_id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'No tienes permisos para acceder a este inventario.' });
    }

    const { data: inventory } = await supabaseAdmin
      .from('inventories')
      .select('name, currency')
      .eq('id', inventory_id)
      .single();

    const products = await fetchFilteredProducts(inventory_id, { category_id, location_id, status });

    const pdfBuffer = await generateInventoryReportPDF({
      inventoryName: inventory?.name || 'Inventario',
      currency: inventory?.currency || 'USD',
      products,
      filters: req.query,
      generatedBy: req.user.email
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-inventario-${Date.now()}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generando reporte PDF:', error);
    res.status(500).json({ error: 'Error al generar el reporte PDF: ' + error.message });
  }
});

/**
 * GET /api/reports/excel
 * Descarga reporte de inventario en formato Excel (.xlsx)
 */
router.get('/excel', requireAuth, async (req, res) => {
  try {
    const { inventory_id, category_id, location_id, status } = req.query;

    if (!inventory_id) {
      return res.status(400).json({ error: 'El parámetro inventory_id es obligatorio.' });
    }

    const hasAccess = await verifyInventoryAccess(req.user.id, inventory_id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'No tienes permisos para acceder a este inventario.' });
    }

    const { data: inventory } = await supabaseAdmin
      .from('inventories')
      .select('name, currency')
      .eq('id', inventory_id)
      .single();

    const products = await fetchFilteredProducts(inventory_id, { category_id, location_id, status });

    const excelBuffer = await generateInventoryReportExcel({
      inventoryName: inventory?.name || 'Inventario',
      currency: inventory?.currency || 'USD',
      products,
      filters: req.query,
      generatedBy: req.user.email
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-inventario-${Date.now()}.xlsx"`);
    res.send(excelBuffer);
  } catch (error) {
    console.error('Error generando reporte Excel:', error);
    res.status(500).json({ error: 'Error al generar el reporte Excel: ' + error.message });
  }
});

/**
 * GET /api/reports/csv
 * Descarga reporte de inventario en formato CSV
 */
router.get('/csv', requireAuth, async (req, res) => {
  try {
    const { inventory_id, category_id, location_id, status } = req.query;

    if (!inventory_id) {
      return res.status(400).json({ error: 'El parámetro inventory_id es obligatorio.' });
    }

    const hasAccess = await verifyInventoryAccess(req.user.id, inventory_id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'No tienes permisos para acceder a este inventario.' });
    }

    const products = await fetchFilteredProducts(inventory_id, { category_id, location_id, status });

    const header = ['Codigo', 'Producto', 'Categoria', 'Subcategoria', 'Ubicacion', 'Precio', 'Stock', 'ValorTotal', 'Estado'];
    const rows = products.map(p => [
      `"${p.code || ''}"`,
      `"${(p.name || '').replace(/"/g, '""')}"`,
      `"${(p.categories?.name || '').replace(/"/g, '""')}"`,
      `"${(p.subcategories?.name || '').replace(/"/g, '""')}"`,
      `"${(p.locations?.name || '').replace(/"/g, '""')}"`,
      Number(p.price || 0).toFixed(2),
      p.stock || 0,
      (Number(p.price || 0) * Number(p.stock || 0)).toFixed(2),
      `"${p.status || 'ACTIVE'}"`
    ]);

    const csvContent = [header.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-inventario-${Date.now()}.csv"`);
    res.send('\uFEFF' + csvContent); // Byte Order Mark para compatibilidad con Excel español
  } catch (error) {
    console.error('Error generando reporte CSV:', error);
    res.status(500).json({ error: 'Error al generar el reporte CSV: ' + error.message });
  }
});

export default router;
