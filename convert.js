const fs = require('fs');
const path = require('path');
const readline = require('readline');

async function convertBible() {
  const xmlPath = path.join(__dirname, 'tb.xml');
  const booksPath = path.join(__dirname, 'data', 'books.json');
  const outputPath = path.join(__dirname, 'data', 'id_tb.json');

  if (!fs.existsSync(xmlPath)) {
    console.error('❌ 找不到 tb.xml！請確認檔案已存在專案根目錄。');
    return;
  }

  // 讀取 books.json 建立書卷編號 (1 -> GEN)
  const booksMeta = JSON.parse(fs.readFileSync(booksPath, 'utf8'));

  const fileStream = fs.createReadStream(xmlPath, { encoding: 'utf8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const result = [];
  let currentBookId = '';
  let currentChapter = 0;

  console.log('⏳ 正在解析整本聖經 XML，請稍候...');

  for await (const line of rl) {
    const trimmed = line.trim();

    // 匹配書卷號碼 <book number="1">
    const bookMatch = trimmed.match(/<book\s+number="(\d+)"/i);
    if (bookMatch) {
      const bNum = parseInt(bookMatch[1], 10);
      currentBookId = booksMeta[bNum - 1] ? booksMeta[bNum - 1].id : `BOOK_${bNum}`;
      continue;
    }

    // 匹配章節號碼 <chapter number="1">
    const chapMatch = trimmed.match(/<chapter\s+number="(\d+)"/i);
    if (chapMatch) {
      currentChapter = parseInt(chapMatch[1], 10);
      continue;
    }

    // 匹配經文 <verse number="1">文字內容</verse>
    const verseMatch = trimmed.match(/<verse\s+number="(\d+)"[^>]*>([\s\S]*?)<\/verse>/i);
    if (verseMatch) {
      const verseNum = parseInt(verseMatch[1], 10);
      const text = verseMatch[2].replace(/<[^>]+>/g, '').trim();

      result.push({
        book: currentBookId,
        chapter: currentChapter,
        verse: verseNum,
        text: text
      });
    }
  }

  // 寫入 data/id_tb.json
  fs.writeFileSync(outputPath, JSON.stringify(result), 'utf8');
  console.log(`✅ 轉換大成功！共轉換了 ${result.length} 節經文。`);
  console.log(`📁 檔案已輸出至: data/id_tb.json`);
}

convertBible();