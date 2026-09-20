let allChannels = [];
let originalChannels = [];
let deletedChannels = [];
let selectedSlots = new Set();
let currentFilter = 'all';
let searchQuery = '';
let hasUnsavedChanges = false;
let draggedItemIndex = null;
let rawTemplateBuffer = null;

const channelListEl = document.getElementById('channelList');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearch');
const showingCountEl = document.getElementById('showingCount');
const countAllEl = document.getElementById('countAll');
const countHDEl = document.getElementById('countHD');
const countSDEl = document.getElementById('countSD');
const countMovedEl = document.getElementById('countMoved');
const countDeletedEl = document.getElementById('countDeleted');
const countSporEl = document.getElementById('countSpor');
const countHaberEl = document.getElementById('countHaber');
const countCocukEl = document.getElementById('countCocuk');
const countBelgeselEl = document.getElementById('countBelgesel');
const countMuzikEl = document.getElementById('countMuzik');
const selectAllCheckbox = document.getElementById('selectAllCheckbox');
const bulkActions = document.getElementById('bulkActions');
const selectedCountEl = document.getElementById('selectedCount');
const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
const saveBtn = document.getElementById('saveBtn');
const downloadBtn = document.getElementById('downloadBtn');
const downloadBtnText = document.getElementById('downloadBtnText');
const brandSelect = document.getElementById('brandSelect');
const exportMenuBtn = document.getElementById('exportMenuBtn');
const exportMenu = document.getElementById('exportMenu');
const fileUploadInput = document.getElementById('fileUploadInput');
const uploadBtn = document.getElementById('uploadBtn');
const dropzoneOverlay = document.getElementById('dropzoneOverlay');
const guideBtn = document.getElementById('guideBtn');
const guideModal = document.getElementById('guideModal');
const closeGuideModal = document.getElementById('closeGuideModal');
const guideUnderstandBtn = document.getElementById('guideUnderstandBtn');
const toastEl = document.getElementById('toast');
const unsavedBadge = document.getElementById('unsavedBadge');
const statusMessage = document.getElementById('statusMessage');

const presetPopular = document.getElementById('presetPopular');
const presetCleanGarbage = document.getElementById('presetCleanGarbage');
const presetSports = document.getElementById('presetSports');
const presetNews = document.getElementById('presetNews');
const presetReset = document.getElementById('presetReset');

const POPULAR_ORDER = [
  'TRT1 HD', 'ATV', 'KANAL D HD', 'SHOW HD', 'STAR TV', 'TV8', 'NOW HD',
  'KANAL 7 HD', 'BEYAZ TV HD', 'HABERTURK HD', 'CNN TÜRK HD', 'A HABER',
  'TRT HABER HD', 'SZC', 'HALK TV HD', 'HALK TV', '360 HD', '24 HD',
  'ULKE TV HD', 'HABER GLOBAL HD', 'AKIT TV HD', 'BLOOMBERGHT HD',
  'TRT SPOR HD', 'A SPOR', 'TV 8,5 HD', 'HT SPOR HD', 'beIN SPORTS HABER',
  'TRT BELGESEL HD', 'DMAX HD', 'TLC HD', 'TRT COCUK HD', 'minikaCOCUK',
  'minikaGO', 'CARTOON NETWORK', 'DIYANET TV HD', 'SEMERKAND HD',
  'TRT MUZIK HD', 'KRAL POP', 'DREAM TÜRK', 'FB TV HD', 'FB TV'
];

const SPORTS_KEYWORDS = ['SPOR', 'SPORT', 'TARAFTAR', 'FIGHT', 'FB TV', 'EUROSPORT'];
const NEWS_KEYWORDS = ['HABER', 'NEWS', 'SZC', 'HALK', '24 HD', 'ULKE', 'CNN', 'BLOOMBERG', 'NTV', 'TELE1', 'A HABER', 'TRT HABER', 'TV 24', 'TGRT'];
const KIDS_KEYWORDS = ['COCUK', 'ÇOCUK', 'MINIKA', 'MİNİKA', 'CARTOON', 'DISNEY', 'NICK', 'BOOMERANG'];
const DOC_KEYWORDS = ['BELGESEL', 'DMAX', 'TLC', 'NAT GEO', 'DISCOVERY', 'PLANET', 'ANIMAL', 'HISTORY', 'YABAN', 'SCIENCE'];
const MUSIC_KEYWORDS = ['MUZIK', 'MÜZİK', 'KRAL', 'DREAM', 'NUMBER', 'POWER', 'POP', 'KLASIK', 'NR1', 'TEMPO'];

