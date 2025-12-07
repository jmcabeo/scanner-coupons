# Omnia 3.0 - Configuración de Google Sheets (Simplificado)

## Estructura Simplificada

Solo necesitas **2 hojas** - las campañas se sincronizan directamente de Coupontools:

| Hoja | Propósito |
|------|-----------|
| `validation_rules` | Reglas de bloqueo por campaña |
| `stores` | PINs de tiendas |

---

## Paso 1: Crear el Sheet

1. Ve a [Google Sheets](https://sheets.google.com)
2. Crea un nuevo documento
3. Renómbralo a **"Omnia 3.0 - Config"**

---

## Paso 2: Crear la hoja `validation_rules`

### Cabeceras (Fila 1)
```
ct_campaign_id | days_allowed | hours_start | hours_end | min_spend | active
```

**Esta hoja se llena automáticamente desde el Admin Panel** - no necesitas añadir datos manualmente.

---

## Paso 3: Crear la hoja `stores`

### Cabeceras (Fila 1)
```
id | pin | name | timezone | active
```

### Datos de ejemplo
| id | pin | name | timezone | active |
|----|-----|------|----------|--------|
| 1 | 1234 | Tienda Centro | Europe/Madrid | TRUE |
| 2 | 5678 | Tienda Norte | Europe/Madrid | TRUE |

---

## Paso 4: Añadir el Script

1. En Sheets → **Extensiones > Apps Script**
2. Borra el código existente
3. Copia el contenido de `google_apps_script/Code.gs`
4. **Actualiza** `SPREADSHEET_ID` con el ID de tu Sheet
   - El ID está en la URL: `https://docs.google.com/spreadsheets/d/ESTE_ES_EL_ID/edit`
5. Guarda (Ctrl+S)

---

## Paso 5: Desplegar

1. Click en **Desplegar > Nueva implementación**
2. Tipo: **Aplicación web**
3. Configuración:
   - Ejecutar como: **Yo**
   - Acceso: **Cualquier persona**
4. Click en **Desplegar**
5. Autoriza cuando te lo pida
6. **Copia la URL** generada

---

## Paso 6: Configurar Admin Panel

1. Abre el Admin Panel (`/admin/`)
2. Ingresa tu **API Key de Coupontools**
3. Ingresa la **URL de Apps Script** que copiaste
4. Click en **Guardar Config**
5. Click en **Sincronizar Campañas**

Tus campañas aparecerán automáticamente. Click en cada una para añadir las reglas de validación.

---

## Códigos de Días

Usar códigos de 3 letras en inglés:

| Código | Día |
|--------|-----|
| `mon` | Lunes |
| `tue` | Martes |
| `wed` | Miércoles |
| `thu` | Jueves |
| `fri` | Viernes |
| `sat` | Sábado |
| `sun` | Domingo |
