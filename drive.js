// Googleドライブへの保存(Google Identity Services のトークン方式 + Drive REST API)
// スコープは drive.file: このアプリが作成したファイル/フォルダにしかアクセスできない。
const DRIVE_CLIENT_ID = '1057365388753-1f2rf7eat83s5b1c6l73hpup5qemt73g.apps.googleusercontent.com';   // Google Cloud で作成した OAuth クライアントID(秘密ではない)
const DRIVE_ROOT_FOLDER = 'StreamResults';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

let driveToken = null, driveTokenExp = 0, driveTokenClient = null;

function driveAuth() {
  if (driveToken && Date.now() < driveTokenExp - 60e3) return Promise.resolve(driveToken);
  return new Promise((resolve, reject) => {
    if (!window.google || !google.accounts) return reject(new Error('Googleのログイン部品を読み込めませんでした(オフラインの可能性)'));
    driveTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: DRIVE_CLIENT_ID, scope: DRIVE_SCOPE,
      callback: r => {
        if (r.error) return reject(new Error('ログイン失敗: ' + (r.error_description || r.error)));
        driveToken = r.access_token; driveTokenExp = Date.now() + (r.expires_in || 3600) * 1000; resolve(driveToken);
      },
      error_callback: e => reject(new Error('ログインが完了しませんでした: ' + (e.type || e.message || e))),
    });
    driveTokenClient.requestAccessToken();
  });
}

async function driveFetch(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: 'Bearer ' + await driveAuth() } });
  if (!res.ok) throw new Error(`Drive API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

const q = s => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");   // Driveの検索クエリ用エスケープ

// 名前でフォルダを探し、無ければ作る(parent が null ならマイドライブ直下)
async function driveEnsureFolder(name, parent) {
  const cond = `name='${q(name)}' and mimeType='application/vnd.google-apps.folder' and trashed=false` + (parent ? ` and '${parent}' in parents` : ` and 'root' in parents`);
  const found = await driveFetch('https://www.googleapis.com/drive/v3/files?fields=files(id)&q=' + encodeURIComponent(cond));
  if (found.files.length) return found.files[0].id;
  const made = await driveFetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: parent ? [parent] : ['root'] }),
  });
  return made.id;
}

// 同名ファイルがあれば上書き、無ければ新規作成(再保存で重複させない)
async function driveUploadBlob(blob, name, folderId) {
  const cond = `name='${q(name)}' and '${folderId}' in parents and trashed=false`;
  const found = await driveFetch('https://www.googleapis.com/drive/v3/files?fields=files(id)&q=' + encodeURIComponent(cond));
  const meta = found.files.length ? { name } : { name, parents: [folderId] };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
  form.append('file', blob);
  const base = 'https://www.googleapis.com/upload/drive/v3/files';
  return driveFetch(found.files.length ? `${base}/${found.files[0].id}?uploadType=multipart&fields=id` : `${base}?uploadType=multipart&fields=id`,
    { method: found.files.length ? 'PATCH' : 'POST', body: form });
}

// files: [{ stamp, name, blob }] を StreamResults/<stamp>/<name> に保存。onProgress(done, total, name)
async function driveSaveAll(files, onProgress) {
  const root = await driveEnsureFolder(DRIVE_ROOT_FOLDER, null);
  const sub = {};
  let done = 0;
  for (const f of files) {
    sub[f.stamp] = sub[f.stamp] || await driveEnsureFolder(f.stamp, root);
    await driveUploadBlob(f.blob, f.name, sub[f.stamp]);
    onProgress && onProgress(++done, files.length, f.name);
  }
}
