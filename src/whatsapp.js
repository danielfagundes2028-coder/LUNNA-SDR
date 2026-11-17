// Conexão com o WhatsApp Web (QR code) usando whatsapp-web.js + o Chrome instalado.
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const QRCode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe'),
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p));
}

class WhatsApp extends EventEmitter {
  constructor(dataPath) {
    super();
    this.dataPath = dataPath;
    this.status = 'iniciando';
    this.qr = null;
    this.client = null;
  }

  #set(status, extra = {}) {
    this.status = status;
    Object.assign(this, extra);
    this.emit('change');
  }

  start() {
    const executablePath = findChrome();
    if (!executablePath) {
      this.#set('erro', { error: 'Não achei o Google Chrome. Instale o Chrome ou defina CHROME_PATH.' });
      return;
    }
    this.client = new Client({
      authStrategy: new LocalAuth({ dataPath: this.dataPath }),
      // Cache na pasta de dados (no app instalado a pasta atual pode ser somente leitura, ex.: "/" no Mac).
      webVersionCache: { type: 'local', path: path.join(this.dataPath, '..', 'wwebjs-cache') },
      puppeteer: { executablePath, headless: true, args: ['--no-sandbox'] },
    });
    this.client.on('qr', async (qr) => this.#set('qr', { qr: await QRCode.toDataURL(qr, { margin: 1, width: 280 }) }));
    this.client.on('authenticated', () => this.#set('autenticando', { qr: null }));
    this.client.on('ready', () => this.#set('conectado', { qr: null, error: null }));
    this.client.on('auth_failure', (m) => this.#set('erro', { error: `Falha no login: ${m}` }));
    this.client.on('disconnected', (reason) => {
      this.#set('desconectado', { error: String(reason) });
      // Tenta reconectar sozinho (mostra novo QR se precisar).
      setTimeout(() => this.restart(), 5000);
    });
    this.#set('iniciando');
    this.client.initialize().catch((e) => this.#set('erro', { error: e.message }));
  }

  async restart() {
    try {
      await this.client?.destroy();
    } catch {}
    this.start();
  }

  async logout() {
    try {
      await this.client?.logout();
    } catch {}
    await this.restart();
  }

  get ready() {
    return this.status === 'conectado';
  }

  /** Envia texto. Retorna 'enviado' ou 'sem_whatsapp'. */
  async send(phone, text) {
    if (!this.ready) throw new Error('WhatsApp não está conectado');
    const id = await this.client.getNumberId(phone); // resolve também o 9º dígito
    if (!id) return 'sem_whatsapp';
    await this.client.sendMessage(id._serialized, text);
    return 'enviado';
  }
}

module.exports = { WhatsApp, findChrome };
