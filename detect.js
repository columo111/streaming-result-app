// 画像処理の共通ロジック(index.html と tools/build-template.html から利用)

// 列ごとの「明るい画素の割合」(時計やアイコンなど少量の表示は無視できる)
function columnBrightRatio(img, thr) {
  const w = img.naturalWidth, h = img.naturalHeight;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h).data;
  c.width = c.height = 0;   // 作業用キャンバスのメモリを解放(iPadのSafariは大きなキャンバスが溜まると落ちる)
  const step = Math.max(1, Math.floor(h / 300));
  const ratio = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    let bright = 0, n = 0;
    for (let y = 0; y < h; y += step) {
      const i = (y * w + x) * 4;
      if (Math.max(data[i], data[i+1], data[i+2]) > thr) bright++;
      n++;
    }
    ratio[x] = bright / n;
  }
  return ratio;
}

// 行ごとの「明るい画素の割合」(左右カット後の範囲 x0〜x1 で計算)
function rowBrightRatio(img, thr, x0, x1) {
  const w = img.naturalWidth, h = img.naturalHeight;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h).data;
  c.width = c.height = 0;   // 作業用キャンバスのメモリを解放(iPadのSafariは大きなキャンバスが溜まると落ちる)
  const step = Math.max(1, Math.floor((x1 - x0) / 300));
  const ratio = new Float32Array(h);
  for (let y = 0; y < h; y++) {
    let bright = 0, n = 0;
    for (let x = x0; x < x1; x += step) {
      const i = (y * w + x) * 4;
      if (Math.max(data[i], data[i+1], data[i+2]) > thr) bright++;
      n++;
    }
    ratio[y] = n ? bright / n : 0;
  }
  return ratio;
}

// 左右の余白幅を決める。symmetric なら小さい方に揃える(コンテンツは中央配置のため)
function detectBands(ratio, maxRatio, symmetric) {
  const w = ratio.length;
  let l = 0; while (l < w && ratio[l] <= maxRatio) l++;
  let r = 0; while (r < w - l && ratio[w - 1 - r] <= maxRatio) r++;
  if (symmetric) l = r = Math.min(l, r);
  return { left: l, right: r };
}

// --- リザルト画面の判定 ---
// 左右の黒帯を除いた全高の画像を FW×FH に縮小し、「ほぼ白」の画素マスクを特徴量にする。
// リザルト画面は背景色が配信ごとに違うが、中央の白いカードの形は共通。
const FW = 40, FH = 80, WHITE = 225;

function featureOf(img, left, right) {
  const w = img.naturalWidth, h = img.naturalHeight;
  const c = document.createElement('canvas'); c.width = FW; c.height = FH;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, left, 0, w - left - right, h, 0, 0, FW, FH);
  const d = ctx.getImageData(0, 0, FW, FH).data;
  const f = new Float32Array(FW * FH);
  for (let i = 0; i < f.length; i++) f[i] = Math.min(d[i*4], d[i*4+1], d[i*4+2]) >= WHITE ? 1 : 0;
  return f;
}

// テンプレートとの一致度(0〜1、1に近いほどリザルト画面らしい)
function matchScore(f, tpl) {
  let diff = 0;
  for (let i = 0; i < f.length; i++) diff += Math.abs(f[i] - tpl[i]);
  return 1 - diff / f.length;
}

// アイテム画面のカード(色付きの四角形)の上下端を検出する。
// 貼られたアイテムの装飾はカードの外にはみ出すため、カードの左右の端のすぐ内側の列だけを見て、
// 「左右どちらの端も黒ではない」行が最も長く続く範囲をカードとする。
function detectCardRows(img, thr, left, right) {
  const w = img.naturalWidth, h = img.naturalHeight;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, w, h).data;
  c.width = c.height = 0;
  const inset = 4, xs = [left + inset, w - right - 1 - inset];
  const lit = y => xs.every(x => { const i = (y * w + x) * 4; return Math.max(d[i], d[i+1], d[i+2]) > thr; });
  let best = { start: 0, len: 0 }, start = -1;
  for (let y = 0; y <= h; y++) {
    if (y < h && lit(y)) { if (start < 0) start = y; }
    else if (start >= 0) { if (y - start > best.len) best = { start, len: y - start }; start = -1; }
  }
  return { top: best.start, bottom: h - best.start - best.len, len: best.len };
}