// Client-side Binary Parser for ALi .bin format
function parseBinaryChannels(buffer) {
  const HEADER_SIZE = 530;
  const RECORD_SIZE = 120;
  const MAX_SLOTS = 492;
  const totalSlots = Math.floor((buffer.byteLength - HEADER_SIZE) / RECORD_SIZE);
  const view = new DataView(buffer);
  const decoder = new TextDecoder('iso-8859-9');
  const channels = [];

  for (let i = 0; i < Math.min(totalSlots, MAX_SLOTS); i++) {
    const offset = HEADER_SIZE + i * RECORD_SIZE;
    const nameBytes = new Uint8Array(buffer, offset + 88, 32);
    let zeroIdx = nameBytes.indexOf(0);
    if (zeroIdx === -1) zeroIdx = 32;
    let slice = nameBytes.subarray(0, zeroIdx);
    const hasPrefix = slice.length > 0 && slice[0] < 0x20;
    if (hasPrefix) slice = slice.subarray(1);

    let name = '';
    try {
      name = decoder.decode(slice).trim();
    } catch (e) {
      name = new TextDecoder('latin1').decode(slice).trim();
    }

    const orderIdx = view.getUint16(offset + 8, true);
    const chNum = view.getUint16(offset + 10, true);

    channels.push({
      slot: i,
      orig_slot: i,
      orig_ch: chNum,
      orig_ord: orderIdx,
      name: name || `Kanal ${i + 1}`,
      is_hd: name.toUpperCase().includes('HD'),
      has_prefix: hasPrefix
    });
  }
  return channels;
}

// Client-side Binary Builder for ALi .bin format
function buildBinaryChannels(channelsData, templateBuffer) {
  const HEADER_SIZE = 530;
  const RECORD_SIZE = 120;
  const MAX_SLOTS = 492;
  const totalLen = HEADER_SIZE + MAX_SLOTS * RECORD_SIZE;
  const buffer = templateBuffer && templateBuffer.byteLength >= totalLen
    ? templateBuffer.slice(0)
    : new ArrayBuffer(totalLen);
  const view = new DataView(buffer);
  const u8 = new Uint8Array(buffer);

  const trMap = {
    'ğ': 0xf0, 'Ğ': 0xd0, 'ı': 0xfd, 'İ': 0xdd, 'ş': 0xfe, 'Ş': 0xde,
    'ç': 0xe7, 'Ç': 0xc7, 'ö': 0xf6, 'Ö': 0xd6, 'ü': 0xfc, 'Ü': 0xdc
  };

  channelsData.forEach((ch, idx) => {
    const srcSlot = ch.orig_slot !== undefined ? ch.orig_slot : idx;
    const srcOffset = HEADER_SIZE + srcSlot * RECORD_SIZE;
    const dstOffset = HEADER_SIZE + idx * RECORD_SIZE;

    if (srcOffset !== dstOffset && templateBuffer && templateBuffer.byteLength >= srcOffset + RECORD_SIZE) {
      u8.set(new Uint8Array(templateBuffer, srcOffset, RECORD_SIZE), dstOffset);
    }

    view.setUint16(dstOffset + 8, idx, true);
    view.setUint16(dstOffset + 10, idx + 1, true);
    view.setUint16(dstOffset + 30, idx + 1, true);

    const name = (ch.name || '').trim();
    if (name) {
      const fieldOffset = dstOffset + 88;
      const prefix = (templateBuffer && u8[srcOffset + 88] < 0x20) ? u8[srcOffset + 88] : 0;
      let pLen = prefix ? 1 : 0;
      if (prefix) u8[fieldOffset] = prefix;

      const encoded = [];
      for (let c of name) {
        if (trMap[c] !== undefined) encoded.push(trMap[c]);
        else {
          const code = c.charCodeAt(0);
          encoded.push(code < 256 ? code : 0x3f);
        }
      }

      const maxLen = 31 - pLen;
      for (let b = 0; b < maxLen; b++) {
        u8[fieldOffset + pLen + b] = b < encoded.length ? encoded[b] : 0;
      }
      u8[fieldOffset + 31] = 0;
    }
  });

  for (let emptyIdx = channelsData.length; emptyIdx < MAX_SLOTS; emptyIdx++) {
    const dstOffset = HEADER_SIZE + emptyIdx * RECORD_SIZE;
    view.setUint16(dstOffset + 8, 0xffff, true);
    view.setUint16(dstOffset + 10, 0, true);
    view.setUint16(dstOffset + 30, 0, true);
  }

  return buffer;
}

function triggerBrowserDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function clientExportChannels(fmt) {
  if (fmt === 'bin') {
    const buf = buildBinaryChannels(allChannels, rawTemplateBuffer);
    const blob = new Blob([buf], { type: 'application/octet-stream' });
    triggerBrowserDownload(blob, 'CHANNELLIST.bin');
    showToast('CHANNELLIST.bin tarayıcıda oluşturuldu ve indirildi!', 'success');
  } else if (fmt === 'sdx') {
    const lines = [
      "SATCODX103",
      "; Vestel / Regal / SEG / Toshiba Uyumlu Kanal Listesi",
      "; Olusturma: Evrensel TV & Uydu Kanal Editoru",
      ""
    ];
    allChannels.forEach((ch, idx) => {
      const clean = (ch.name || `Kanal ${idx + 1}`).replace(';', '').padEnd(24, ' ');
      lines.push(`CX${String(idx + 1).padStart(4, '0')} ${clean} 11054 V 30000 3/4 42.0E`);
    });
    const blob = new Blob([lines.join('\r\n') + '\r\n'], { type: 'application/octet-stream' });
    triggerBrowserDownload(blob, 'sat_default.sdx');
    showToast('sat_default.sdx indirildi!', 'success');
  } else if (fmt === 'm3u') {
    const lines = ["#EXTM3U", "# TV & Uydu Kanal Listesi"];
    allChannels.forEach((ch, idx) => {
      const name = ch.name || `Kanal ${idx + 1}`;
      const group = SPORTS_KEYWORDS.some(k => name.toUpperCase().includes(k)) ? 'Spor' : (
        NEWS_KEYWORDS.some(k => name.toUpperCase().includes(k)) ? 'Haber' : 'Genel'
      );
      lines.push(`#EXTINF:-1 tvg-id="${idx + 1}" tvg-chno="${idx + 1}" tvg-name="${name}" group-title="${group}",${name}`);
      lines.push(`http://127.0.0.1:8080/stream/${idx + 1}`);
    });
    const blob = new Blob([lines.join('\n') + '\n'], { type: 'audio/x-mpegurl;charset=utf-8' });
    triggerBrowserDownload(blob, 'kanallar.m3u');
    showToast('kanallar.m3u indirildi!', 'success');
  } else if (fmt === 'csv') {
    const rows = ['Sira_No;Kanal_Adi;HD_Durumu;Orijinal_Sira'];
    allChannels.forEach((ch, idx) => {
      const hd = ch.is_hd ? 'EVET' : 'HAYIR';
      rows.push(`${idx + 1};${ch.name};${hd};${ch.orig_ch || (idx + 1)}`);
    });
    const blob = new Blob(['\ufeff' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    triggerBrowserDownload(blob, 'kanallar.csv');
    showToast('kanallar.csv indirildi!', 'success');
  } else if (fmt === 'json') {
    const data = allChannels.map((ch, idx) => ({
      order: idx + 1,
      name: ch.name,
      is_hd: !!ch.is_hd,
      orig_ch: ch.orig_ch || (idx + 1)
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    triggerBrowserDownload(blob, 'kanallar.json');
    showToast('kanallar.json indirildi!', 'success');
  }
}

async function loadChannels() {
  // 1. Try Backend API
  try {
    const res = await fetch('/api/channels');
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'ok') {
        allChannels = data.channels.map((ch, idx) => ({ ...ch, current_idx: idx }));
        originalChannels = JSON.parse(JSON.stringify(allChannels));
        deletedChannels = [];
        selectedSlots.clear();
        updateCounts();
        renderChannels();
        showToast(`Kanal listesi yüklendi (${allChannels.length} TV Kanalı)`, 'success');
        return;
      }
    }
  } catch (err) {
    // API not reachable, try client-side fetch of static CHANNELLIST.bin
  }

  // 2. Try fetching CHANNELLIST.bin directly (GitHub Pages / static server)
  try {
    const binRes = await fetch('CHANNELLIST.bin');
    if (binRes.ok) {
      const buf = await binRes.arrayBuffer();
      rawTemplateBuffer = buf;
      const channels = parseBinaryChannels(buf);
      if (channels && channels.length > 0) {
        allChannels = channels.map((ch, idx) => ({ ...ch, current_idx: idx }));
        originalChannels = JSON.parse(JSON.stringify(allChannels));
        deletedChannels = [];
        selectedSlots.clear();
        updateCounts();
        renderChannels();
        statusMessage.textContent = `Çevrimdışı Mod. Dosya: CHANNELLIST.bin (${allChannels.length} kanal)`;
        showToast(`Hazır! ${allChannels.length} TV kanalı yüklendi`, 'success');
        return;
      }
    }
  } catch (e) {}

  // 3. Built-in Fallback Popular Channels
  allChannels = POPULAR_ORDER.map((name, idx) => ({
    slot: idx,
    orig_slot: idx,
    orig_ch: idx + 1,
    orig_ord: idx,
    name: name,
    is_hd: name.includes('HD'),
    has_prefix: false,
    current_idx: idx
  }));
  originalChannels = JSON.parse(JSON.stringify(allChannels));
  updateCounts();
  renderChannels();
  statusMessage.textContent = 'Çevrimdışı Mod (Kendi dosyanızı yükleyebilirsiniz)';
  showToast('Kendi TV dosyanızı sürükleyip bırakabilirsiniz!', 'info');
}

function updateCounts() {
  const total = allChannels.length;
  const hdCount = allChannels.filter(c => c.is_hd).length;
  const movedCount = allChannels.filter((c, idx) => c.orig_slot !== idx).length;
  const deletedCount = deletedChannels.length;

  countAllEl.textContent = total;
  countHDEl.textContent = hdCount;
  countSDEl.textContent = total - hdCount;
  countMovedEl.textContent = movedCount;
  countDeletedEl.textContent = deletedCount;

  if (countSporEl) countSporEl.textContent = allChannels.filter(c => SPORTS_KEYWORDS.some(k => c.name.toUpperCase().includes(k))).length;
  if (countHaberEl) countHaberEl.textContent = allChannels.filter(c => NEWS_KEYWORDS.some(k => c.name.toUpperCase().includes(k))).length;
  if (countCocukEl) countCocukEl.textContent = allChannels.filter(c => KIDS_KEYWORDS.some(k => c.name.toUpperCase().includes(k))).length;
  if (countBelgeselEl) countBelgeselEl.textContent = allChannels.filter(c => DOC_KEYWORDS.some(k => c.name.toUpperCase().includes(k))).length;
  if (countMuzikEl) countMuzikEl.textContent = allChannels.filter(c => MUSIC_KEYWORDS.some(k => c.name.toUpperCase().includes(k))).length;

  if (selectedSlots.size > 0) {
    bulkActions.style.display = 'flex';
    selectedCountEl.textContent = selectedSlots.size;
  } else {
    bulkActions.style.display = 'none';
  }

  if (movedCount > 0 || deletedCount > 0 || hasUnsavedChanges) {
    unsavedBadge.style.display = 'inline-block';
    unsavedBadge.textContent = `${movedCount} Kanal Taşıma, ${deletedCount} Silme (Kaydedilmedi)`;
  } else {
    unsavedBadge.style.display = 'none';
  }
}

function getFilteredChannels() {
  if (currentFilter === 'deleted') {
    let list = [...deletedChannels];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(ch => ch.name.toLowerCase().includes(q));
    }
    return list;
  }

  let list = allChannels.map((ch, i) => ({
    ...ch,
    current_num: i + 1,
    is_moved: ch.orig_slot !== i
  }));

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(ch => ch.name.toLowerCase().includes(q) || String(ch.current_num) === q);
  }

  if (currentFilter === 'hd') list = list.filter(ch => ch.is_hd);
  else if (currentFilter === 'sd') list = list.filter(ch => !ch.is_hd);
  else if (currentFilter === 'moved') list = list.filter(ch => ch.is_moved);
  else if (currentFilter === 'spor') list = list.filter(ch => SPORTS_KEYWORDS.some(k => ch.name.toUpperCase().includes(k)));
  else if (currentFilter === 'haber') list = list.filter(ch => NEWS_KEYWORDS.some(k => ch.name.toUpperCase().includes(k)));
  else if (currentFilter === 'cocuk') list = list.filter(ch => KIDS_KEYWORDS.some(k => ch.name.toUpperCase().includes(k)));
  else if (currentFilter === 'belgesel') list = list.filter(ch => DOC_KEYWORDS.some(k => ch.name.toUpperCase().includes(k)));
  else if (currentFilter === 'muzik') list = list.filter(ch => MUSIC_KEYWORDS.some(k => ch.name.toUpperCase().includes(k)));

  return list;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderChannels() {
  const filtered = getFilteredChannels();
  showingCountEl.textContent = filtered.length;

  if (filtered.length === 0) {
    const msg = currentFilter === 'deleted'
      ? '🗑️ Silinmiş kanal bulunmuyor.'
      : 'Aramanıza uygun kanal bulunamadı.';
    channelListEl.innerHTML = `<div class="loading-state"><p>${msg}</p></div>`;
    return;
  }

  if (currentFilter === 'deleted') {
    channelListEl.innerHTML = filtered.map((ch, i) => `
      <div class="channel-row deleted-row">
        <div class="col-check"><span>🗑️</span></div>
        <div class="col-drag">-</div>
        <div class="col-num">
          <span class="channel-num-badge" style="background:rgba(239,68,68,0.2);color:#fca5a5;">Silindi</span>
        </div>
        <div class="col-name channel-name-cell">
          <span class="channel-title" style="text-decoration:line-through;color:var(--text-muted);">${escapeHtml(ch.name)}</span>
          ${ch.is_hd ? '<span class="hd-tag">HD</span>' : ''}
        </div>
        <div class="col-orig orig-cell">Asıl: #${ch.orig_slot + 1}</div>
        <div class="col-quick">-</div>
        <div class="col-actions row-actions">
          <button class="action-btn restore-btn" onclick="restoreChannel(${i})">↩️ Geri Yükle</button>
        </div>
      </div>
    `).join('');
    return;
  }

  channelListEl.innerHTML = filtered.map(ch => {
    const globalIdx = allChannels.findIndex(c => c.orig_slot === ch.orig_slot);
    const isMoved = ch.orig_slot !== globalIdx;
    const isChecked = selectedSlots.has(ch.orig_slot);

    return `
      <div class="channel-row ${isMoved ? 'moved' : ''}" draggable="true" data-global-idx="${globalIdx}">
        <div class="col-check" onclick="event.stopPropagation()">
          <input type="checkbox" class="row-checkbox" data-slot="${ch.orig_slot}" ${isChecked ? 'checked' : ''} onchange="toggleSelect(${ch.orig_slot}, this.checked)">
        </div>
        <div class="col-drag">
          <div class="drag-handle" title="Sürükle">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="19" r="1"></circle>
              <circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="19" r="1"></circle>
            </svg>
          </div>
        </div>
        <div class="col-num"><span class="channel-num-badge">#${globalIdx + 1}</span></div>
        <div class="col-name channel-name-cell">
          <span class="channel-title" title="${escapeHtml(ch.name)}">${escapeHtml(ch.name)}</span>
          ${ch.is_hd ? '<span class="hd-tag">HD</span>' : ''}
        </div>
        <div class="col-orig orig-cell">Asıl: #${ch.orig_slot + 1}</div>
        <div class="col-quick">
          <div class="quick-move-form" onclick="event.stopPropagation()">
            <input type="number" min="1" max="${allChannels.length}" class="quick-move-input" placeholder="No" value="${globalIdx + 1}" data-global-idx="${globalIdx}">
            <button class="quick-move-btn" onclick="handleQuickMove(${globalIdx}, this)">Git</button>
          </div>
        </div>
        <div class="col-actions row-actions">
          <button class="action-btn" title="En Başa" onclick="moveToTop(${globalIdx})">⏫</button>
          <button class="action-btn" title="Yukarı" onclick="moveChannel(${globalIdx}, -1)">▲</button>
          <button class="action-btn" title="Aşağı" onclick="moveChannel(${globalIdx}, 1)">▼</button>
          <button class="action-btn" title="İsim Düzenle" onclick="editChannelName(${globalIdx})">✏️</button>
          <button class="action-btn delete-btn" title="Sil" onclick="deleteChannel(${globalIdx})">🗑️</button>
        </div>
      </div>
    `;
  }).join('');

  attachDragEvents();
  updateSelectAllCheckbox();
}

window.toggleSelect = function(slot, checked) {
  checked ? selectedSlots.add(slot) : selectedSlots.delete(slot);
  updateCounts();
  updateSelectAllCheckbox();
};

selectAllCheckbox.addEventListener('change', e => {
  const filtered = getFilteredChannels();
  filtered.forEach(ch => {
    e.target.checked ? selectedSlots.add(ch.orig_slot) : selectedSlots.delete(ch.orig_slot);
  });
  updateCounts();
  renderChannels();
});

function updateSelectAllCheckbox() {
  const filtered = getFilteredChannels();
  if (filtered.length === 0) {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
    return;
  }
  const allSelected = filtered.every(ch => selectedSlots.has(ch.orig_slot));
  const someSelected = filtered.some(ch => selectedSlots.has(ch.orig_slot));
  selectAllCheckbox.checked = allSelected;
  selectAllCheckbox.indeterminate = someSelected && !allSelected;
}

window.deleteChannel = function(idx) {
  const item = allChannels.splice(idx, 1)[0];
  selectedSlots.delete(item.orig_slot);
  deletedChannels.push(item);
  hasUnsavedChanges = true;
  updateCounts();
  renderChannels();
  showToast(`"${item.name}" silindi.`, 'success');
};

deleteSelectedBtn.addEventListener('click', () => {
  if (selectedSlots.size === 0) return;
  const count = selectedSlots.size;
  if (!confirm(`Seçilen ${count} kanalı silmek istediğinize emin misiniz?`)) return;

  const remaining = [];
  allChannels.forEach(ch => {
    selectedSlots.has(ch.orig_slot) ? deletedChannels.push(ch) : remaining.push(ch);
  });

  allChannels = remaining;
  selectedSlots.clear();
  hasUnsavedChanges = true;
  updateCounts();
  renderChannels();
  showToast(`${count} kanal silindi.`, 'success');
});

window.restoreChannel = function(delIdx) {
  const item = deletedChannels.splice(delIdx, 1)[0];
  allChannels.push(item);
  hasUnsavedChanges = true;
  updateCounts();
  renderChannels();
  showToast(`"${item.name}" geri eklendi!`, 'success');
};

presetCleanGarbage.addEventListener('click', () => {
  const garbagePattern = /^(PROG-|TEST\s*\d+|[rni]$)/i;
  const toDelete = [];
  const kept = [];

  allChannels.forEach(ch => {
    const name = ch.name.trim().toUpperCase();
    if (!name || garbagePattern.test(name) || name === 'TEST 1' || name === 'TEST 2' || name.startsWith('PROG-')) {
      toDelete.push(ch);
    } else {
      kept.push(ch);
    }
  });

  if (toDelete.length === 0) {
    showToast('Temizlenecek gereksiz kanal bulunamadı.', 'info');
    return;
  }

  if (!confirm(`${toDelete.length} adet çöp kanal bulundu.\nBunların tümü silinsin mi?`)) return;

  toDelete.forEach(ch => {
    selectedSlots.delete(ch.orig_slot);
    deletedChannels.push(ch);
  });

  allChannels = kept;
  hasUnsavedChanges = true;
  updateCounts();
  renderChannels();
  showToast(`🧹 ${toDelete.length} gereksiz kanal temizlendi!`, 'success');
});

function moveChannel(idx, offset) {
  const target = idx + offset;
  if (target < 0 || target >= allChannels.length) return;
  const item = allChannels.splice(idx, 1)[0];
  allChannels.splice(target, 0, item);
  hasUnsavedChanges = true;
  updateCounts();
  renderChannels();
  scrollRowIntoView(target);
}

window.handleQuickMove = function(fromIdx, btn) {
  const input = btn.previousElementSibling;
  const targetNum = parseInt(input.value);
  if (isNaN(targetNum) || targetNum < 1 || targetNum > allChannels.length) {
    showToast(`1 ile ${allChannels.length} arasında bir numara girin.`, 'error');
    return;
  }

  const toIdx = targetNum - 1;
  if (fromIdx === toIdx) return;

  const item = allChannels.splice(fromIdx, 1)[0];
  allChannels.splice(toIdx, 0, item);
  hasUnsavedChanges = true;
  updateCounts();
  renderChannels();
  scrollRowIntoView(toIdx);
  showToast(`"${item.name}" → #${targetNum}`, 'success');
};

function moveToTop(idx) {
  if (idx === 0) return;
  const item = allChannels.splice(idx, 1)[0];
  allChannels.unshift(item);
  hasUnsavedChanges = true;
  updateCounts();
  renderChannels();
  scrollRowIntoView(0);
  showToast(`"${item.name}" → #1`, 'success');
}

function editChannelName(idx) {
  const current = allChannels[idx].name;
  const newName = prompt('Yeni kanal adı (maks. 28 karakter):', current);
  if (newName !== null && newName.trim() !== '') {
    allChannels[idx].name = newName.trim().slice(0, 28);
    hasUnsavedChanges = true;
    updateCounts();
    renderChannels();
    showToast('Kanal adı güncellendi.', 'success');
  }
}

function scrollRowIntoView(idx) {
  setTimeout(() => {
    const row = document.querySelector(`[data-global-idx="${idx}"]`);
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      row.style.boxShadow = '0 0 15px rgba(59, 130, 246, 0.8)';
      setTimeout(() => { row.style.boxShadow = ''; }, 1000);
    }
  }, 50);
}

function attachDragEvents() {
  const rows = channelListEl.querySelectorAll('.channel-row');

  rows.forEach(row => {
    row.addEventListener('dragstart', e => {
      draggedItemIndex = parseInt(row.dataset.globalIdx);
      row.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', draggedItemIndex);
    });

    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      rows.forEach(r => r.classList.remove('drag-over'));
      draggedItemIndex = null;
    });

    row.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      row.classList.add('drag-over');
    });

    row.addEventListener('dragleave', () => row.classList.remove('drag-over'));

    row.addEventListener('drop', e => {
      e.preventDefault();
      row.classList.remove('drag-over');
      const targetIdx = parseInt(row.dataset.globalIdx);

      if (draggedItemIndex !== null && draggedItemIndex !== targetIdx) {
        const item = allChannels.splice(draggedItemIndex, 1)[0];
        allChannels.splice(targetIdx, 0, item);
        hasUnsavedChanges = true;
        updateCounts();
        renderChannels();
        showToast(`Kanal #${targetIdx + 1} sırasına taşındı.`, 'success');
      }
    });
  });
}

