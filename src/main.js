const path = require('path');
const { app, BrowserWindow, ipcMain, dialog, shell, clipboard } = require('electron');
const { Store } = require('./store');
const { WhatsApp } = require('./whatsapp');
const { readSheet, rowsToLeads, buildMessage, serviceAccountEmail, appsScriptCode } = require('./leads');

let win;
let store;
let wa;
let leads = [];
let columns = {};
let lastSync = null;
let syncError = null;
let paused = false;
let queue = [];
let working = false;
let pollTimer;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function leadStatus(lead) {
  const h = store.get(lead.key);
  if (h?.status) return h.status;
  if (queue.includes(lead.key)) return 'na_fila';
  if (!lead.phone) return 'invalido';
  if (!lead.complete) return 'incompleta';
  return 'aguardando';
}

function state() {
  return {
    wa: { status: wa.status, qr: wa.qr, error: wa.error },
    config: store.config,
    serviceEmail: serviceAccountEmail(store.config.credentialsPath),
    columns,
    lastSync,
    syncError,
    paused,
    queueSize: queue.length,
    leads: leads
      .map((l) => ({ ...l, status: leadStatus(l), info: store.get(l.key)?.error || null, sentAt: store.get(l.key)?.at || null }))
      .reverse(),
  };
}

function push() {
  win?.webContents.send('state', state());
}

function enqueue(key) {
  if (!queue.includes(key)) queue.push(key);
  push();
  work();
}

async function sync() {
  try {
    const values = await readSheet(store.config);
    const r = rowsToLeads(values, store.config);
    leads = r.leads;
    columns = r.columns;
    syncError = null;
    lastSync = new Date().toISOString();

    if (store.config.autoSend) {
      const from = new Date(store.config.autoSendFrom);
      for (const l of leads) {
        if (leadStatus(l) !== 'aguardando') continue;
        if (store.phoneAlreadyMessaged(l.phone)) {
          store.record(l.key, { phone: l.phone, name: l.name, status: 'repetido' });
          continue;
        }
        if (l.date && new Date(l.date) >= from) enqueue(l.key);
      }
    }
  } catch (e) {
    syncError = e.message;
  }
  console.log(`[planilha] ${syncError ? 'erro - ' + syncError : leads.length + ' respostas'}`);
  push();
}

async function work() {
  if (working) return;
  working = true;
  try {
    while (queue.length && !paused && wa.ready) {
      const key = queue[0];
      const lead = leads.find((l) => l.key === key);
      if (lead && !store.get(key)?.status) {
        const text = buildMessage(store.config.message, lead);
        try {
          const result = await wa.send(lead.phone, text);
          store.record(key, { phone: lead.phone, name: lead.name, status: result, error: null });
        } catch (e) {
          store.record(key, { phone: lead.phone, name: lead.name, status: 'erro', error: e.message });
        }
      }
      queue.shift();
      push();
      if (queue.length) {
        const base = store.config.intervalSeconds * 1000;
        await sleep(base + Math.random() * base * 0.5); // intervalo com variação, para parecer humano
      }
    }
  } finally {
    working = false;
  }
}

function schedulePoll() {
  clearInterval(pollTimer);
  pollTimer = setInterval(sync, Math.max(1, store.config.pollMinutes) * 60 * 1000);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1000,
    height: 720,
    title: 'Lunna SDR',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'ui', 'index.html'));
}

// Traz configuração, histórico e login do WhatsApp da versão antiga ("gui-sdr"), se existir.
function migrateOldData() {
  const fs = require('fs');
  const oldDir = path.join(app.getPath('appData'), 'gui-sdr');
  const newDir = app.getPath('userData');
  if (!fs.existsSync(path.join(oldDir, 'config.json')) || fs.existsSync(path.join(newDir, 'config.json'))) return;
  let skipped = 0;
  const copy = (src, dst) => {
    try {
      if (fs.statSync(src).isDirectory()) {
        fs.mkdirSync(dst, { recursive: true });
        for (const f of fs.readdirSync(src)) copy(path.join(src, f), path.join(dst, f));
      } else {
        fs.copyFileSync(src, dst);
      }
    } catch {
      skipped++; // arquivo em uso/temporário: ignora e segue
    }
  };
  for (const item of ['config.json', 'historico.json', 'whatsapp-sessao']) {
    copy(path.join(oldDir, item), path.join(newDir, item));
  }
  console.log(`[migracao] dados copiados de ${oldDir} (${skipped} arquivos ignorados)`);
}

app.whenReady().then(() => {
  migrateOldData();
  store = new Store(app.getPath('userData'));
  wa = new WhatsApp(path.join(app.getPath('userData'), 'whatsapp-sessao'));
  wa.on('change', () => {
    console.log(`[whatsapp] ${wa.status}${wa.error ? ' - ' + wa.error : ''}`);
    push();
    if (wa.ready) work();
  });

  ipcMain.handle('state', () => state());
  ipcMain.handle('sync', () => sync());
  ipcMain.handle('send', (_e, key) => {
    if (store.get(key)?.status === 'enviado') return;
    store.clear(key); // limpa erro/ignorado anterior para permitir reenvio manual
    enqueue(key);
  });
  ipcMain.handle('ignore', (_e, key) => {
    queue = queue.filter((k) => k !== key);
    const l = leads.find((x) => x.key === key);
    store.record(key, { phone: l?.phone, name: l?.name, status: 'ignorado' });
    push();
  });
  ipcMain.handle('pause', (_e, value) => {
    paused = value;
    push();
    if (!paused) work();
  });
  ipcMain.handle('save-config', (_e, partial) => {
    store.saveConfig(partial);
    schedulePoll();
    sync();
  });
  ipcMain.handle('choose-credentials', async () => {
    const r = await dialog.showOpenDialog(win, {
      title: 'Escolha o arquivo JSON da conta de serviço do Google',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (r.canceled || !r.filePaths[0]) return null;
    store.saveConfig({ credentialsPath: r.filePaths[0] });
    sync();
    return r.filePaths[0];
  });
  ipcMain.handle('copy-script', () => clipboard.writeText(appsScriptCode(store.config.scriptToken)));
  ipcMain.handle('logout', () => wa.logout());
  ipcMain.handle('open-sheet', () =>
    shell.openExternal(`https://docs.google.com/spreadsheets/d/${store.config.sheetId}/edit`)
  );
  ipcMain.handle('open-data-folder', () => shell.openPath(app.getPath('userData')));

  createWindow();
  wa.start();
  sync();
  schedulePoll();
});

app.on('window-all-closed', async () => {
  try {
    await wa?.client?.destroy();
  } catch {}
  app.quit();
});
