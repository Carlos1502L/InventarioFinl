import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { requireAuth, verifyTenantAccess } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { reportQuerySchema } from '../schemas/reportSchemas.js';
import { generateInventoryReportPDF } from '../services/pdfService.js';
import { generateInventoryReportExcel } from '../services/excelService.js';

const router = express.Router();

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
 * Protegido contra BOLA y validado con Zod
 */
router.get(
  '/pdf',
  requireAuth,
  validate(reportQuerySchema, 'query'),
  verifyTenantAccess({ source: 'query', key: 'inventory_id', requiredRole: 'member' }),
  async (req, res, next) => {
    try {
      const { inventory_id, category_id, location_id, status } = req.query;

      const { data: inventory } = await supabaseAdmin
        .from('inventories')
        .select('name, currency')
        .eq('id', inventory_id)
        .single();

      const products = await fetchFilteredProducts(inventory_id, { category_id, location_id, status });

      const pdfBuffer = await generateInventoryReportPDF({
        inventoryName: inventory?.name || req.inventory?.name || 'Inventario',
        currency: inventory?.currency || 'USD',
        products,
        filters: req.query,
        generatedBy: req.user.email
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="reporte-inventario-${Date.now()}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/reports/excel
 * Descarga reporte de inventario en formato Excel (.xlsx)
 * Protegido contra BOLA y validado con Zod
 */
router.get(
  '/excel',
  requireAuth,
  validate(reportQuerySchema, 'query'),
  verifyTenantAccess({ source: 'query', key: 'inventory_id', requiredRole: 'member' }),
  async (req, res, next) => {
    try {
      const { inventory_id, category_id, location_id, status } = req.query;

      const { data: inventory } = await supabaseAdmin
        .from('inventories')
        .select('name, currency')
        .eq('id', inventory_id)
        .single();

      const products = await fetchFilteredProducts(inventory_id, { category_id, location_id, status });

      const excelBuffer = await generateInventoryReportExcel({
        inventoryName: inventory?.name || req.inventory?.name || 'Inventario',
        currency: inventory?.currency || 'USD',
        products,
        filters: req.query,
        generatedBy: req.user.email
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="reporte-inventario-${Date.now()}.xlsx"`);
      res.send(excelBuffer);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/reports/csv
 * Descarga reporte de inventario en formato CSV
 * Protegido contra BOLA y validado con Zod
 */
router.get(
  '/csv',
  requireAuth,
  validate(reportQuerySchema, 'query'),
  verifyTenantAccess({ source: 'query', key: 'inventory_id', requiredRole: 'member' }),
  async (req, res, next) => {
    try {
      const { inventory_id, category_id, location_id, status } = req.query;

      const products = await fetchFilteredProducts(inventory_id, { category_id, location_id, status });

      const header = ['Codigo', 'Producto', 'Categoria', 'Subcategoria', 'Ubicacion', 'Precio', 'Stock', 'ValorTotal', 'Estado'];
      const rows = products.map((p) => [
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

      const csvContent = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="reporte-inventario-${Date.now()}.csv"`);
      res.send('\uFEFF' + csvContent); // Byte Order Mark para compatibilidad con Excel español
    } catch (error) {
      next(error);
    }
  }
);

export default router;
