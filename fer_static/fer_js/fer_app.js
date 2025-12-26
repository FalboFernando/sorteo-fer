// fer_app.js (con marcado de "comprobante_enviado" al hacer click en el botón WhatsApp)

let occupiedSet = new Set();   // enteros ocupados
let selected = new Set();      // enteros seleccionados
let allNumbers = [];           // enteros del rango
let currentPage = 0;
let RANGE_MIN = 0;
let RANGE_MAX = 999;
let RANGE_WIDTH = 3;

// guardamos la última operación confirmada para poder marcar comprobante_enviado
let lastOpId = null;

const elGrid = document.getElementById('numbersGrid');
const elSelectedCount = document.getElementById('selectedCount');
const elSelectedMax = document.getElementById('selectedMax');
const elNumsPerPurchase = document.getElementById('numsPerPurchase');

const elCountLibre = document.getElementById('countLibre');
const elCountReservado = document.getElementById('countReservado');
const elCountConfirmado = document.getElementById('countConfirmado');

const elPageSelect = document.getElementById('pageSelect');
const elStatusBox = document.getElementById('statusBox');

const btnRefresh = document.getElementById('btnRefresh');
const btnClear = document.getElementById('btnClear');
const btnCopyLink = document.getElementById('btnCopyLink');

const form = document.getElementById('reserveForm');
const btnReserve = document.getElementById('btnReserve');
const btnAutoScrollTop = document.getElementById('btnAutoScrollTop');

const modalOpId = document.getElementById('modalOpId');
const modalNums = document.getElementById('modalNums');
const btnWhatsApp = document.getElementById('btnWhatsApp');

const inpNombre = document.getElementById('inpNombre');
const inpDni = document.getElementById('inpDni');
const inpTelefono = document.getElementById('inpTelefono');
const inpEmail = document.getElementById('inpEmail');

elSelectedMax.textContent = String(NUMS_PER_PURCHASE);
elNumsPerPurchase.textContent = String(NUMS_PER_PURCHASE);

function showAlert(type, msg) {
  elStatusBox.innerHTML = `<div class="alert alert-${type} small" role="alert">${msg}</div>`;
}
function clearAlert() { elStatusBox.innerHTML = ''; }

function padNumber(n, width) {
  const s = String(n);
  return s.length >= width ? s : '0'.repeat(width - s.length) + s;
}

function buildAllNumbers(min, max) {
  const arr = [];
  for (let n = min; n <= max; n++) arr.push(n);
  return arr;
}

function normalizeToIntArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map(v => Number(String(v).trim()))
    .filter(v => Number.isFinite(v));
}

async function fetchInfo() {
  const res = await fetch(`${API_BASE_URL}?action=info`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'No se pudo leer info');
  return data.rules;
}

async function fetchNumbers() {
  const res = await fetch(`${API_BASE_URL}?action=numbers`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'No se pudo leer números');
  return data;
}

function updateCounters(counts) {
  elCountLibre.textContent = counts?.libre ?? '—';
  elCountReservado.textContent = counts?.reservado ?? '—';
  elCountConfirmado.textContent = counts?.confirmado ?? '—';
}

function updateSelectedUI() {
  elSelectedCount.textContent = String(selected.size);
}

function rebuildPageSelect() {
  const pages = Math.ceil(allNumbers.length / PAGE_SIZE);
  elPageSelect.innerHTML = '';
  for (let p = 0; p < pages; p++) {
    const start = p * PAGE_SIZE;
    const end = Math.min(start + PAGE_SIZE, allNumbers.length);
    const a = allNumbers[start];
    const b = allNumbers[end - 1];
    const opt = document.createElement('option');
    opt.value = String(p);
    opt.textContent = `${p + 1} (${padNumber(a, RANGE_WIDTH)}–${padNumber(b, RANGE_WIDTH)})`;
    elPageSelect.appendChild(opt);
  }
  elPageSelect.value = String(currentPage);
}

function renderGrid() {
  elGrid.innerHTML = '';

  const start = currentPage * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, allNumbers.length);
  const slice = allNumbers.slice(start, end);

  for (const num of slice) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'num-btn w-100';
    btn.textContent = padNumber(num, RANGE_WIDTH);

    const isOccupied = occupiedSet.has(num);
    const isSelected = selected.has(num);

    if (isOccupied) btn.classList.add('reserved');
    if (isSelected) btn.classList.add('selected');

    btn.addEventListener('click', () => {
      if (occupiedSet.has(num)) return;

      if (selected.has(num)) selected.delete(num);
      else {
        if (selected.size >= NUMS_PER_PURCHASE) {
          showAlert('warning', `Podés elegir como máximo ${NUMS_PER_PURCHASE} números.`);
          return;
        }
        selected.add(num);
      }
      clearAlert();
      updateSelectedUI();
      renderGrid();
    });

    elGrid.appendChild(btn);
  }
}

async function refreshAvailability() {
  const data = await fetchNumbers();
  // ocupados puede venir como strings "035" o números 35 -> normalizamos a int
  const occ = (data.occupied || [])
    .map(x => x.numero ?? x)
    .map(v => Number(String(v).trim()))
    .filter(Number.isFinite);

  occupiedSet = new Set(occ);
  updateCounters(data.counts);
  renderGrid();
}

function initQRs() {
  const qrT = document.getElementById('qrTransfer');
  qrT.innerHTML = '';
  new QRCode(qrT, { text: transferQRText(), width: 180, height: 180 });

  const qrS = document.getElementById('qrShare');
  qrS.innerHTML = '';
  new QRCode(qrS, { text: window.location.href, width: 180, height: 180 });
}

