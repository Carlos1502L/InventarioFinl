import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

/**
 * Genera un PDF con las dimensiones exactas de una tarjeta de crédito (85.6 mm x 53.98 mm)
 * 1 mm = 2.834645 pt
 * Ancho: 85.6 * 2.834645 = ~242.65 pt
 * Alto: 53.98 * 2.834645 = ~153.01 pt
 */
export const generateLocationLabelPDF = async ({ locationName, locationCode, inventoryName, description }) => {
  return new Promise(async (resolve, reject) => {
    try {
      const cardWidth = 242.65;
      const cardHeight = 153.01;

      // Crear documento PDFKit con tamaño exacto y sin márgenes por defecto
      const doc = new PDFDocument({
        size: [cardWidth, cardHeight],
        margins: { top: 0, bottom: 0, left: 0, right: 0 }
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Generar código QR en buffer (PNG de alta resolución)
      const qrDataUrl = await QRCode.toBuffer(locationCode, {
        errorCorrectionLevel: 'H',
        type: 'png',
        margin: 1,
        width: 250,
        color: {
          dark: '#0F172A',
          light: '#FFFFFF'
        }
      });

      // Fondo tarjeta (blanco con borde redondeado moderno)
      doc.roundedRect(6, 6, cardWidth - 12, cardHeight - 12, 6)
         .lineWidth(1)
         .strokeColor('#CBD5E1')
         .fillColor('#FFFFFF')
         .fillAndStroke();

      // Franja superior de marca / encabezado
      doc.rect(6, 6, cardWidth - 12, 24)
         .fillColor('#1E293B')
         .fill();

      // Texto de la franja superior (Inventario)
      doc.fontSize(8)
         .font('Helvetica-Bold')
         .fillColor('#FFFFFF')
         .text(
           (inventoryName || 'SISTEMA DE INVENTARIOS').toUpperCase(),
           12,
           13,
           { width: cardWidth - 24, align: 'center', ellipsis: true }
         );

      // Código QR (Lado izquierdo)
      const qrSize = 78;
      const qrX = 14;
      const qrY = 38;
      doc.image(qrDataUrl, qrX, qrY, { width: qrSize, height: qrSize });

      // Marco fino alrededor del QR
      doc.rect(qrX - 2, qrY - 2, qrSize + 4, qrSize + 4)
         .lineWidth(0.5)
         .strokeColor('#E2E8F0')
         .stroke();

      // Detalles de la Ubicación (Lado derecho)
      const textX = 102;
      let currentY = 38;

      // Etiqueta "UBICACIÓN FÍSICA"
      doc.fontSize(6)
         .font('Helvetica-Bold')
         .fillColor('#64748B')
         .text('UBICACIÓN ASIGNADA', textX, currentY, { width: 130 });

      currentY += 9;

      // Nombre de la ubicación (grande, resaltado)
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .fillColor('#0F172A')
         .text(locationName || 'Sin Nombre', textX, currentY, {
           width: 130,
           lineBreak: true,
           ellipsis: true
         });

      currentY += 26;

      // Caja con el Código Único
      doc.roundedRect(textX, currentY, 126, 20, 3)
         .fillColor('#F1F5F9')
         .fill();

      doc.fontSize(9)
         .font('Courier-Bold')
         .fillColor('#1E293B')
         .text(locationCode, textX + 6, currentY + 5, {
           width: 114,
           align: 'center',
           characterSpacing: 0.5
         });

      currentY += 26;

      // Descripción o nota breve
      if (description) {
        doc.fontSize(6.5)
           .font('Helvetica')
           .fillColor('#475569')
           .text(description, textX, currentY, {
             width: 126,
             height: 16,
             ellipsis: true
           });
      }

      // Pie de tarjeta
      doc.fontSize(5.5)
         .font('Helvetica')
         .fillColor('#94A3B8')
         .text('85.6 mm × 53.9 mm • Escanear para ubicar o mover productos', 12, cardHeight - 16, {
           width: cardWidth - 24,
           align: 'center'
         });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};
