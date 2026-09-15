let booksMeta = [];
let fullBibleData = [];
let currentBookIndex = 0;
let currentChapter = 1;

// 本地存儲：劃線與筆記
let highlights = JSON.parse(localStorage.getItem('bible_highlights') || '{}');
let bibleNotes = JSON.parse(localStorage.getItem('bible_notes') || '{}');

let selectedVerseEl = null;
let selectedVerseData = null;

// DOM 元素
const bookSelector = document.getElementById('bookSelector');
const chapterSelector = document.getElementById('chapterSelector');
const displayBookTitle = document.getElementById('displayBookTitle');
const displayChapterEn = document.getElementById('displayChapterEn');
const scriptureContent = document.getElementById('scriptureContent');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const themeToggleBtn = document.getElementById('themeToggleBtn');

const directSearchInput = document.getElementById('directSearchInput');
const quickSearchResults = document.getElementById('quickSearchResults');
const verseToolbar = document.getElementById('verseToolbar');
const highlightBtn = document.getElementById('highlightBtn');
const noteBtn = document.getElementById('noteBtn');
const copyVerseBtn = document.getElementById('copyVerseBtn');
const toast = document.getElementById('toast');

// 筆記 Modal DOM
const noteModal = document.getElementById('noteModal');
const noteBackdrop = document.getElementById('noteBackdrop');
const noteCloseBtn = document.getElementById('noteCloseBtn');
const noteVerseRef = document.getElementById('noteVerseRef');
const noteInput = document.getElementById('noteInput');
const saveNoteBtn = document.getElementById('saveNoteBtn');
const deleteNoteBtn = document.getElementById('deleteNoteBtn');