function makeWhatsAppLink(opId, numsInt, nombre, telefono) {
  const to = (WHATSAPP_NUMBER || '').trim();
  if (!to || to.includes('XXXXXXXX')) return '#';

  const numsTxt = numsInt.map(n => padNumber(n, RANGE_WIDTH)).join(', ');
  const text =
    `Hola! Soy ${nombre}.` +
    `\nReservé ${NUMS_PER_PURCHASE} números para el sorteo solidario.` +
    `\nOperación: ${opId}` +
    `\nNúmeros: ${numsTxt}` +
    `\nTel: ${telefono}` +
    `\nAdjunto comprobante. Gracias!`;

  return `https://wa.me/${encodeURIComponent(to)}?text=${encodeURIComponent(text)}`;
}

/**
 * Marca en el servidor el estado "comprobante_enviado" para la última operación.
 * Ojo: esto NO confirma pago real, solo que el usuario tocó el botón de WhatsApp.
 */
async function markProofSent(opId) {
  if (!opId) return;

  try {
    await fetch(API_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'proof_sent', operacion_id: opId }),
      // ayuda a que el request salga incluso si el navegador navega a wa.me
      keepalive: true
    });
  } catch (_) {
    // no mostramos error para no molestar al usuario
  }
}

async function reserve() {
  if (selected.size !== NUMS_PER_PURCHASE) {
    showAlert('warning', `Elegí exactamente ${NUMS_PER_PURCHASE} números antes de confirmar.`);
    return;
  }

  const nombre = inpNombre.value.trim();
  const dni = inpDni.value.trim();
  const telefono = inpTelefono.value.trim();
  const email = inpEmail.value.trim();

  if (!nombre || !telefono) {
    showAlert('warning', 'Completá nombre y teléfono.');
    return;
  }

  const numerosInt = Array.from(selected); // enteros

  btnReserve.disabled = true;
  btnReserve.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Reservando...`;

  try {
    const payload = {
      nombre_apellido: nombre,
      dni,
      telefono,
      email,
      // IMPORTANTE: mandamos enteros (0..999), no "000"
      numeros: numerosInt
    };

    const res = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!data.ok) {
      await refreshAvailability();
      selected.clear();
      updateSelectedUI();
      renderGrid();

      const occ = normalizeToIntArray(data.occupied || []);
      const occTxt = occ.length ? occ.map(n => padNumber(n, RANGE_WIDTH)).join(', ') : '—';
      showAlert('danger', `No se pudo reservar. Números ocupados (según servidor): <strong>${occTxt}</strong>. Elegí otros y reintentá.`);
      return;
    }

    const numsOK = normalizeToIntArray(data.numeros || numerosInt);

    // Guardamos opId para poder marcar comprobante_enviado al tocar WhatsApp
    lastOpId = data.operacion_id || null;

    // Sincronizamos y limpiamos selección
    selected.clear();
    updateSelectedUI();

    await refreshAvailability();

    modalOpId.textContent = data.operacion_id || '—';
    modalNums.textContent = numsOK.map(n => padNumber(n, RANGE_WIDTH)).join(', ');
    btnWhatsApp.href = makeWhatsAppLink(data.operacion_id, numsOK, nombre, telefono);

    const modal = new bootstrap.Modal(document.getElementById('successModal'));
    modal.show();

    showAlert('success', `Reserva confirmada. Operación: <strong class="font-mono">${data.operacion_id}</strong>.`);
  } catch (err) {
    showAlert('danger', `Error de conexión: ${err.message}`);
  } finally {
    btnReserve.disabled = false;
    btnReserve.innerHTML = `<i class="bi bi-check2-circle"></i> Confirmar reserva`;
  }
}

function wireEvents() {
  btnRefresh.addEventListener('click', async () => {
    clearAlert();
    try {
      btnRefresh.disabled = true;
      btnRefresh.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Actualizando...`;
      await refreshAvailability();
      showAlert('success', 'Disponibilidad actualizada.');
    } catch (err) {
      showAlert('danger', `No se pudo actualizar: ${err.message}`);
    } finally {
      btnRefresh.disabled = false;
      btnRefresh.innerHTML = `<i class="bi bi-arrow-clockwise"></i> Actualizar disponibilidad`;
    }
  });

  btnClear.addEventListener('click', async () => {
    selected.clear();
    updateSelectedUI();
    clearAlert();
    await refreshAvailability();
  });

  elPageSelect.addEventListener('change', () => {
    currentPage = Number(elPageSelect.value || 0);
    renderGrid();
    clearAlert();
  });

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    clearAlert();
    reserve();
  });

  btnAutoScrollTop.addEventListener('click', () => {
    document.getElementById('numeros').scrollIntoView({ behavior: 'smooth' });
  });

  btnCopyLink.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showAlert('success', 'Link copiado al portapapeles.');
    } catch {
      showAlert('warning', 'No pude copiar automáticamente. Copialo manualmente desde la barra de direcciones.');
    }
  });

  // ✅ NUEVO: al tocar el botón de WhatsApp, marcamos "comprobante_enviado"
  btnWhatsApp.addEventListener('click', async () => {
    // si el href es '#', no hacemos nada
    if (!lastOpId) return;
    await markProofSent(lastOpId);
  });
}

async function main() {
  try {
    const rules = await fetchInfo();

    RANGE_MIN = Number(rules.range.min ?? 0);
    RANGE_MAX = Number(rules.range.max ?? 999);
    RANGE_WIDTH = String(RANGE_MAX).length; // 999 -> 3

    allNumbers = buildAllNumbers(RANGE_MIN, RANGE_MAX);
    currentPage = 0;

    rebuildPageSelect();
    initQRs();
    wireEvents();

    await refreshAvailability();
    updateSelectedUI();
  } catch (err) {
    showAlert('danger', `Error inicializando: ${err.message}`);
  }
}

main();
