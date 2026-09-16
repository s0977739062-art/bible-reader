let booksMeta = [];
let fullBibleData = [];
let parallelBibleData = {};
let currentBookIndex = 0;
let currentChapter = 1;

let highlights = JSON.parse(localStorage.getItem('bible_highlights') || '{}');
let bibleNotes = JSON.parse(localStorage.getItem('bible_notes') || '{}');

let selectedVerseEl = null;
let selectedVerseData = null;
let currentEditingKey = null;

// 卡片狀態管理器
let activeTemplate = 'parchment'; // parchment | forest | sky | cyber | midnight | dawn | olive | custom
let customBgImage = null;
let currentCardVerse = '';
let currentCardRef = '';

// DOM 元素
const bookSelector = document.getElementById('bookSelector');
const chapterSelector = document.getElementById('chapterSelector');
const displayBookTitle = document.getElementById('displayBookTitle');
const displayChapterEn = document.getElementById('displayChapterEn');
const scriptureContent = document.getElementById('scriptureContent');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const parallelLangSelector = document.getElementById('parallelLangSelector');

const directSearchInput = document.getElementById('directSearchInput');
const quickSearchResults = document.getElementById('quickSearchResults');
const verseToolbar = document.getElementById('verseToolbar');
const highlightBtn = document.getElementById('highlightBtn');
const noteBtn = document.getElementById('noteBtn');
const cardBtn = document.getElementById('cardBtn');
const toast = document.getElementById('toast');

// 筆記 Modal
const noteModal = document.getElementById('noteModal');
const noteBackdrop = document.getElementById('noteBackdrop');
const noteCloseBtn = document.getElementById('noteCloseBtn');
const noteVerseRef = document.getElementById('noteVerseRef');
const noteInput = document.getElementById('noteInput');
const saveNoteBtn = document.getElementById('saveNoteBtn');
const deleteNoteBtn = document.getElementById('deleteNoteBtn');

// 卡片 Modal
const cardModal = document.getElementById('cardModal');
const cardBackdrop = document.getElementById('cardBackdrop');
const cardCloseBtn = document.getElementById('cardCloseBtn');
const cardPreviewImg = document.getElementById('cardPreviewImg');
const downloadCardBtn = document.getElementById('downloadCardBtn');
const shareCardBtn = document.getElementById('shareCardBtn');
const cardCanvas = document.getElementById('cardCanvas');
const customBgInput = document.getElementById('customBgInput');

// 文字清理工具函式：移除「神」前面的全形/半形空白（傳統挪抬）及開頭結尾空白
function cleanVerseText(rawText) {
  if (!rawText) return '';
  return String(rawText)
    .replace(/[  \u3000\u00A0]神/g, '神')
    .trim();
}

// 1. 初始化
async function init() {
  try {
    scriptureContent.innerHTML = '<p style="text-align:center; color: var(--text-muted); padding: 40px 0;">正在載入經文庫...</p>';

    const [booksRes, bibleRes, idRes, enRes, viRes] = await Promise.all([
      fetch('./data/books.json'),
      fetch('./data/cuv.json'),
      fetch('./data/id_tb.json'),
      fetch('./data/en_kjv.json'),
      fetch('./data/vi_1925.json')
    ]);

    booksMeta = await booksRes.json();
    const rawBible = await bibleRes.json();
    fullBibleData = Array.isArray(rawBible) ? rawBible : (rawBible.verses || Object.values(rawBible).flat());
    parallelBibleData = {
      id: await idRes.json(),
      en: await enRes.json(),
      vi: await viRes.json()
    };

    setupBookSelector();
    parallelLangSelector.addEventListener('change', () => loadChapter(currentBookIndex, currentChapter));
    setupDirectSearch();
    setupVerseActions();
    setupNoteModule();
    setupCardModule();
    setupTheme();
    loadChapter(0, 1);
  } catch (err) {
    console.error('載入失敗：', err);
    scriptureContent.innerHTML = '<p style="text-align: center; color: var(--accent);">經文載入失敗，請確認檔案路徑。</p>';
  }
}