// 1. 初始化
async function init() {
  try {
    scriptureContent.innerHTML = '<p style="text-align:center; color: var(--text-muted); padding: 40px 0;">正在載入經文庫...</p>';

    const [booksRes, bibleRes] = await Promise.all([
      fetch('./data/books.json'),
      fetch('./data/cuv.json')
    ]);

    booksMeta = await booksRes.json();
    const rawBible = await bibleRes.json();
    fullBibleData = Array.isArray(rawBible) ? rawBible : (rawBible.verses || Object.values(rawBible).flat());

    setupBookSelector();
    setupDirectSearch();
    setupVerseActions();
    setupNoteModule();
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

// 3. 讀取並渲染章節經文（包含筆記便籤）
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
  const chapterVerses = fullBibleData.filter(item => {
    if (!item) return false;
    const b = String(item.book || '').toLowerCase();
    const chap = Number(item.chapter_num || item.chapter || 0);
    return (b === targetId || b.startsWith(targetId.slice(0, 3))) && chap === currentChapter;
  });

  if (chapterVerses.length > 0) {
    scriptureContent.innerHTML = chapterVerses.map(v => {
      const verseNum = v.verse_num || v.verse || '';
      const text = v.verse || v.text || '';
      const verseKey = `${currentBook.id}_${currentChapter}_${verseNum}`;
      const isHigh = highlights[verseKey] ? 'highlighted' : '';
      const noteText = bibleNotes[verseKey] || '';

      return `
        <div class="verse-wrapper" data-key="${verseKey}">
          <p class="verse ${isHigh}" data-book="${currentBook.name}" data-book-id="${currentBook.id}" data-chapter="${currentChapter}" data-verse="${verseNum}" data-text="${text}">
            <sup class="verse-num">${verseNum}</sup>${text}
          </p>
          ${noteText ? `<div class="verse-note-badge" data-key="${verseKey}">${escapeHtml(noteText)}</div>` : ''}
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

// 4. 經文操作（點選劃線 / 複製 / 呼叫筆記）
function setupVerseActions() {
  scriptureContent.addEventListener('click', (e) => {
    // 若點到現有筆記標籤，直接開啟編輯
    const noteBadge = e.target.closest('.verse-note-badge');
    if (noteBadge) {
      const verseEl = noteBadge.previousElementSibling;
      openNoteModalForVerse(verseEl);
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
    if (!e.target.closest('.verse') && !e.target.closest('.verse-toolbar') && !e.target.closest('.verse-note-badge')) {
      hideToolbar();
    }
  });

  // 劃線開關
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

  // 複製經文出處
  copyVerseBtn.addEventListener('click', () => {
    if (!selectedVerseData) return;
    const shareQuote = `「${selectedVerseData.text}」——《聖經》${selectedVerseData.book} ${selectedVerseData.chapter}:${selectedVerseData.verse}`;
    navigator.clipboard.writeText(shareQuote).then(() => {
      showToast('已複製金句至剪貼簿！');
      hideToolbar();
    });
  });

  // 點擊 Toolbar 筆記按鈕
  noteBtn.addEventListener('click', () => {
    if (!selectedVerseEl) return;
    openNoteModalForVerse(selectedVerseEl);
    hideToolbar();
  });
}

function hideToolbar() {
  verseToolbar.classList.add('hidden');
  selectedVerseEl = null;
  selectedVerseData = null;
}

// 5. 筆記模組核心邏輯
function setupNoteModule() {
  const closeNote = () => {
    noteModal.classList.add('hidden');
    noteInput.value = '';
  };

  noteCloseBtn.addEventListener('click', closeNote);
  noteBackdrop.addEventListener('click', closeNote);

  // 儲存筆記
  saveNoteBtn.addEventListener('click', () => {
    if (!selectedVerseData) return;
    const key = `${selectedVerseData.bookId}_${selectedVerseData.chapter}_${selectedVerseData.verse}`;
    const text = noteInput.value.trim();

    if (text) {
      bibleNotes[key] = text;
      showToast('筆記已儲存！');
    } else {
      delete bibleNotes[key];
      showToast('筆記已清空');
    }

    localStorage.setItem('bible_notes', JSON.stringify(bibleNotes));
    closeNote();
    loadChapter(currentBookIndex, currentChapter); // 重新渲染當前章節
  });

  // 刪除筆記
  deleteNoteBtn.addEventListener('click', () => {
    if (!selectedVerseData) return;
    const key = `${selectedVerseData.bookId}_${selectedVerseData.chapter}_${selectedVerseData.verse}`;
    delete bibleNotes[key];
    localStorage.setItem('bible_notes', JSON.stringify(bibleNotes));
    showToast('筆記已刪除');
    closeNote();
    loadChapter(currentBookIndex, currentChapter);
  });
}

function openNoteModalForVerse(verseEl) {
  selectedVerseEl = verseEl;
  selectedVerseData = {
    book: verseEl.dataset.book,
    bookId: verseEl.dataset.bookId,
    chapter: verseEl.dataset.chapter,
    verse: verseEl.dataset.verse,
    text: verseEl.dataset.text
  };

  const key = `${selectedVerseData.bookId}_${selectedVerseData.chapter}_${selectedVerseData.verse}`;
  noteVerseRef.textContent = `筆記 · ${selectedVerseData.book} ${selectedVerseData.chapter}:${selectedVerseData.verse}`;
  noteInput.value = bibleNotes[key] || '';
  noteModal.classList.remove('hidden');
  noteInput.focus();
}

// 6. 搜尋模組
function setupDirectSearch() {
  let timer = null;

  directSearchInput.addEventListener('input', (e) => {
    clearTimeout(timer);
    const kw = e.target.value.trim();
    if (!kw) {
      quickSearchResults.classList.add('hidden');
      return;
    }

    timer = setTimeout(() => {
      const matches = [];
      const lowerKw = kw.toLowerCase();

      for (let i = 0; i < fullBibleData.length; i++) {
        const item = fullBibleData[i];
        if (!item) continue;
        const text = String(item.verse || item.text || '');
        if (text.toLowerCase().includes(lowerKw)) {
          matches.push(item);
          if (matches.length >= 25) break;
        }
      }

      if (matches.length === 0) {
        quickSearchResults.innerHTML = '<div style="padding:12px; color:var(--text-muted); font-size:0.85rem; text-align:center;">查無相關經文</div>';
      } else {
        quickSearchResults.innerHTML = matches.map(item => {
          const itemBookStr = String(item.book || '').toLowerCase().trim();
          const chapNum = item.chapter_num || item.chapter || 1;
          const verseNum = item.verse_num || item.verse || 1;
          const text = item.verse || item.text || '';

          const bookObj = booksMeta.find(b => 
            b.id.toLowerCase() === itemBookStr || 
            b.id.toLowerCase().startsWith(itemBookStr.slice(0, 3)) ||
            b.name.toLowerCase() === itemBookStr
          ) || { name: item.book || '經文' };

          const highlightedText = text.replaceAll(kw, `<mark style="background-color: var(--highlight-bg); color: inherit; border-radius: 2px; padding: 0 2px;">${kw}</mark>`);

          return `
            <div class="quick-search-item" data-book="${item.book}" data-chap="${chapNum}">
              <div class="qs-title">${bookObj.name} ${chapNum}:${verseNum}</div>
              <div class="qs-text">${highlightedText}</div>
            </div>
          `;
        }).join('');

        quickSearchResults.querySelectorAll('.quick-search-item').forEach(el => {
          el.addEventListener('click', () => {
            const rawBook = String(el.dataset.book || '').toLowerCase().trim();
            const chap = Number(el.dataset.chap);

            const bIdx = booksMeta.findIndex(b => 
              b.id.toLowerCase() === rawBook || 
              b.id.toLowerCase().startsWith(rawBook.slice(0, 3)) ||
              b.name.toLowerCase() === rawBook
            );

            if (bIdx !== -1) {
              quickSearchResults.classList.add('hidden');
              directSearchInput.value = '';
              loadChapter(bIdx, chap);
            }
          });
        });
      }
      quickSearchResults.classList.remove('hidden');
    }, 200);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-bar-container')) {
      quickSearchResults.classList.add('hidden');
    }
  });
}

// 7. 工具函式
function escapeHtml(text) {
  return text.replace(/[&<>"']/g, m => ({
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
  setTimeout(() => toast.classList.add('hidden'), 2200);
}

// 8. 翻頁
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