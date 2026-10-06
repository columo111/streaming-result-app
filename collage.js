// コラージュ生成: どの枚数でも出力の縦横比は固定(9:8)、同一コラージュ内の画像は全て同じ大きさ。
// 枚数が少ないときは白い余白で調整し、各段を中央寄せで配置する。
// 余白カット後の画像は 3:4 の縦長カードを想定(違う比率なら中央をトリミング)
const COLLAGE_ROWS = {   // 枚数 → 各段の枚数
  1: [1], 2: [2], 3: [2, 1], 4: [2, 2], 5: [3, 2], 6: [3, 3],
};
const COLLAGE_SIZE = { W: 1800, H: 1600 };   // 9:8
const CARD_RATIO = 4 / 3;                    // 元カードの高さ/幅
const MIN_CELL_RATIO = 1.1;                  // セルの高さ/幅の下限(上下を最大約17%までトリミングして大きくする)

function drawCollage(crops, { gapRate = 0.1, outerRate = 0.04, radiusRate = 0.18 } = {}) {
  const rows = COLLAGE_ROWS[crops.length];
  if (!rows) throw new Error('コラージュは1〜6枚です: ' + crops.length);
  const { W, H } = COLLAGE_SIZE, cols = Math.max(...rows);
  // セル幅 c: 横幅と縦幅の両方に収まる最大値(画像間の隙間 = c * gapRate、外周の余白 = c * outerRate)
  // 縦がきつい(段が多い/1枚)ときは、セルを少し横長にして(上下をトリミング)大きくする
  const cw = W / (cols + (cols - 1) * gapRate + 2 * outerRate), n = rows.length;
  const fit = (H / cw - (n - 1) * gapRate - 2 * outerRate) / n;
  const ratio = Math.min(CARD_RATIO, Math.max(MIN_CELL_RATIO, fit));
  const c = Math.min(cw, H / (n * ratio + (n - 1) * gapRate + 2 * outerRate));
  const ch = c * ratio, gap = c * gapRate, radius = c * radiusRate;
  const blockH = rows.length * ch + (rows.length - 1) * gap;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingQuality = 'high';
  let k = 0, y = (H - blockH) / 2;
  rows.forEach(n => {
    const rowW = n * c + (n - 1) * gap;
    let x = (W - rowW) / 2;
    for (let i = 0; i < n; i++, k++) {
      const img = crops[k], sw0 = img.naturalWidth || img.width, sh0 = img.naturalHeight || img.height;
      const s = Math.max(c / sw0, ch / sh0), sw = c / s, sh = ch / s;
      ctx.save();
      ctx.beginPath(); ctx.roundRect(x, y, c, ch, radius); ctx.clip();
      ctx.drawImage(img, (sw0 - sw) / 2, (sh0 - sh) / 2, sw, sh, x, y, c, ch);
      ctx.restore();
      x += c + gap;
    }
    y += ch + gap;
  });
  return cv;
}
