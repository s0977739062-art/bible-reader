let bibleData = [];
let currentIndex = 0;

// DOM 節點
const bookSelector = document.getElementById('bookSelector');
const chapterSelector = document.getElementById('chapterSelector');
const displayBookTitle = document.getElementById('displayBookTitle');
const displayChapterEn = document.getElementById('displayChapterEn');
const scriptureContent = document.getElementById('scriptureContent');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');

// 1. 初始化載入資料
async function init() {
  try {
    const res = await fetch('./data/sample.json');
    bibleData = await res.json();
    setupDropdowns();
    renderChapter(0);
  } catch (error) {
    console.error("資料載入失敗：", error);
    scriptureContent.innerHTML = "<p>經文載入失敗，請確認是否透過本地伺服器（Live Server）開啟網頁。</p>";
  }
}

// 2. 設置下拉選單
function setupDropdowns() {
  bookSelector.innerHTML = '';
  bibleData.forEach((item, index) => {
    const opt = document.createElement('option');
    opt.value = index;
    opt.textContent = `${item.bookName} 第 ${item.chapter} 章`;
    bookSelector.appendChild(opt);
  });

  bookSelector.addEventListener('change', (e) => {
    renderChapter(Number(e.target.value));
  });
}

// 3. 渲染經文內容
function renderChapter(index) {
  currentIndex = index;
  const currentData = bibleData[currentIndex];

  // 更新標題
  displayBookTitle.textContent = `${currentData.bookName} 第 ${currentData.chapter} 章`;
  displayChapterEn.textContent = `${currentData.bookNameEn} · Chapter ${currentData.chapter}`;
  bookSelector.value = currentIndex;

  // 渲染經文列表
  scriptureContent.innerHTML = currentData.verses.map(v => `
    <p class="verse">
      <sup class="verse-num">${v.verse}</sup>${v.text}
    </p>
  `).join('');

  // 更新上一章/下一章按鈕狀態
  prevBtn.disabled = (currentIndex === 0);
  nextBtn.disabled = (currentIndex === bibleData.length - 1);
  
  // 換章後回到頂部
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 4. 上下章按鈕監聽
prevBtn.addEventListener('click', () => {
  if (currentIndex > 0) renderChapter(currentIndex - 1);
});

nextBtn.addEventListener('click', () => {
  if (currentIndex < bibleData.length - 1) renderChapter(currentIndex + 1);
});

// 啟動
init();