// 2. 書卷下拉選單
function setupBookSelector() {
  bookSelector.innerHTML = '';
  const otGroup = document.createElement('optgroup');
  otGroup.label = '—— 舊約全書 ——';
  const ntGroup = document.createElement('optgroup');
  ntGroup.label = '—— 新約全書 ——';

  booksMeta.forEach((b, index) => {
    const opt = document.createElement('option');
    opt.value = index;
    opt.textContent = b.name;
    if (b.testament === 'OT') otGroup.appendChild(opt);
    else ntGroup.appendChild(opt);
  });

  bookSelector.appendChild(otGroup);
  bookSelector.appendChild(ntGroup);

  bookSelector.addEventListener('change', (e) => loadChapter(Number(e.target.value), 1));
  chapterSelector.addEventListener('change', (e) => loadChapter(currentBookIndex, Number(e.target.value)));
}

function updateChapterSelector(totalChapters, selectedChapter) {
  chapterSelector.innerHTML = '';
  for (let i = 1; i <= totalChapters; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `第 ${i} 章`;
    if (i === selectedChapter) opt.selected = true;
    chapterSelector.appendChild(opt);
  }
}

// 3. 讀取並渲染章節經文
function loadChapter(bookIdx, chapNum) {
  currentBookIndex = bookIdx;
  currentChapter = chapNum;
  hideToolbar();

  const currentBook = booksMeta[currentBookIndex];
  bookSelector.value = currentBookIndex;
  updateChapterSelector(currentBook.chapters, currentChapter);

  displayBookTitle.textContent = `${currentBook.name} 第 ${currentChapter} 章`;
  displayChapterEn.textContent = `${currentBook.nameEn} · Chapter ${currentChapter}`;

  const targetId = currentBook.id.toLowerCase();
  const selectedLanguage = parallelLangSelector.value;
  const selectedTranslation = parallelBibleData[selectedLanguage] || [];
  document.body.classList.toggle('parallel-mode', selectedLanguage !== 'none');
  const chapterVerses = fullBibleData.filter(item => {
    if (!item) return false;
    const b = String(item.book || '').toLowerCase();
    const chap = Number(item.chapter_num || item.chapter || 0);
    return (b === targetId || b.startsWith(targetId.slice(0, 3))) && chap === currentChapter;
  });

  if (chapterVerses.length > 0) {
    scriptureContent.innerHTML = chapterVerses.map(v => {
      const verseNum = v.verse_num || v.verse || '';
      const text = cleanVerseText(v.verse || v.text || '');
      const verseKey = `${currentBook.id}_${currentChapter}_${verseNum}`;
      const parallelVerse = selectedTranslation.find(item => {
        const itemBook = String(item.book || '').toLowerCase();
        const itemChapter = Number(item.chapter_num || item.chapter || 0);
        const itemVerse = Number(item.verse_num || item.verse || 0);
        return (itemBook === targetId || itemBook.startsWith(targetId.slice(0, 3))) &&
          itemChapter === currentChapter && itemVerse === Number(verseNum);
      });
      const parallelText = parallelVerse ? cleanVerseText(parallelVerse.text || parallelVerse.verse || '') : '';
      const isHigh = highlights[verseKey] ? 'highlighted' : '';
      const noteText = bibleNotes[verseKey] || '';

      return `
        <div class="verse-wrapper" data-key="${verseKey}">
          <p class="verse ${isHigh}" data-book="${currentBook.name}" data-book-id="${currentBook.id}" data-chapter="${currentChapter}" data-verse="${verseNum}" data-text="${escapeHtml(text)}">
            <span class="verse-num">${verseNum}</span>
            <span class="verse-text">${text}</span>
            ${parallelText ? `<span class="verse-text-foreign" lang="${selectedLanguage}">${escapeHtml(parallelText)}</span>` : ''}
          </p>
          ${noteText ? `<div class="verse-note-badge" data-key="${verseKey}" data-ref="${currentBook.name} ${currentChapter}:${verseNum}">${escapeHtml(noteText)}</div>` : ''}
        </div>
      `;
    }).join('');
  } else {
    scriptureContent.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 40px 0;"><p>此章節暫無經文。</p></div>';
  }

  prevBtn.disabled = (currentBookIndex === 0 && currentChapter === 1);
  nextBtn.disabled = (currentBookIndex === booksMeta.length - 1 && currentChapter === currentBook.chapters);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 4. 經文操作浮動選單
function setupVerseActions() {
  scriptureContent.addEventListener('click', (e) => {
    const noteBadge = e.target.closest('.verse-note-badge');
    if (noteBadge) {
      currentEditingKey = noteBadge.dataset.key;
      openNoteModal(currentEditingKey, noteBadge.dataset.ref || '經文筆記');
      return;
    }

    const verseEl = e.target.closest('.verse');
    if (!verseEl) {
      hideToolbar();
      return;
    }

    selectedVerseEl = verseEl;
    selectedVerseData = {
      book: verseEl.dataset.book,
      bookId: verseEl.dataset.bookId,
      chapter: verseEl.dataset.chapter,
      verse: verseEl.dataset.verse,
      text: verseEl.dataset.text
    };

    const rect = verseEl.getBoundingClientRect();
    verseToolbar.style.top = `${rect.top + window.scrollY - 8}px`;
    verseToolbar.style.left = `${rect.left + rect.width / 2}px`;

    const key = `${selectedVerseData.bookId}_${selectedVerseData.chapter}_${selectedVerseData.verse}`;
    highlightBtn.textContent = highlights[key] ? '✖ 取消劃線' : '🖍️ 劃線';
    noteBtn.textContent = bibleNotes[key] ? '📝 編輯筆記' : '📝 筆記';

    verseToolbar.classList.remove('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.verse') && 
        !e.target.closest('.verse-toolbar') && 
        !e.target.closest('.verse-note-badge') &&
        !e.target.closest('.note-modal-content')) {
      hideToolbar();
    }
  });

  highlightBtn.addEventListener('click', () => {
    if (!selectedVerseData) return;
    const key = `${selectedVerseData.bookId}_${selectedVerseData.chapter}_${selectedVerseData.verse}`;
    if (highlights[key]) {
      delete highlights[key];
      selectedVerseEl.classList.remove('highlighted');
      showToast('已取消劃線');
    } else {
      highlights[key] = true;
      selectedVerseEl.classList.add('highlighted');
      showToast('已儲存劃線！');
    }
    localStorage.setItem('bible_highlights', JSON.stringify(highlights));
    hideToolbar();
  });

  noteBtn.addEventListener('click', () => {
    if (!selectedVerseData) return;
    currentEditingKey = `${selectedVerseData.bookId}_${selectedVerseData.chapter}_${selectedVerseData.verse}`;
    openNoteModal(currentEditingKey, `${selectedVerseData.book} ${selectedVerseData.chapter}:${selectedVerseData.verse}`);
    hideToolbar();
  });

  cardBtn.addEventListener('click', () => {
    if (!selectedVerseData) return;
    currentCardVerse = selectedVerseData.text;
    currentCardRef = `${selectedVerseData.book} ${selectedVerseData.chapter}:${selectedVerseData.verse}`;
    renderCard();
    cardModal.classList.remove('hidden');
    hideToolbar();
  });
}

