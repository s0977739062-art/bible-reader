const fs = require('fs');
const path = require('path');

const booksPath = path.join(__dirname, 'data', 'books.json');
const enPath = path.join(__dirname, 'data', 'en_kjv.json');

console.log('⏳ 正在讀取並解析英文 KJV 聖經...');
const booksMeta = JSON.parse(fs.readFileSync(booksPath, 'utf8'));
const rawData = JSON.parse(fs.readFileSync(enPath, 'utf8'));

const flatList = [];
const booksArray = rawData.books || [];

booksArray.forEach((bObj, bIdx) => {
  // 對齊標準書卷代碼 (GEN, EXO...)
  const bookId = booksMeta[bIdx] ? booksMeta[bIdx].id : (bObj.name || `B${bIdx + 1}`);

  (bObj.chapters || []).forEach(cObj => {
    const chapNum = Number(cObj.chapter || 0);

    (cObj.verses || []).forEach(vObj => {
      flatList.push({
        book: bookId,
        chapter: chapNum,
        verse: Number(vObj.verse || 0),
        text: (vObj.text || '').trim()
      });
    });
  });
});

fs.writeFileSync(enPath, JSON.stringify(flatList), 'utf8');
console.log(`✅ 轉換大成功！共整理出 ${flatList.length} 節經文。`);
console.log('📁 已自動覆蓋儲存至 data/en_kjv.json');