presetPopular.addEventListener('click', () => {
  if (!confirm('Standart Türk TV sıralaması uygulansın mı?')) return;

  const placed = [];
  const remaining = [...allChannels];

  POPULAR_ORDER.forEach(target => {
    const idx = remaining.findIndex(c => {
      const n = c.name.toUpperCase();
      return n === target.toUpperCase() || n.startsWith(target.toUpperCase() + ' ') || n === target;
    });
    if (idx !== -1) placed.push(remaining.splice(idx, 1)[0]);
  });

  allChannels = [...placed, ...remaining];
  hasUnsavedChanges = true;
  updateCounts();
  renderChannels();
  channelListEl.scrollTop = 0;
  showToast(`${placed.length} popüler kanal başa alındı.`, 'success');
});

presetSports.addEventListener('click', () => {
  const sports = [], rest = [];
  allChannels.forEach(ch => {
    SPORTS_KEYWORDS.some(k => ch.name.toUpperCase().includes(k)) ? sports.push(ch) : rest.push(ch);
  });
  allChannels = [...sports, ...rest];
  hasUnsavedChanges = true;
  updateCounts();
  renderChannels();
  channelListEl.scrollTop = 0;
  showToast(`${sports.length} spor kanalı başa alındı.`, 'success');
});

presetNews.addEventListener('click', () => {
  const news = [], rest = [];
  allChannels.forEach(ch => {
    NEWS_KEYWORDS.some(k => ch.name.toUpperCase().includes(k)) ? news.push(ch) : rest.push(ch);
  });
  allChannels = [...news, ...rest];
  hasUnsavedChanges = true;
  updateCounts();
  renderChannels();
  channelListEl.scrollTop = 0;
  showToast(`${news.length} haber kanalı başa alındı.`, 'success');
});

