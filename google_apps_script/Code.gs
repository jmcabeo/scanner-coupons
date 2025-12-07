/**
 * Omnia 3.0 - Google Apps Script API (Simplificado)
 * 
 * Solo almacena REGLAS DE VALIDACIÓN - las campañas vienen de Coupontools
 * 
 * HOJAS REQUERIDAS EN TU SHEET:
 * 1. validation_rules - Reglas por campaña
 * 2. stores - PINs de tiendas
 * 
 * ENDPOINTS:
 * GET  ?action=getAllRules        → Todas las reglas
 * GET  ?action=getRule&id=X       → Regla de una campaña
 * GET  ?action=validatePin&pin=X  → Validar PIN
 * POST action=saveRule            → Guardar/actualizar regla
 * POST action=deleteRule          → Eliminar regla
 * POST action=checkCoupon         → Verificar si cupón puede canjearse
 */

// ID del Spreadsheet (CAMBIA ESTO)
const SPREADSHEET_ID = 'TU_SPREADSHEET_ID_AQUI';

const SHEETS = {
  RULES: 'validation_rules',
  STORES: 'stores'
};

// ========================================
// HANDLERS
// ========================================

function doGet(e) {
  try {
    const action = e.parameter.action;
    let result;
    
    switch (action) {
      case 'getAllRules':
        result = getAllRules();
        break;
      case 'getRule':
        result = getRule(e.parameter.id);
        break;
      case 'validatePin':
        result = validatePin(e.parameter.pin);
        break;
      default:
        result = { error: 'Acción no válida' };
    }
    
    return jsonResponse(result);
  } catch (error) {
    return jsonResponse({ error: error.message });
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    let result;
    
    switch (data.action) {
      case 'saveRule':
        result = saveRule(data.rule);
        break;
      case 'deleteRule':
        result = deleteRule(data.ct_campaign_id);
        break;
      case 'checkCoupon':
        result = checkCouponValidation(data);
        break;
      default:
        result = { error: 'Acción no válida' };
    }
    
    return jsonResponse(result);
  } catch (error) {
    return jsonResponse({ error: error.message });
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ========================================
// RULES MANAGEMENT
// ========================================

function getAllRules() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.RULES);
  if (!sheet) return { success: true, rules: [] };
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { success: true, rules: [] };
  
  const headers = data[0];
  const rules = [];
  
  for (let i = 1; i < data.length; i++) {
    const rule = {};
    headers.forEach((header, idx) => {
      rule[header] = data[i][idx];
    });
    if (rule.active === true || rule.active === 'TRUE' || rule.active === undefined) {
      rules.push(rule);
    }
  }
  
  return { success: true, rules };
}

function getRule(ctCampaignId) {
  const allRules = getAllRules();
  const rule = allRules.rules.find(r => r.ct_campaign_id === ctCampaignId);
  
  if (rule) {
    return { success: true, rule };
  }
  return { success: false, error: 'No hay reglas para esta campaña' };
}

function saveRule(rule) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.RULES);
  
  // Create sheet if doesn't exist
  if (!sheet) {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const newSheet = ss.insertSheet(SHEETS.RULES);
    newSheet.appendRow(['ct_campaign_id', 'days_allowed', 'hours_start', 'hours_end', 'min_spend', 'active']);
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  // Find existing row
  let existingRow = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === rule.ct_campaign_id) {
      existingRow = i + 1; // Sheet rows are 1-indexed
      break;
    }
  }
  
  const rowData = [
    rule.ct_campaign_id,
    rule.days_allowed,
    rule.hours_start,
    rule.hours_end,
    rule.min_spend || 0,
    true
  ];
  
  if (existingRow > 0) {
    // Update existing
    sheet.getRange(existingRow, 1, 1, rowData.length).setValues([rowData]);
  } else {
    // Add new
    sheet.appendRow(rowData);
  }
  
  return { success: true, message: 'Regla guardada' };
}

function deleteRule(ctCampaignId) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.RULES);
  if (!sheet) return { success: true };
  
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === ctCampaignId) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Regla eliminada' };
    }
  }
  
  return { success: true };
}

// ========================================
// PIN VALIDATION
// ========================================

