/* =========================================================
   Stock Opname PWA — app.js
   ========================================================= */

const STORAGE_KEY = 'stockopname.settings.v1';

const state = {
  field: 'ALL',
  results: [],
  activeItem: null,
  settings: loadSettings(),
};

// ---------- settings ----------

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { url: '', token: '', editor: '' };
  } catch (e) {
    return { url: '', token: '', editor: '' };
  }
}

function saveSettings(s) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  state.settings = s;
}

function settingsReady() {
  return !!(state.settings.url && state.settings.token && state.settings.editor);
}

// ---------- dom refs ----------

const el = {
  searchInput: document.getElementById('search-input'),
  btnSearch: document.getElementById('btn-search'),
  fieldChips: document.getElementById('field-chips'),
  results: document.getElementById('results'),
  summary: document.getElementById('result-summary'),
  cardTemplate: document.getElementById('card-template'),

  sheetOverlay: document.getElementById('sheet-overlay'),
  sheetTitle: document.getElementById('sheet-title'),
  sheetRefinfo: document.getElementById('sheet-refinfo'),
  btnCloseSheet: document.getElementById('btn-close-sheet'),
  editForm: document.getElementById('edit-form'),
  editLoc: document.getElementById('edit-loc'),
  editC: document.getElementById('edit-c'),
  editRef: document.getElementById('edit-ref'),
  editBal: document.getElementById('edit-bal'),
  editDiffs: document.getElementById('edit-diffs'),
  saveStatus: document.getElementById('save-status'),

  btnSettings: document.getElementById('btn-settings'),
  settingsOverlay: document.getElementById('settings-overlay'),
  btnCloseSettings: document.getElementById('btn-close-settings'),
  settingsForm: document.getElementById('settings-form'),
  setUrl: document.getElementById('set-url'),
  setToken: document.getElementById('set-token'),
  setEditor: document.getElementById('set-editor'),
  settingsStatus: document.getElementById('settings-status'),

  offlineBanner: document.getElementById('offline-banner'),
  toast: document.getElementById('toast'),
};

// ---------- offline banner ----------

function updateOnlineStatus() {
  el.offlineBanner.classList.toggle('hidden', navigator.onLine);
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

// ---------- toast ----------

let toastTimer = null;
function showToast(msg) {
  el.toast.textContent = msg;
  el.toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.add('hidden'), 2600);
}

// ---------- field chips ----------

el.fieldChips.addEventListener('click', (e) => {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  el.fieldChips.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
  btn.classList.add('active');
  state.field = btn.dataset.field;
});

// ---------- search ----------

el.btnSearch.addEventListener('click', runSearch);
el.searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') runSearch();
});

async function runSearch() {
  const q = el.searchInput.value.trim();

  if (!settingsReady()) {
    openSettings();
    showToast('Atur koneksi ke Google Sheet dulu ya');
    return;
  }
  if (q.length < 2) {
    el.summary.textContent = 'Ketik minimal 2 karakter';
    return;
  }
  if (!navigator.onLine) {
    el.summary.textContent = 'Tidak ada koneksi internet';
    return;
  }

  el.summary.textContent = 'Mencari…';
  el.results.innerHTML = '';

  try {
    const url = new URL(state.settings.url);
    url.searchParams.set('action', 'search');
    url.searchParams.set('q', q);
    url.searchParams.set('field', state.field);

    const res = await fetch(url.toString());
    const data = await res.json();

    if (!data.ok) {
      el.summary.textContent = 'Gagal: ' + (data.error || 'error tidak diketahui');
      return;
    }

    state.results = data.rows;
    renderResults(data);
  } catch (err) {
    el.summary.textContent = 'Gagal mengambil data. Cek URL Apps Script di Pengaturan.';
    console.error(err);
  }
}

function renderResults(data) {
  el.results.innerHTML = '';

  if (data.rows.length === 0) {
    el.summary.textContent = 'Tidak ada hasil';
    return;
  }

  el.summary.textContent = data.count + ' hasil ditemukan'
    + (data.truncated ? ' (dipotong, persempit pencarian)' : '');

  data.rows.forEach((item) => {
    const node = el.cardTemplate.content.cloneNode(true);
    const card = node.querySelector('.item-card');

    const sts = String(item.sts || '').toUpperCase();
    card.classList.add(sts === 'ACT' ? 'act' : sts === 'OBS' ? 'obs' : '');

    node.querySelector('.mcs').textContent = 'MCS# ' + item.mcs;
    const badge = node.querySelector('.sts');
    badge.textContent = sts || '—';

    node.querySelector('.model').textContent = item.model || '';
    node.querySelector('.loc').textContent = item.loc || '—';
    node.querySelector('.c').textContent = item.c || '—';
    node.querySelector('.so').textContent = item.so || '—';
    node.querySelector('.ref').textContent = item.ref || '—';
    node.querySelector('.bal').textContent = item.bal;
    node.querySelector('.in').textContent = item.in;
    node.querySelector('.out').textContent = item.out;
    node.querySelector('.date').textContent = formatDate(item.date);
    node.querySelector('.customer').textContent = item.customer || '';

    card.addEventListener('click', () => openEditSheet(item));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') openEditSheet(item);
    });

    el.results.appendChild(node);
  });
}

