import express from 'express';
import QRCode from 'qrcode';
import { requireAuth, verifyLocationAccess } from '../middlewares/auth.js';
import { generateLocationLabelPDF } from '../services/labelService.js';

const router = express.Router();

/**
 * GET /api/labels/location/:id/pdf
 * Genera etiqueta de ubicación en PDF con dimensiones exactas de tarjeta de crédito (85.6 mm x 53.9 mm)
 * Protegido contra BOLA / IDOR mediante verifyLocationAccess
 */
router.get('/location/:id/pdf', requireAuth, verifyLocationAccess, async (req, res, next) => {
  try {
    const location = req.location;

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
    next(error);
  }
});

/**
 * GET /api/labels/location/:id/qr
 * Genera el código QR de la ubicación como imagen PNG directa
 * Protegido contra BOLA / IDOR mediante verifyLocationAccess
 */
router.get('/location/:id/qr', requireAuth, verifyLocationAccess, async (req, res, next) => {
  try {
    const location = req.location;

    res.setHeader('Content-Type', 'image/png');
    QRCode.toFileStream(res, location.code, {
      errorCorrectionLevel: 'H',
      type: 'png',
      margin: 1,
      width: 400
    });
  } catch (error) {
    next(error);
  }
});

export default router;