function validatePin(pin) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.STORES);
  if (!sheet) return { success: false, error: 'Hoja stores no encontrada' };
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  for (let i = 1; i < data.length; i++) {
    const store = {};
    headers.forEach((header, idx) => {
      store[header] = data[i][idx];
    });
    
    if (String(store.pin) === String(pin) && 
        (store.active === true || store.active === 'TRUE')) {
      return { 
        success: true, 
        store: {
          id: store.id,
          name: store.name,
          timezone: store.timezone || 'Europe/Madrid'
        }
      };
    }
  }
  
  return { success: false, error: 'PIN inválido' };
}

// ========================================
// COUPON VALIDATION LOGIC
// ========================================

function checkCouponValidation(data) {
  const { 
    ct_campaign_id,
    claimed_at,
    money_spent,
    store_pin,
    current_time
  } = data;
  
  // 1. Validar PIN
  const pinResult = validatePin(store_pin);
  if (!pinResult.success) {
    return { valid: false, error: 'PIN_INVALID', message: 'PIN de tienda incorrecto' };
  }
  
  // 2. Obtener reglas de la campaña
  const ruleResult = getRule(ct_campaign_id);
  if (!ruleResult.success) {
    return { valid: false, error: 'NO_RULES', message: 'No hay reglas configuradas para esta campaña' };
  }
  
  const rule = ruleResult.rule;
  
  // 3. Parsear fechas
  const claimedDate = new Date(claimed_at);
  const now = current_time ? new Date(current_time) : new Date();
  
  // Día válido desde = día siguiente al reclamo
  const validFrom = new Date(claimedDate);
  validFrom.setDate(validFrom.getDate() + 1);
  validFrom.setHours(0, 0, 0, 0);
  
  // Expira = 8 días después de ser válido
  const expiresAt = new Date(validFrom);
  expiresAt.setDate(expiresAt.getDate() + 8);
  expiresAt.setHours(23, 59, 59, 999);
  
  // 4. Verificar si ya es válido
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  
  if (todayStart < validFrom) {
    return { 
      valid: false, 
      error: 'NOT_YET_VALID', 
      message: 'Este cupón será válido a partir de mañana',
      valid_from: validFrom.toISOString()
    };
  }
  
  // 5. Verificar expiración
  if (now > expiresAt) {
    return { 
      valid: false, 
      error: 'EXPIRED', 
      message: 'Este cupón ha expirado',
      expired_at: expiresAt.toISOString()
    };
  }
  
  // 6. Verificar día permitido
  const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const currentDay = dayNames[now.getDay()];
  const allowedDays = String(rule.days_allowed).toLowerCase().split(',').map(d => d.trim());
  
  if (!allowedDays.includes(currentDay) && !allowedDays.includes('all')) {
    return { 
      valid: false, 
      error: 'OUT_OF_SCHEDULE', 
      message: 'Este cupón no se puede canjear hoy'
    };
  }
  
  // 7. Verificar hora
  const currentHour = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentTimeDecimal = currentHour + (currentMinutes / 60);
  
  const startParts = String(rule.hours_start).split(':');
  const endParts = String(rule.hours_end).split(':');
  const startTime = parseInt(startParts[0]) + (parseInt(startParts[1] || 0) / 60);
  const endTime = parseInt(endParts[0]) + (parseInt(endParts[1] || 0) / 60);
  
  if (currentTimeDecimal < startTime || currentTimeDecimal >= endTime) {
    return { 
      valid: false, 
      error: 'OUT_OF_SCHEDULE', 
      message: `Horario de canje: ${rule.hours_start} - ${rule.hours_end}`
    };
  }
  
  // 8. Verificar gasto mínimo
  const minSpend = parseFloat(rule.min_spend) || 0;
  const spent = parseFloat(money_spent) || 0;
  
  if (spent < minSpend) {
    return { 
      valid: false, 
      error: 'MIN_SPEND_NOT_MET', 
      message: `Gasto mínimo requerido: ${minSpend}€`,
      min_spend: minSpend,
      current_spend: spent
    };
  }
  
  // 9. ¡TODO OK!
  return {
    valid: true,
    min_spend: minSpend,
    expires_at: expiresAt.toISOString(),
    store: pinResult.store.name
  };
}

// ========================================
// TEST FUNCTION
// ========================================

function testValidation() {
  const result = checkCouponValidation({
    ct_campaign_id: 'test_campaign',
    claimed_at: new Date(Date.now() - 86400000).toISOString(),
    money_spent: 20,
    store_pin: '1234',
    current_time: new Date().toISOString()
  });
  
  Logger.log(JSON.stringify(result, null, 2));
}
