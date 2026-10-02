import ExcelJS from 'exceljs';

export const generateInventoryReportExcel = async ({
  inventoryName,
  currency = 'USD',
  products = [],
  filters = {},
  generatedBy = 'Sistema'
}) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = generatedBy;
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Inventario', {
    pageSetup: { paperSize: 9, orientation: 'landscape' },
    views: [{ state: 'frozen', ySplit: 5 }]
  });

  // 1. Título y Metadatos
  worksheet.mergeCells('A1:H1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = `REPORTE DE INVENTARIO - ${inventoryName ? inventoryName.toUpperCase() : 'PRINCIPAL'}`;
  titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' }
  };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(1).height = 32;

  worksheet.mergeCells('A2:H2');
  const subCell = worksheet.getCell('A2');
  subCell.value = `Fecha: ${new Date().toLocaleString()}  |  Generado por: ${generatedBy}  |  Moneda: ${currency}`;
  subCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF64748B' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };

  worksheet.getRow(3).height = 10; // Espaciador

  // 2. Cabeceras de Columnas
  const headers = [
    { header: 'CÓDIGO (SKU)', key: 'code', width: 18 },
    { header: 'PRODUCTO', key: 'name', width: 32 },
    { header: 'CATEGORÍA', key: 'category', width: 20 },
    { header: 'SUBCATEGORÍA', key: 'subcategory', width: 20 },
    { header: 'UBICACIÓN', key: 'location', width: 22 },
    { header: 'PRECIO', key: 'price', width: 15 },
    { header: 'STOCK', key: 'stock', width: 12 },
    { header: 'VALOR TOTAL', key: 'total_value', width: 18 },
    { header: 'ESTADO', key: 'status', width: 14 }
  ];

  const headerRow = worksheet.getRow(4);
  headerRow.height = 24;

  headers.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.header;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' }
    };
    cell.alignment = { vertical: 'middle', horizontal: idx >= 5 && idx <= 7 ? 'right' : 'left' };
    worksheet.getColumn(idx + 1).width = col.width;
  });

  // 3. Filas de Datos
  let currentRowIndex = 5;
  products.forEach((prod, index) => {
    const row = worksheet.getRow(currentRowIndex);
    row.height = 20;

    const price = Number(prod.price) || 0;
    const stock = Number(prod.stock) || 0;
    const totalVal = price * stock;

    row.getCell(1).value = prod.code || '-';
    row.getCell(2).value = prod.name || '-';
    row.getCell(3).value = prod.categories?.name || 'General';
    row.getCell(4).value = prod.subcategories?.name || '-';
    row.getCell(5).value = prod.locations?.name || '-';
    
    // Precio
    const priceCell = row.getCell(6);
    priceCell.value = price;
    priceCell.numFmt = '#,##0.00';
    priceCell.alignment = { horizontal: 'right' };

    // Stock
    const stockCell = row.getCell(7);
    stockCell.value = stock;
    stockCell.numFmt = '#,##0';
    stockCell.alignment = { horizontal: 'right' };
    if (stock <= (Number(prod.min_stock) || 5)) {
      stockCell.font = { color: { argb: 'FFDC2626' }, bold: true };
    }

    // Valor Total
    const valCell = row.getCell(8);
    valCell.value = totalVal;
    valCell.numFmt = '#,##0.00';
    valCell.alignment = { horizontal: 'right' };

    // Estado
    const statusCell = row.getCell(9);
    statusCell.value = prod.status || 'ACTIVE';
    statusCell.alignment = { horizontal: 'center' };

    // Alternar color de fila
    if (index % 2 === 0) {
      for (let c = 1; c <= 9; c++) {
        row.getCell(c).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' }
        };
      }
    }

    currentRowIndex++;
  });

  // 4. Fila de Totales
  const totalRow = worksheet.getRow(currentRowIndex);
  totalRow.height = 24;
  totalRow.getCell(1).value = 'TOTALES';
  totalRow.getCell(1).font = { bold: true };
  
  // Total Unidades
  const totalStockCell = totalRow.getCell(7);
  totalStockCell.value = { formula: `SUM(G5:G${currentRowIndex - 1})` };
  totalStockCell.font = { bold: true };
  totalStockCell.numFmt = '#,##0';
  totalStockCell.alignment = { horizontal: 'right' };

  // Total Valorización
  const totalValSumCell = totalRow.getCell(8);
  totalValSumCell.value = { formula: `SUM(H5:H${currentRowIndex - 1})` };
  totalValSumCell.font = { bold: true };
  totalValSumCell.numFmt = '#,##0.00';
  totalValSumCell.alignment = { horizontal: 'right' };

  for (let c = 1; c <= 9; c++) {
    const cell = totalRow.getCell(c);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' }
    };
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'double' }
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};