function openNoteModal(key, title) {
  noteVerseRef.textContent = `筆記 · ${title}`;
  noteInput.value = bibleNotes[key] || '';
  noteModal.classList.remove('hidden');
  setTimeout(() => noteInput.focus(), 50);
}

function hideToolbar() {
  verseToolbar.classList.add('hidden');
  selectedVerseEl = null;
  selectedVerseData = null;
}

// 5. 筆記模組核心
function setupNoteModule() {
  const closeNote = () => {
    noteModal.classList.add('hidden');
    noteInput.value = '';
    currentEditingKey = null;
  };

  noteCloseBtn.addEventListener('click', closeNote);
  noteBackdrop.addEventListener('click', closeNote);

  saveNoteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!currentEditingKey) return;
    const text = noteInput.value.trim();
    if (text) {
      bibleNotes[currentEditingKey] = text;
      showToast('筆記已儲存！');
    } else {
      delete bibleNotes[currentEditingKey];
      showToast('筆記已清空');
    }
    localStorage.setItem('bible_notes', JSON.stringify(bibleNotes));
    closeNote();
    loadChapter(currentBookIndex, currentChapter);
  });

  deleteNoteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!currentEditingKey) return;
    delete bibleNotes[currentEditingKey];
    localStorage.setItem('bible_notes', JSON.stringify(bibleNotes));
    showToast('筆記已刪除');
    closeNote();
    loadChapter(currentBookIndex, currentChapter);
  });
}

