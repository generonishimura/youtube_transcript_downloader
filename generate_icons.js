// YouTube書き起こしダウンロード拡張機能用のアイコンを生成します
const sharp = require('sharp');
const fs = require('fs');

// アイコンのサイズ
const sizes = [16, 48, 128];

// 出力ディレクトリ
const outputDir = 'icons';

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function generateIcon(size) {
  // SVG文字列を作成
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="#FF0000"/>
      <path d="M ${size * 0.25} ${size * 0.25} L ${size * 0.75} ${size * 0.5} L ${size * 0.25} ${size * 0.75} Z" fill="white"/>
    </svg>
  `;

  // SVGをPNGに変換
  const buffer = await sharp(Buffer.from(svg))
    .png()
    .toBuffer();

  // ファイルに保存
  const outputPath = `${outputDir}/icon${size}.png`;
  fs.writeFileSync(outputPath, buffer);
  console.log(`Created: ${outputPath}`);
}

async function generateAll() {
  for (const size of sizes) {
    await generateIcon(size);
  }
  console.log('アイコンの生成が完了しました！');
}

generateAll().catch(console.error);
