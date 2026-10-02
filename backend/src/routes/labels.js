import express from 'express';
import QRCode from 'qrcode';
import { supabaseAdmin } from '../config/supabase.js';
import { requireAuth } from '../middlewares/auth.js';
import { generateLocationLabelPDF } from '../services/labelService.js';

const router = express.Router();

/**
 * GET /api/labels/location/:id/pdf
 * Genera etiqueta de ubicación en PDF con dimensiones exactas de tarjeta de crédito (85.6 mm x 53.9 mm)
 */
router.get('/location/:id/pdf', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Obtener detalles de la ubicación e inventario
    const { data: location, error } = await supabaseAdmin
      .from('locations')
      .select(`
        id,
        name,
        code,
        description,
        inventory_id,
        inventories (
          name
        )
      `)
      .eq('id', id)
      .single();

    if (error || !location) {
      return res.status(404).json({ error: 'Ubicación no encontrada.' });
    }

    const pdfBuffer = await generateLocationLabelPDF({
      locationName: location.name,
      locationCode: location.code,
      inventoryName: location.inventories?.name || 'ALMACÉN',
      description: location.description || ''
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="etiqueta-${location.code}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generando etiqueta PDF:', error);
    res.status(500).json({ error: 'Error al generar la etiqueta PDF: ' + error.message });
  }
});

/**
 * GET /api/labels/location/:id/qr
 * Genera el código QR de la ubicación como imagen PNG directa
 */
router.get('/location/:id/qr', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: location, error } = await supabaseAdmin
      .from('locations')
      .select('code, name')
      .eq('id', id)
      .single();

    if (error || !location) {
      return res.status(404).json({ error: 'Ubicación no encontrada.' });
    }

    const qrStream = QRCode.toFileStream(res, location.code, {
      errorCorrectionLevel: 'H',
      type: 'png',
      margin: 1,
      width: 400
    });

    res.setHeader('Content-Type', 'image/png');
    return qrStream;
  } catch (error) {
    console.error('Error generando QR de ubicación:', error);
    res.status(500).json({ error: 'Error al generar el código QR: ' + error.message });
  }
});

export default router;