// 6. 卡片生成與多風格渲染模組（雙軌分享機制）
function setupCardModule() {
  const closeCard = () => {
    cardModal.classList.add('hidden');
  };

  cardCloseBtn.addEventListener('click', closeCard);
  cardBackdrop.addEventListener('click', closeCard);

  document.querySelectorAll('.tpl-chip[data-template]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tpl-chip').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      activeTemplate = btn.dataset.template;
      customBgImage = null;
      renderCard();
    });
  });

  customBgInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        customBgImage = img;
        activeTemplate = 'custom';
        document.querySelectorAll('.tpl-chip').forEach(c => c.classList.remove('active'));
        document.querySelector('.upload-chip').classList.add('active');
        renderCard();
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  });

  downloadCardBtn.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = `經文卡_${Date.now()}.png`;
    link.href = cardCanvas.toDataURL('image/png');
    link.click();
    showToast('圖片已下載！');
  });

  shareCardBtn.addEventListener('click', async () => {
    try {
      cardCanvas.toBlob(async (blob) => {
        if (!blob) {
          showToast('製圖失敗，請重試');
          return;
        }

        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        const file = new File([blob], `經文卡_${Date.now()}.png`, { type: 'image/png' });

        if (isMobile && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              title: '聖經金句',
              text: `「${currentCardVerse}」—— ${currentCardRef}`,
              files: [file]
            });
            showToast('已開啟分享！');
            return;
          } catch (shareErr) {
            if (shareErr.name === 'AbortError') return;
          }
        }

        if (navigator.clipboard && window.ClipboardItem) {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            showToast('✅ 卡片已複製！請直接至 LINE 按 Ctrl + V 貼上');
            return;
          } catch (clipErr) {
            console.warn('剪貼簿寫入失敗，改為直接下載：', clipErr);
          }
        }

        const link = document.createElement('a');
        link.download = `經文卡_${Date.now()}.png`;
        link.href = cardCanvas.toDataURL('image/png');
        link.click();

        const shareQuote = `「${currentCardVerse}」——《聖經》${currentCardRef}`;
        navigator.clipboard.writeText(shareQuote);
        showToast('已為您下載圖片，可直接拖曳至 LINE 群組！');
      }, 'image/png');
    } catch (err) {
      console.error('操作異常：', err);
      showToast('請改用「存為圖片」發送');
    }
  });
}

