const fs = require('fs');
const path = require('path');
const readline = require('readline');

async function convertVietnamese() {
  const xmlPath = path.join(__dirname, 'Vietnamese.xml');
  const outputPath = path.join(__dirname, 'data', 'vi_1925.json');

  if (!fs.existsSync(xmlPath)) {
    console.error('❌ 找不到 Vietnamese.xml！請確認檔案已放置在專案根目錄。');
    return;
  }

  const fileStream = fs.createReadStream(xmlPath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const result = [];
  let isInsideVerse = false;
  let currentBook = '';
  let currentChap = 0;
  let currentVerse = 0;
  let verseTextParts = [];

  console.log('⏳ 正在精準解析越南文 CES XML 聖經...');

  for await (const line of rl) {
    const trimmed = line.trim();

    // 匹配 <seg id="b.GEN.1.1" type="verse">
    const segStart = trimmed.match(/<seg\s+id="b\.([A-Za-z0-9]+)\.(\d+)\.(\d+)"[^>]*>/i);
    if (segStart) {
      isInsideVerse = true;
      currentBook = segStart[1].toUpperCase();
      currentChap = parseInt(segStart[2], 10);
      currentVerse = parseInt(segStart[3], 10);
      verseTextParts = [];

      // 若同一行就有文字內容（去掉標籤部分）
      const afterTag = trimmed.replace(/<seg[^>]*>/i, '');
      if (afterTag && !afterTag.includes('</seg>')) {
        verseTextParts.push(afterTag.trim());
      }
      continue;
    }

    // 匹配經文結束 </seg>
    if (isInsideVerse && trimmed.includes('</seg>')) {
      const beforeClose = trimmed.replace(/<\/seg>/i, '').trim();
      if (beforeClose) {
        verseTextParts.push(beforeClose);
      }

      const fullText = verseTextParts.join(' ').replace(/\s+/g, ' ').trim();
      if (fullText) {
        result.push({
          book: currentBook,
          chapter: currentChap,
          verse: currentVerse,
          text: fullText
        });
      }

      isInsideVerse = false;
      verseTextParts = [];
      continue;
    }

    // 收集標籤內的跨行文字
    if (isInsideVerse && trimmed) {
      verseTextParts.push(trimmed);
    }
  }

  fs.writeFileSync(outputPath, JSON.stringify(result), 'utf8');
  console.log(`✅ 越南文轉換大成功！共轉換 ${result.length} 節經文。`);
  console.log('📁 檔案已自動輸出至: data/vi_1925.json');
}

convertVietnamese();