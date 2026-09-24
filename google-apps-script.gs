const SHEET_NAME = 'Llamadas';
const ADVISOR_SHEET_NAME = 'Asesores';

function formatDurationValue(value) {
  if (!value) return '';
  const rawValue = value instanceof Date
    ? Utilities.formatDate(value, Session.getScriptTimeZone(), 'HH:mm:ss')
    : String(value).trim();
  const match = rawValue.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return '';
  const [, hours, minutes, seconds] = match;
  if (seconds !== undefined && Number(hours) === 0) return `${minutes}:${seconds}`;
  return `${hours}:${minutes}`;
}

function normalizeDateOnly(value) {
  if (!value) return '';
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  }
  const raw = String(value).trim();
  if (!raw) return '';
  const englishDateMatch = raw.match(/^[A-Za-z]{3}\s+([A-Za-z]{3})\s+(\d{1,2})\s+\d{2}:\d{2}:\d{2}\s+\d{4}/);
  if (englishDateMatch) {
    const monthNames = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
    const year = raw.match(/\b(\d{4})\b/);
    const month = monthNames[englishDateMatch[1]];
    if (month && year) return `${englishDateMatch[2].padStart(2, '0')}/${month}/${year[1]}`;
  }
  const isoMatch = raw.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[3].padStart(2, '0')}/${isoMatch[2].padStart(2, '0')}/${isoMatch[1]}`;
  }
  const dayFirstMatch = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (dayFirstMatch) {
    return `${dayFirstMatch[1].padStart(2, '0')}/${dayFirstMatch[2].padStart(2, '0')}/${dayFirstMatch[3]}`;
  }
  const datePart = raw.split(/[ T]/)[0];
  return datePart;
}

function normalizeTimeOnly(value) {
  if (!value) return '';
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'HH:mm');
  }
  const raw = String(value).trim();
  if (!raw) return '';
  const match = raw.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    return `${String(match[1]).padStart(2, '0')}:${String(match[2]).padStart(2, '0')}`;
  }
  const dateTimeMatch = raw.match(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/);
  if (dateTimeMatch) {
    return `${String(dateTimeMatch[1]).padStart(2, '0')}:${String(dateTimeMatch[2]).padStart(2, '0')}`;
  }
  return raw.slice(0, 5);
}

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

    const columnCount = Math.max(sheet.getLastColumn(), 12);
    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, columnCount).getValues();
    values.forEach((row) => {
      const date = row[0] instanceof Date ? row[0] : new Date(row[0]);
      const durationIndex = headerMap['duración'] !== undefined ? headerMap['duración'] : headerMap['duracion'];
      const justificationIndex = headerMap['justificatorio'] !== undefined ? headerMap['justificatorio'] : headerMap['justificativos'];
      const recoveryIndex = headerMap['resultado recuperación'] !== undefined
        ? headerMap['resultado recuperación']
        : headerMap['resultado_recuperacion'] !== undefined
          ? headerMap['resultado_recuperacion']
          : headerMap['resultadorecuperacion'];
      const duracion = durationIndex !== undefined ? formatDurationValue(row[durationIndex]) : '';
      const justificatorio = String((justificationIndex !== undefined ? row[justificationIndex] : row[10] || row[9]) || '');
      const resultadoRecuperacion = recoveryIndex !== undefined ? String(row[recoveryIndex] || '') : String(row[11] || '');
      const fecha = normalizeDateOnly(row[0]);
      const hora = normalizeTimeOnly(row[8] || (row[0] instanceof Date ? row[0] : row[0]));
      rows.push({
        fila: values.indexOf(row) + 2,
        fecha: fecha || Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd/MM/yyyy'),
        hora: hora || Utilities.formatDate(date, Session.getScriptTimeZone(), 'HH:mm'),
        duracion: duracion,
        cliente: String(row[1] || ''),
        telefono: String(row[2] || ''),
        asesor: String(row[3] || ''),
        tienda: String(row[4] || ''),
        motivo: String(row[5] || ''),
        estado: String(row[6] || ''),
        estadoSecundario: String(row[7] || ''),
        justificatorio: justificatorio,
        resultadoRecuperacion: resultadoRecuperacion
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
    sheet.appendRow(['Fecha', 'Cliente', 'Telefono', 'Asesor', 'Tienda', 'Motivo', 'Estado', 'Estado adicional', 'Hora', 'Duración', 'Justificatorio', 'Resultado recuperación']);
  } else if (sheet.getLastColumn() < 12) {
    const headerRow = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 12)).getValues()[0];
    if (!headerRow[9] || String(headerRow[9]).toLowerCase() !== 'duración') {
      sheet.getRange(1, 10, 1, 3).setValues([['Duración', 'Justificatorio', 'Resultado recuperación']]);
    } else if (!headerRow[11] || String(headerRow[11]).toLowerCase() !== 'resultado recuperación') {
      sheet.getRange(1, 12, 1, 1).setValue('Resultado recuperación');
    }
  }

  const data = event.parameter;
  const callDate = data.fecha ? data.fecha : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const nextRow = sheet.getLastRow() + 1;
  sheet.getRange(nextRow, 10).setNumberFormat('@');
  sheet.getRange(nextRow, 1, 1, 12).setValues([[
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
    data.justificatorio || '',
    data.resultadoRecuperacion || ''
  ]]);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
