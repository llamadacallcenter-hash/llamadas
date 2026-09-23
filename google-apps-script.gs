const SHEET_NAME = 'Llamadas';
const ADVISOR_SHEET_NAME = 'Asesores';

function doGet(event) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  if (event && event.parameter && event.parameter.tipo === 'asesores') {
    const advisorSheet = spreadsheet.getSheetByName(ADVISOR_SHEET_NAME);
    const advisors = [];
    if (advisorSheet && advisorSheet.getLastRow() > 1) {
      advisorSheet.getRange(2, 1, advisorSheet.getLastRow() - 1, 2).getValues().forEach((row) => {
        advisors.push({ fecha: String(row[0] || ''), nombre: String(row[1] || '') });
      });
    }
    return ContentService.createTextOutput(JSON.stringify(advisors)).setMimeType(ContentService.MimeType.JSON);
  }

  const sheet = spreadsheet.getSheetByName(SHEET_NAME);
  const rows = [];

  if (sheet && sheet.getLastRow() > 1) {
    const headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] || [];
    const headerMap = {};
    headerRow.forEach((header, index) => {
      const key = String(header || '').trim().toLowerCase();
      if (key) headerMap[key] = index;
    });

    const columnCount = Math.max(sheet.getLastColumn(), 11);
    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, columnCount).getValues();
    values.forEach((row) => {
      const date = row[0] instanceof Date ? row[0] : new Date(row[0]);
      const durationIndex = headerMap['duración'] !== undefined ? headerMap['duración'] : headerMap['duracion'];
      const justificationIndex = headerMap['justificatorio'] !== undefined ? headerMap['justificatorio'] : headerMap['justificativos'];
      const duracion = durationIndex !== undefined ? String(row[durationIndex] || '') : '';
      const justificatorio = String((justificationIndex !== undefined ? row[justificationIndex] : row[10] || row[9]) || '');
      rows.push({
        fila: values.indexOf(row) + 2,
        fecha: Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm'),
        hora: row[8] instanceof Date
          ? Utilities.formatDate(row[8], Session.getScriptTimeZone(), 'HH:mm')
          : String(row[8] || Utilities.formatDate(date, Session.getScriptTimeZone(), 'HH:mm')).slice(0, 5),
        duracion: duracion,
        cliente: String(row[1] || ''),
        telefono: String(row[2] || ''),
        asesor: String(row[3] || ''),
        tienda: String(row[4] || ''),
        motivo: String(row[5] || ''),
        estado: String(row[6] || ''),
        estadoSecundario: String(row[7] || ''),
        justificatorio: justificatorio
      });
    });
  }

  return ContentService
    .createTextOutput(JSON.stringify(rows))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(event) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  if (event.parameter.tipo === 'actualizar-asesor') {
    const sheet = spreadsheet.getSheetByName(SHEET_NAME);
    const rowNumber = Number(event.parameter.fila);
    if (sheet && rowNumber > 1 && event.parameter.asesor) {
      sheet.getRange(rowNumber, 4).setValue(event.parameter.asesor);
    }
    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  }

  if (event.parameter.tipo === 'actualizar-tienda') {
    const sheet = spreadsheet.getSheetByName(SHEET_NAME);
    const rowNumber = Number(event.parameter.fila);
    if (sheet && rowNumber > 1 && event.parameter.tienda) {
      sheet.getRange(rowNumber, 5).setValue(event.parameter.tienda);
    }
    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  }

  if (event.parameter.tipo === 'asesor') {
    const advisorSheet = spreadsheet.getSheetByName(ADVISOR_SHEET_NAME) || spreadsheet.insertSheet(ADVISOR_SHEET_NAME);
    if (advisorSheet.getLastRow() === 0) {
      advisorSheet.appendRow(['Fecha', 'Nombre']);
    }
    advisorSheet.appendRow([new Date(), event.parameter.nombre || '']);
    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  }

  const sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Fecha', 'Cliente', 'Telefono', 'Asesor', 'Tienda', 'Motivo', 'Estado', 'Estado adicional', 'Hora', 'Duración', 'Justificatorio']);
  } else if (sheet.getLastColumn() < 11) {
    const headerRow = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 11)).getValues()[0];
    if (!headerRow[9] || String(headerRow[9]).toLowerCase() !== 'duración') {
      sheet.getRange(1, 10, 1, 2).setValues([['Duración', 'Justificatorio']]);
    }
  }

  const data = event.parameter;
  const callDate = data.fecha ? new Date(`${data.fecha}T${data.hora || '12:00'}:00`) : new Date();
  sheet.appendRow([
    callDate,
    data.cliente || '',
    data.telefono || '',
    data.asesor || '',
    data.tienda || '',
    data.motivo || '',
    data.estado || '',
    data.estadoSecundario || '',
    data.hora || '',
    data.duracion || '',
    data.justificatorio || ''
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