// 核心 Canvas 繪圖演算法
function renderCard() {
  const width = 1080;
  const height = 1350;
  cardCanvas.width = width;
  cardCanvas.height = height;
  const ctx = cardCanvas.getContext('2d');

  let style = {
    fontFamily: '"Noto Serif TC", serif',
    techFont: false,
    textColor: '#242220',
    refColor: '#8E5A36',
    crossColor: '#9E5B32',
    subColor: '#9E5B32',
    dividerColor: '#D4AF87',
    textShadow: false
  };

  if (activeTemplate === 'parchment') {
    ctx.fillStyle = '#FAF6EE';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#D4AF87';
    ctx.lineWidth = 4;
    ctx.strokeRect(50, 50, width - 100, height - 100);

    ctx.strokeStyle = '#E8D7C0';
    ctx.lineWidth = 2;
    ctx.strokeRect(66, 66, width - 132, height - 132);

    style.textColor = '#242220';
    style.refColor = '#8E5A36';
    style.crossColor = '#9E5B32';
    style.subColor = '#9E5B32';
    style.dividerColor = '#D4AF87';

  } else if (activeTemplate === 'forest') {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#132A13');
    grad.addColorStop(0.5, '#1E431E');
    grad.addColorStop(1, '#081C08');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    const radial = ctx.createRadialGradient(width / 2, 220, 20, width / 2, 220, 480);
    radial.addColorStop(0, 'rgba(216, 243, 220, 0.22)');
    radial.addColorStop(1, 'rgba(216, 243, 220, 0)');
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(183, 228, 199, 0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(60, 60, width - 120, height - 120);

    style.textColor = '#F3F9F4';
    style.refColor = '#B7E4C7';
    style.crossColor = '#B7E4C7';
    style.subColor = 'rgba(183, 228, 199, 0.8)';
    style.dividerColor = 'rgba(183, 228, 199, 0.45)';
    style.textShadow = true;

  } else if (activeTemplate === 'sky') {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#3A7BD5');
    grad.addColorStop(1, '#00D2FF');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(60, 60, width - 120, height - 120);

    style.textColor = '#FFFFFF';
    style.refColor = '#FFFFFF';
    style.crossColor = '#FFFFFF';
    style.subColor = 'rgba(255, 255, 255, 0.85)';
    style.dividerColor = 'rgba(255, 255, 255, 0.6)';
    style.textShadow = true;

  } else if (activeTemplate === 'cyber') {
    ctx.fillStyle = '#0B0D13';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(0, 240, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y < height; y += 60) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    ctx.strokeStyle = '#00F0FF';
    ctx.lineWidth = 3;
    const cornerSize = 40;
    const pad = 50;

    ctx.beginPath(); ctx.moveTo(pad, pad + cornerSize); ctx.lineTo(pad, pad); ctx.lineTo(pad + cornerSize, pad); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(width - pad - cornerSize, pad); ctx.lineTo(width - pad, pad); ctx.lineTo(width - pad, pad + cornerSize); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pad, height - pad - cornerSize); ctx.lineTo(pad, height - pad); ctx.lineTo(pad + cornerSize, height - pad); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(width - pad - cornerSize, height - pad); ctx.lineTo(width - pad, height - pad); ctx.lineTo(width - pad, height - pad - cornerSize); ctx.stroke();

    ctx.font = '14px "Share Tech Mono", monospace';
    ctx.fillStyle = '#00F0FF';
    ctx.fillText('SYS.SEC // VERSE_DATA', 90, 80);
    ctx.fillText('STATUS: ETERNAL', width - 180, 80);

    style.techFont = true;
    style.textColor = '#F0F6FC';
    style.refColor = '#00F0FF';
    style.crossColor = '#00F0FF';
    style.subColor = '#58A6FF';
    style.dividerColor = '#00F0FF';
    style.textShadow = true;

  } else if (activeTemplate === 'midnight') {
    ctx.fillStyle = '#141416';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 4;
    ctx.strokeRect(50, 50, width - 100, height - 100);

    ctx.strokeStyle = '#333338';
    ctx.lineWidth = 2;
    ctx.strokeRect(66, 66, width - 132, height - 132);

    style.textColor = '#F5F5F7';
    style.refColor = '#D4AF37';
    style.crossColor = '#D4AF37';
    style.subColor = '#8E8E93';
    style.dividerColor = '#D4AF37';

  } else if (activeTemplate === 'dawn') {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#F6D365');
    grad.addColorStop(1, '#FDA085');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    style.textColor = '#FFFFFF';
    style.refColor = '#FFFFFF';
    style.crossColor = '#FFFFFF';
    style.subColor = 'rgba(255,255,255,0.85)';
    style.dividerColor = 'rgba(255,255,255,0.6)';
    style.textShadow = true;

  } else if (activeTemplate === 'olive') {
    ctx.fillStyle = '#283618';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#DDA15E';
    ctx.lineWidth = 4;
    ctx.strokeRect(50, 50, width - 100, height - 100);

    style.textColor = '#FEFAE0';
    style.refColor = '#DDA15E';
    style.crossColor = '#DDA15E';
    style.subColor = '#BC6C25';
    style.dividerColor = '#DDA15E';

  } else if (activeTemplate === 'custom' && customBgImage) {
    const scale = Math.max(width / customBgImage.width, height / customBgImage.height);
    const x = (width - customBgImage.width * scale) / 2;
    const y = (height - customBgImage.height * scale) / 2;
    ctx.drawImage(customBgImage, x, y, customBgImage.width * scale, customBgImage.height * scale);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(60, 60, width - 120, height - 120);

    style.textColor = '#FFFFFF';
    style.refColor = '#FFFFFF';
    style.crossColor = '#FFFFFF';
    style.subColor = 'rgba(255,255,255,0.85)';
    style.dividerColor = 'rgba(255,255,255,0.7)';
    style.textShadow = true;
  }

  if (style.textShadow) {
    ctx.shadowColor = activeTemplate === 'cyber' ? '#00F0FF' : 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = activeTemplate === 'cyber' ? 14 : 10;
  } else {
    ctx.shadowBlur = 0;
  }

  // 2. 頂部徽飾
  ctx.fillStyle = style.crossColor;
  ctx.font = '36px "Noto Serif TC", serif';
  ctx.textAlign = 'center';
  ctx.fillText(activeTemplate === 'cyber' ? '❖' : '✝', width / 2, 170);

  ctx.font = style.techFont ? '20px "Share Tech Mono", monospace' : '22px "EB Garamond", serif';
  ctx.fillStyle = style.subColor;
  ctx.fillText(activeTemplate === 'cyber' ? '< HOLY_SCRIPTURE />' : 'H O L Y   B I B L E', width / 2, 220);

  // 3. 經文文字自動折行排版（使用已過濾空白的文字）
  ctx.fillStyle = style.textColor;
  ctx.font = '48px "Noto Serif TC", serif';
  ctx.textAlign = 'center';

  const maxLineWidth = width - 260;
  const lineHeight = 86;
  const words = cleanVerseText(currentCardVerse).split('');
  let lines = [];
  let currentLine = '';

  for (let i = 0; i < words.length; i++) {
    const testLine = currentLine + words[i];
    if (ctx.measureText(testLine).width > maxLineWidth && i > 0) {
      lines.push(currentLine);
      currentLine = words[i];
    } else {
      currentLine = testLine;
    }
  }
  lines.push(currentLine);

  const textTotalHeight = lines.length * lineHeight;
  const startY = (height / 2) - (textTotalHeight / 2) + 20;

  for (let j = 0; j < lines.length; j++) {
    ctx.fillText(lines[j], width / 2, startY + (j * lineHeight));
  }

  // 4. 底部出處與分割線
  const refY = startY + textTotalHeight + 60;
  ctx.shadowBlur = 0;
  ctx.strokeStyle = style.dividerColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 80, refY);
  ctx.lineTo(width / 2 + 80, refY);
  ctx.stroke();

  if (style.textShadow) {
    ctx.shadowColor = activeTemplate === 'cyber' ? '#00F0FF' : 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = activeTemplate === 'cyber' ? 12 : 10;
  }
  ctx.fillStyle = style.refColor;
  ctx.font = 'bold 32px "Noto Serif TC", serif';
  ctx.fillText(currentCardRef, width / 2, refY + 60);

  cardPreviewImg.src = cardCanvas.toDataURL('image/png');
}