presetReset.addEventListener('click', () => {
  if (!confirm('Tüm değişiklikler iptal edilip orijinal sıraya dönülsün mü?')) return;
  allChannels = JSON.parse(JSON.stringify(originalChannels));
  deletedChannels = [];
  selectedSlots.clear();
  hasUnsavedChanges = false;
  updateCounts();
  renderChannels();
  showToast('Orijinal sıraya dönüldü.', 'success');
});

searchInput.addEventListener('input', e => {
  searchQuery = e.target.value.trim();
  clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
  renderChannels();
});

clearSearchBtn.addEventListener('click', () => {
  searchInput.value = '';
  searchQuery = '';
  clearSearchBtn.style.display = 'none';
  renderChannels();
});

document.querySelectorAll('.filter-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    currentFilter = chip.dataset.filter;
    renderChannels();
  });
});

saveBtn.addEventListener('click', async () => {
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div> Kaydediliyor...';

  try {
    const payload = {
      channels: allChannels.map(ch => ({ orig_slot: ch.orig_slot, name: ch.name }))
    };

    const res = await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.status === 'ok') {
      hasUnsavedChanges = false;
      originalChannels = JSON.parse(JSON.stringify(allChannels));
      updateCounts();
      renderChannels();
      showToast('🎉 ' + data.message, 'success');
      statusMessage.textContent = 'Son Kayıt: ' + new Date().toLocaleTimeString('tr-TR');
    } else {
      showToast('Hata: ' + data.message, 'error');
    }
  } catch (err) {
    showToast('Sunucu hatası!', 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
      Değişiklikleri Kaydet
    `;
  }
});

// Brand Selection Handler
const BRAND_DOWNLOAD_NAMES = {
  bin: 'USB İçin İndir (.bin)',
  sdx: 'USB İçin İndir (.sdx)',
  m3u: 'M3U İndir (.m3u)',
  csv: 'CSV İndir (.csv)',
  json: 'JSON İndir (.json)'
};

const BRAND_TO_TAB = {
  bin: 'tab-elton',
  sdx: 'tab-vestel',
  m3u: 'tab-m3u',
  csv: 'tab-elton',
  json: 'tab-elton'
};

brandSelect.addEventListener('change', () => {
  const val = brandSelect.value;
  if (downloadBtnText) {
    downloadBtnText.textContent = BRAND_DOWNLOAD_NAMES[val] || 'İndir';
  }
  const tabId = BRAND_TO_TAB[val];
  if (tabId) {
    activateGuideTab(tabId);
  }
  showToast(`Hedef format: ${val.toUpperCase()} olarak seçildi`, 'success');
});

// Export Dropdown
exportMenuBtn.addEventListener('click', e => {
  e.stopPropagation();
  exportMenu.classList.toggle('show');
});

document.addEventListener('click', () => {
  exportMenu.classList.remove('show');
});

// Export trigger function with fallback
function downloadFormat(fmt) {
  if (window.location.protocol.startsWith('http') && !window.location.hostname.includes('github.io')) {
    window.location.href = `/api/export?format=${fmt}`;
    showToast(`${fmt.toUpperCase()} formatında dosya indiriliyor...`, 'success');
  } else {
    clientExportChannels(fmt);
  }
}

downloadBtn.addEventListener('click', () => {
  const fmt = brandSelect.value;
  downloadFormat(fmt);
});

document.querySelectorAll('.export-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    const href = item.getAttribute('href');
    const fmt = href.split('format=')[1] || 'bin';
    exportMenu.classList.remove('show');
    downloadFormat(fmt);
  });
});

// File Upload & Drag-and-Drop
uploadBtn.addEventListener('click', () => fileUploadInput.click());

fileUploadInput.addEventListener('change', e => {
  if (e.target.files && e.target.files[0]) {
    uploadFile(e.target.files[0]);
  }
});

async function uploadFile(file) {
  showToast(`${file.name} ayrıştırılıyor...`, 'info');
  const lower = file.name.toLowerCase();

  // Client-side reading for instant preview & offline support
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      let channels = [];
      if (lower.endsWith('.bin') || file.size >= 650) {
        rawTemplateBuffer = e.target.result;
        channels = parseBinaryChannels(rawTemplateBuffer);
      } else {
        const text = new TextDecoder('utf-8').decode(e.target.result);
        if (lower.endsWith('.sdx') || text.includes('SATCODX')) {
          text.split(/\r?\n/).forEach(line => {
            if (line.startsWith('CX')) {
              const parts = line.slice(2).trim().split(/\s+/);
              if (parts.length > 0) {
                const nameParts = parts.slice(1).filter(p => !/^\d{4,}/.test(p));
                const name = nameParts.join(' ') || parts[0];
                const slot = channels.length;
                channels.push({
                  slot, orig_slot: slot, orig_ch: slot + 1, orig_ord: slot,
                  name, is_hd: name.toUpperCase().includes('HD'), has_prefix: false
                });
              }
            }
          });
        } else if (lower.endsWith('.m3u') || lower.endsWith('.m3u8') || text.includes('#EXTINF')) {
          text.split(/\r?\n/).forEach(line => {
            if (line.startsWith('#EXTINF')) {
              const name = line.split(',')[1]?.trim() || 'Kanal';
              const slot = channels.length;
              channels.push({
                slot, orig_slot: slot, orig_ch: slot + 1, orig_ord: slot,
                name, is_hd: name.toUpperCase().includes('HD'), has_prefix: false
              });
            }
          });
        } else if (lower.endsWith('.json')) {
          const data = JSON.parse(text);
          const list = Array.isArray(data) ? data : (data.channels || []);
          list.forEach((item, i) => {
            channels.push({
              slot: i, orig_slot: item.orig_slot || i, orig_ch: item.orig_ch || (i + 1),
              orig_ord: item.orig_ord || i, name: item.name || `Kanal ${i + 1}`,
              is_hd: item.is_hd || (item.name || '').toUpperCase().includes('HD'), has_prefix: false
            });
          });
        } else if (lower.endsWith('.csv')) {
          text.split(/\r?\n/).forEach(line => {
            if (line && !line.startsWith('Sira') && !line.startsWith('#')) {
              const parts = line.split(';');
              const name = parts[1] || parts[0];
              if (name && name.trim()) {
                const slot = channels.length;
                channels.push({
                  slot, orig_slot: slot, orig_ch: slot + 1, orig_ord: slot,
                  name: name.trim(), is_hd: name.toUpperCase().includes('HD'), has_prefix: false
                });
              }
            }
          });
        }
      }

      if (channels && channels.length > 0) {
        allChannels = channels.map((ch, idx) => ({ ...ch, current_idx: idx }));
        originalChannels = JSON.parse(JSON.stringify(allChannels));
        deletedChannels = [];
        selectedSlots.clear();
        hasUnsavedChanges = false;
        updateCounts();
        renderChannels();
        statusMessage.textContent = `Yüklendi: ${file.name} (${allChannels.length} kanal)`;
        showToast(`🎉 ${file.name} yüklendi (${allChannels.length} kanal)!`, 'success');

        if (lower.endsWith('.sdx')) brandSelect.value = 'sdx';
        else if (lower.endsWith('.m3u') || lower.endsWith('.m3u8')) brandSelect.value = 'm3u';
        else if (lower.endsWith('.bin')) brandSelect.value = 'bin';
        else if (lower.endsWith('.csv')) brandSelect.value = 'csv';
        else if (lower.endsWith('.json')) brandSelect.value = 'json';
        brandSelect.dispatchEvent(new Event('change'));
      }
    } catch (err) {
      showToast('Dosya çözümlenemedi: ' + err.message, 'error');
    }
  };

  reader.readAsArrayBuffer(file);

  // Also sync with server if online
  if (window.location.protocol.startsWith('http') && !window.location.hostname.includes('github.io')) {
    const formData = new FormData();
    formData.append('file', file);
    try {
      fetch('/api/upload', { method: 'POST', body: formData });
    } catch (e) {}
  }
}

// Window Drag & Drop Overlay
let dragCounter = 0;
window.addEventListener('dragenter', e => {
  e.preventDefault();
  dragCounter++;
  if (dropzoneOverlay) dropzoneOverlay.classList.add('active');
});

window.addEventListener('dragleave', e => {
  e.preventDefault();
  dragCounter--;
  if (dragCounter <= 0) {
    dragCounter = 0;
    if (dropzoneOverlay) dropzoneOverlay.classList.remove('active');
  }
});

window.addEventListener('dragover', e => {
  e.preventDefault();
});

window.addEventListener('drop', e => {
  e.preventDefault();
  dragCounter = 0;
  if (dropzoneOverlay) dropzoneOverlay.classList.remove('active');
  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
    uploadFile(e.dataTransfer.files[0]);
  }
});

// Guide Modal & Tabs
function activateGuideTab(tabId) {
  document.querySelectorAll('.guide-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabId);
  });
  document.querySelectorAll('.guide-tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === tabId);
  });
}

document.querySelectorAll('.guide-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    activateGuideTab(tab.dataset.tab);
  });
});

guideBtn.addEventListener('click', () => {
  const currentBrand = brandSelect.value;
  const tabId = BRAND_TO_TAB[currentBrand] || 'tab-elton';
  activateGuideTab(tabId);
  guideModal.style.display = 'flex';
});

closeGuideModal.addEventListener('click', () => { guideModal.style.display = 'none'; });
guideUnderstandBtn.addEventListener('click', () => { guideModal.style.display = 'none'; });
guideModal.addEventListener('click', e => {
  if (e.target === guideModal) guideModal.style.display = 'none';
});

let toastTimeout;
function showToast(msg, type) {
  clearTimeout(toastTimeout);
  toastEl.textContent = msg;
  toastEl.className = `toast ${type || 'success'} show`;
  toastTimeout = setTimeout(() => toastEl.classList.remove('show'), 4500);
}

// Keyboard Shortcuts
window.addEventListener('keydown', e => {
  // Ctrl+S or Cmd+S -> Save
  if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
    e.preventDefault();
    if (saveBtn) saveBtn.click();
  }
  // Slash '/' -> Focus search (when not inside an input)
  if (e.key === '/' && document.activeElement !== searchInput && document.activeElement.tagName !== 'INPUT') {
    e.preventDefault();
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
  }
  // Escape -> Clear search or close modal
  if (e.key === 'Escape') {
    if (guideModal && guideModal.style.display !== 'none') {
      guideModal.style.display = 'none';
    } else if (searchInput && searchInput.value) {
      searchInput.value = '';
      searchQuery = '';
      clearSearchBtn.style.display = 'none';
      renderChannels();
      searchInput.blur();
    }
  }
});

loadChannels();
