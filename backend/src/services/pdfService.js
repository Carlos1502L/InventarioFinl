import PDFDocument from 'pdfkit';

export const generateInventoryReportPDF = async ({
  inventoryName,
  currency = 'USD',
  products = [],
  filters = {},
  generatedBy = 'Sistema'
}) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 36, // ~0.5 inch margins
        bufferPages: true
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        // Añadir números de página dinámicos al final
        const totalPages = doc.bufferedPageRange().count;
        for (let i = 0; i < totalPages; i++) {
          doc.switchToPage(i);
          doc.fontSize(8)
             .font('Helvetica')
             .fillColor('#94A3B8')
             .text(
               `Página ${i + 1} de ${totalPages} • Generado por ${generatedBy} • Documento confidencial`,
               36,
               doc.page.height - 24,
               { align: 'center', width: doc.page.width - 72 }
             );
        }
        resolve(Buffer.concat(buffers));
      });

      const pageWidth = doc.page.width - 72; // Ancho útil

      // --- 1. ENCABEZADO ---
      doc.rect(36, 36, pageWidth, 54)
         .fillColor('#0F172A')
         .fill();

      doc.fontSize(18)
         .font('Helvetica-Bold')
         .fillColor('#FFFFFF')
         .text('REPORTE GENERAL DE INVENTARIO', 48, 48);

      doc.fontSize(9)
         .font('Helvetica')
         .fillColor('#94A3B8')
         .text(`Inventario: ${inventoryName || 'Principal'}  |  Fecha de emisión: ${new Date().toLocaleString()}`, 48, 70);

      let yPos = 104;

      // --- 2. TARJETAS DE RESUMEN (KPIS) ---
      const totalProducts = products.length;
      const totalUnits = products.reduce((acc, p) => acc + (Number(p.stock) || 0), 0);
      const totalValue = products.reduce((acc, p) => acc + ((Number(p.stock) || 0) * (Number(p.price) || 0)), 0);
      const lowStockCount = products.filter(p => (Number(p.stock) || 0) <= (Number(p.min_stock) || 5)).length;

      const cardWidth = (pageWidth - 24) / 4;
      const cardHeight = 44;

      const kpis = [
        { label: 'PRODUCTOS ÚNICOS', value: `${totalProducts}`, color: '#2563EB' },
        { label: 'UNIDADES EN STOCK', value: `${totalUnits}`, color: '#059669' },
        { label: 'VALORIZACIÓN TOTAL', value: `${currency} ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: '#7C3AED' },
        { label: 'EN ALERTA DE STOCK', value: `${lowStockCount}`, color: '#DC2626' },
      ];

      kpis.forEach((kpi, idx) => {
        const x = 36 + idx * (cardWidth + 8);
        doc.roundedRect(x, yPos, cardWidth, cardHeight, 4)
           .fillColor('#F8FAFC')
           .strokeColor('#E2E8F0')
           .lineWidth(1)
           .fillAndStroke();

        doc.fontSize(6.5)
           .font('Helvetica-Bold')
           .fillColor('#64748B')
           .text(kpi.label, x + 8, yPos + 8, { width: cardWidth - 16 });

        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(kpi.color)
           .text(kpi.value, x + 8, yPos + 22, { width: cardWidth - 16, ellipsis: true });
      });

      yPos += 56;

      // Filtros aplicados si existen
      const filterTexts = [];
      if (filters.categoryName) filterTexts.push(`Categoría: ${filters.categoryName}`);
      if (filters.locationName) filterTexts.push(`Ubicación: ${filters.locationName}`);
      if (filters.status) filterTexts.push(`Estado: ${filters.status}`);

      if (filterTexts.length > 0) {
        doc.fontSize(8)
           .font('Helvetica-Oblique')
           .fillColor('#475569')
           .text(`Filtros aplicados: ${filterTexts.join('  |  ')}`, 36, yPos);
        yPos += 16;
      }

      // --- 3. TABLA DE PRODUCTOS ---
      // Anchos de columnas (total ~ pageWidth = 523)
      const cols = [
        { title: 'CÓDIGO', width: 70, align: 'left' },
        { title: 'PRODUCTO', width: 140, align: 'left' },
        { title: 'CATEGORÍA', width: 85, align: 'left' },
        { title: 'UBICACIÓN', width: 85, align: 'left' },
        { title: 'PRECIO', width: 50, align: 'right' },
        { title: 'STOCK', width: 40, align: 'right' },
        { title: 'TOTAL', width: 53, align: 'right' }
      ];

      // Cabecera de la tabla
      const drawTableHeader = (y) => {
        doc.rect(36, y, pageWidth, 20)
           .fillColor('#1E293B')
           .fill();

        let curX = 36;
        cols.forEach(col => {
          doc.fontSize(7.5)
             .font('Helvetica-Bold')
             .fillColor('#FFFFFF')
             .text(col.title, curX + 4, y + 6, { width: col.width - 8, align: col.align });
          curX += col.width;
        });
      };

      drawTableHeader(yPos);
      yPos += 20;

      // Filas de productos
      products.forEach((prod, index) => {
        // Salto de página si nos acercamos al pie
        if (yPos > doc.page.height - 60) {
          doc.addPage();
          yPos = 36;
          drawTableHeader(yPos);
          yPos += 20;
        }

        const isEven = index % 2 === 0;
        if (isEven) {
          doc.rect(36, yPos, pageWidth, 18)
             .fillColor('#F8FAFC')
             .fill();
        }

        let curX = 36;

        // Código
        doc.fontSize(7)
           .font('Courier-Bold')
           .fillColor('#0F172A')
           .text(prod.code || '-', curX + 4, yPos + 5, { width: cols[0].width - 8, ellipsis: true });
        curX += cols[0].width;

        // Nombre
        doc.fontSize(7.5)
           .font('Helvetica-Bold')
           .fillColor('#1E293B')
           .text(prod.name || '-', curX + 4, yPos + 5, { width: cols[1].width - 8, ellipsis: true });
        curX += cols[1].width;

        // Categoría
        doc.fontSize(7)
           .font('Helvetica')
           .fillColor('#475569')
           .text(prod.categories?.name || 'General', curX + 4, yPos + 5, { width: cols[2].width - 8, ellipsis: true });
        curX += cols[2].width;

        // Ubicación
        doc.fontSize(7)
           .font('Helvetica')
           .fillColor('#475569')
           .text(prod.locations?.name || '-', curX + 4, yPos + 5, { width: cols[3].width - 8, ellipsis: true });
        curX += cols[3].width;

        // Precio
        doc.fontSize(7)
           .font('Helvetica')
           .fillColor('#0F172A')
           .text(`${Number(prod.price || 0).toFixed(2)}`, curX + 4, yPos + 5, { width: cols[4].width - 8, align: 'right' });
        curX += cols[4].width;

        // Stock (resaltar si está bajo)
        const isLow = Number(prod.stock || 0) <= Number(prod.min_stock || 5);
        doc.fontSize(7.5)
           .font('Helvetica-Bold')
           .fillColor(isLow ? '#DC2626' : '#0F172A')
           .text(`${prod.stock || 0}`, curX + 4, yPos + 5, { width: cols[5].width - 8, align: 'right' });
        curX += cols[5].width;

        // Total
        const lineTotal = (Number(prod.price || 0) * Number(prod.stock || 0)).toFixed(2);
        doc.fontSize(7)
           .font('Helvetica-Bold')
           .fillColor('#0F172A')
           .text(`${lineTotal}`, curX + 4, yPos + 5, { width: cols[6].width - 8, align: 'right' });

        yPos += 18;
      });

      // Fila final de totales
      if (yPos > doc.page.height - 40) {
        doc.addPage();
        yPos = 36;
      }

      doc.rect(36, yPos, pageWidth, 20)
         .fillColor('#E2E8F0')
         .fill();

      doc.fontSize(8)
         .font('Helvetica-Bold')
         .fillColor('#0F172A')
         .text('TOTALES:', 36 + 4, yPos + 6);

      const totalValueFormatted = `${currency} ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      doc.text(
        `${totalUnits} uds  |  ${totalValueFormatted}`,
        36,
        yPos + 6,
        { width: pageWidth - 8, align: 'right' }
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};
