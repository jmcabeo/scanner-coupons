# Omnia Scanner 3.0

Sistema de validación de cupones con Scanner PWA y Panel de Administración.

## Componentes

- **Scanner PWA** (`/`) - Aplicación para escanear y validar cupones
- **Admin Panel** (`/admin/`) - Panel de administración para gestionar campañas y reglas

## Configuración

### 1. n8n Workflows
Importa los workflows de `/n8n_workflows/` en tu instancia de n8n:
- `check-status.json` - Verificar estado del cupón
- `commit-validation.json` - Quemar cupón en Coupontools
- `get-campaigns.json` - Sincronizar campañas
- `rules-manager.json` - CRUD de reglas de validación
- `verify-pin.json` - Validar PIN de tienda

### 2. Google Sheets
Crea un Google Sheet con dos hojas:

**validation_rules:**
| ct_campaign_id | days_allowed | hours_start | hours_end | min_spend | valid_after_hours | valid_until_days | active |

**stores:**
| pin | name | timezone | active |

### 3. Configurar URLs
En `app.js`, actualiza las URLs de n8n:
```javascript
const CONFIG = {
    N8N_CHECK_URL: 'https://tu-n8n.com/webhook/check-status',
    N8N_COMMIT_URL: 'https://tu-n8n.com/webhook/commit-validation',
    ...
};
```

## Tecnologías
- HTML/CSS/JavaScript (Vanilla)
- n8n (Workflows)
- Google Sheets (Base de datos)
- Coupontools API

## Licencia
MIT
