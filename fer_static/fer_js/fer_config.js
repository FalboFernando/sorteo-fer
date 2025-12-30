// URL del Web App (Apps Script)
const API_BASE_URL = "https://script.google.com/macros/s/AKfycbyd9iLnbfl33SxdAFUwhfAWjAZytXFLRxbV4BZTGyk8WhQG4oa-dAIlcS4zz47vseQqLg/exec";

// WhatsApp de Fernando (formato internacional SIN +, sin espacios). Ej: 54911XXXXXXXX
const WHATSAPP_NUMBER = "5491154574368";

// Reglas visibles en la UI (deben coincidir con Apps Script)
const NUMS_PER_PURCHASE = 5;
const PRICE = 10000;
const TRANSFER_ALIAS = "f.falbo";

// Paginación (si usás 000..999, 100 por página queda bien)
const PAGE_SIZE = 100;

// Texto del QR de transferencia (informativo)
function transferQRText() {
  return `ALIAS: ${TRANSFER_ALIAS}\nMONTO: ${PRICE}\nCONCEPTO: Sorteo solidario\nTEL: 1166764043`;
}