function formatDate(d) {
  if (!d) return '';
  try {
    const dt = new Date(d);
    if (isNaN(dt)) return String(d);
    return dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (e) {
    return String(d);
  }
}

// ---------- edit sheet ----------

function openEditSheet(item) {
  state.activeItem = item;
  el.sheetTitle.textContent = 'MCS# ' + item.mcs;
  el.sheetRefinfo.textContent =
    'Baris ' + item.row + ' · SO# ' + (item.so || '-') + ' · ' + (item.model || '');

  el.editLoc.value = item.loc || '';
  el.editC.value = item.c || '';
  el.editRef.value = item.ref || '';
  el.editBal.value = item.bal;

  el.editDiffs.innerHTML = '';
  el.saveStatus.textContent = '';
  el.saveStatus.className = 'save-status';

  el.sheetOverlay.classList.remove('hidden');
}

function closeEditSheet() {
  el.sheetOverlay.classList.add('hidden');
  state.activeItem = null;
}
el.btnCloseSheet.addEventListener('click', closeEditSheet);
el.sheetOverlay.addEventListener('click', (e) => {
  if (e.target === el.sheetOverlay) closeEditSheet();
});

el.editForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.activeItem) return;

  const item = state.activeItem;
  const edits = {};

  const newLoc = el.editLoc.value.trim();
  const newC = el.editC.value.trim();
  const newRef = el.editRef.value.trim();
  const newBal = el.editBal.value.trim();

  if (newLoc !== String(item.loc || '')) edits.loc = newLoc;
  if (newC !== String(item.c || '')) edits.c = newC;
  if (newRef !== String(item.ref || '')) edits.ref = newRef;
  if (newBal !== '' && Number(newBal) !== Number(item.bal)) edits.bal = Number(newBal);

  if (Object.keys(edits).length === 0) {
    el.saveStatus.textContent = 'Tidak ada perubahan.';
    el.saveStatus.className = 'save-status';
    return;
  }

  if (!navigator.onLine) {
    el.saveStatus.textContent = 'Tidak ada koneksi internet.';
    el.saveStatus.className = 'save-status err';
    return;
  }

  el.saveStatus.textContent = 'Menyimpan…';
  el.saveStatus.className = 'save-status';

  const payload = {
    action: 'update',
    token: state.settings.token,
    row: item.row,
    edits: edits,
    editor: state.settings.editor,
  };

  try {
    const res = await fetch(state.settings.url, {
      method: 'POST',
      // text/plain menghindari CORS preflight ke Apps Script
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!data.ok) {
      el.saveStatus.textContent = 'Gagal: ' + (data.error || 'error tidak diketahui');
      el.saveStatus.className = 'save-status err';
      return;
    }

    Object.assign(item, edits);
    el.saveStatus.textContent = 'Tersimpan ke Google Sheet ✓';
    el.saveStatus.className = 'save-status ok';
    showToast('Perubahan disimpan');
    renderResults({ rows: state.results, count: state.results.length });

    setTimeout(closeEditSheet, 700);
  } catch (err) {
    el.saveStatus.textContent = 'Gagal menyimpan. Coba lagi.';
    el.saveStatus.className = 'save-status err';
    console.error(err);
  }
});

// ---------- settings ----------

function openSettings() {
  el.setUrl.value = state.settings.url || '';
  el.setToken.value = state.settings.token || '';
  el.setEditor.value = state.settings.editor || '';
  el.settingsStatus.textContent = '';
  el.settingsOverlay.classList.remove('hidden');
}
function closeSettings() {
  el.settingsOverlay.classList.add('hidden');
}
el.btnSettings.addEventListener('click', openSettings);
el.btnCloseSettings.addEventListener('click', closeSettings);
el.settingsOverlay.addEventListener('click', (e) => {
  if (e.target === el.settingsOverlay) closeSettings();
});

el.settingsForm.addEventListener('submit', (e) => {
  e.preventDefault();
  saveSettings({
    url: el.setUrl.value.trim(),
    token: el.setToken.value.trim(),
    editor: el.setEditor.value.trim(),
  });
  el.settingsStatus.textContent = 'Tersimpan ✓';
  el.settingsStatus.className = 'save-status ok';
  setTimeout(closeSettings, 500);
});

// first run: force settings if empty
if (!settingsReady()) {
  setTimeout(openSettings, 400);
}

// ---------- service worker ----------

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW gagal:', e));
  });
}