// 7. 全能檢索（書卷連打直達 + 全文搜尋）
function setupDirectSearch() {
  let timer = null;

  directSearchInput.addEventListener('input', (e) => {
    clearTimeout(timer);
    const rawInput = e.target.value.trim();
    if (!rawInput) {
      quickSearchResults.classList.add('hidden');
      return;
    }

    timer = setTimeout(() => {
      const lowerInput = rawInput.toLowerCase();
      let navOptions = [];

      const smartMatch = rawInput.match(/^([^\d\s:：]+)\s*(\d+)?(?:\s*[:：]\s*(\d+))?/i);

      if (smartMatch) {
        const bookKeyword = smartMatch[1].toLowerCase().trim();
        const targetChap = smartMatch[2] ? parseInt(smartMatch[2], 10) : 1;
        const targetVerse = smartMatch[3] ? parseInt(smartMatch[3], 10) : null;

        const matchedBooks = booksMeta
          .map((b, idx) => ({ ...b, originalIndex: idx }))
          .filter(b => 
            b.name.includes(bookKeyword) || 
            b.id.toLowerCase().startsWith(bookKeyword) ||
            b.nameEn.toLowerCase().startsWith(bookKeyword)
          );

        if (matchedBooks.length > 0) {
          matchedBooks.slice(0, 3).forEach(b => {
            const chap = (!isNaN(targetChap) && targetChap <= b.chapters && targetChap > 0) ? targetChap : 1;
            const verseSuffix = targetVerse ? `:${targetVerse}` : '';
            navOptions.push({
              type: 'navigate',
              bookIdx: b.originalIndex,
              chapter: chap,
              title: `📖 直達《${b.name}》第 ${chap} 章${verseSuffix ? ` · 第 ${targetVerse} 節` : ''}`,
              sub: `${b.nameEn} · 全書共 ${b.chapters} 章`
            });
          });
        }
      }

      const verseMatches = [];
      for (let i = 0; i < fullBibleData.length; i++) {
        const item = fullBibleData[i];
        if (!item) continue;
        const cleanText = cleanVerseText(item.verse || item.text || '');
        if (cleanText.toLowerCase().includes(lowerInput)) {
          verseMatches.push({ ...item, cleanedVerseText: cleanText });
          if (verseMatches.length >= 20) break;
        }
      }

      if (navOptions.length === 0 && verseMatches.length === 0) {
        quickSearchResults.innerHTML = '<div style="padding:12px; color:var(--text-muted); font-size:0.85rem; text-align:center;">查無相關書卷或經文</div>';
      } else {
        let html = '';

        if (navOptions.length > 0) {
          html += navOptions.map(opt => `
            <div class="quick-search-item nav-direct-item" data-type="nav" data-book-idx="${opt.bookIdx}" data-chap="${opt.chapter}">
              <div class="qs-title" style="color: #2E7D32; font-weight: bold;">${opt.title}</div>
              <div class="qs-text" style="color: var(--text-muted);">${opt.sub}</div>
            </div>
          `).join('');
        }

        if (verseMatches.length > 0) {
          html += verseMatches.map(item => {
            const itemBookStr = String(item.book || '').toLowerCase().trim();
            const chapNum = item.chapter_num || item.chapter || 1;
            const verseNum = item.verse_num || item.verse || 1;
            const text = item.cleanedVerseText;

            const bookObj = booksMeta.find(b => 
              b.id.toLowerCase() === itemBookStr || 
              b.id.toLowerCase().startsWith(itemBookStr.slice(0, 3)) ||
              b.name.toLowerCase() === itemBookStr
            ) || { name: item.book || '經文' };

            const highlightedText = text.replaceAll(rawInput, `<mark style="background-color: var(--highlight-bg); color: inherit; border-radius: 2px; padding: 0 2px;">${rawInput}</mark>`);

            return `
              <div class="quick-search-item" data-type="verse" data-book="${item.book}" data-chap="${chapNum}">
                <div class="qs-title">${bookObj.name} ${chapNum}:${verseNum}</div>
                <div class="qs-text">${highlightedText}</div>
              </div>
            `;
          }).join('');
        }

        quickSearchResults.innerHTML = html;

        quickSearchResults.querySelectorAll('.quick-search-item').forEach(el => {
          el.addEventListener('click', () => {
            if (el.dataset.type === 'nav') {
              loadChapter(Number(el.dataset.bookIdx), Number(el.dataset.chap));
            } else {
              const rawBook = String(el.dataset.book || '').toLowerCase().trim();
              const chap = Number(el.dataset.chap);
              const bIdx = booksMeta.findIndex(b => 
                b.id.toLowerCase() === rawBook || 
                b.id.toLowerCase().startsWith(rawBook.slice(0, 3)) ||
                b.name.toLowerCase() === rawBook
              );
              if (bIdx !== -1) loadChapter(bIdx, chap);
            }
            quickSearchResults.classList.add('hidden');
            directSearchInput.value = '';
          });
        });
      }
      quickSearchResults.classList.remove('hidden');
    }, 150);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-bar-container')) {
      quickSearchResults.classList.add('hidden');
    }
  });
}

// 8. 工具函式
function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[m]));
}

function setupTheme() {
  themeToggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');
  });
}

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 2400);
}

// 9. 翻頁
prevBtn.addEventListener('click', () => {
  if (currentChapter > 1) {
    loadChapter(currentBookIndex, currentChapter - 1);
  } else if (currentBookIndex > 0) {
    loadChapter(currentBookIndex - 1, booksMeta[currentBookIndex - 1].chapters);
  }
});

nextBtn.addEventListener('click', () => {
  if (currentChapter < booksMeta[currentBookIndex].chapters) {
    loadChapter(currentBookIndex, currentChapter + 1);
  } else if (currentBookIndex < booksMeta.length - 1) {
    loadChapter(currentBookIndex + 1, 1);
  }
});

init();
