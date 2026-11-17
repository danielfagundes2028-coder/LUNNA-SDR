// Guarda configuração e histórico de leads em JSON na pasta de dados do app.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_CONFIG = {
  sheetId: '',
  // Modo recomendado: Apps Script na planilha (não precisa de chave do Google Cloud).
  scriptUrl: '',
  scriptToken: '',
  // Modo alternativo: conta de serviço com chave JSON.
  credentialsPath: '',
  nameColumn: '',
  phoneColumn: '',
  message:
    'Opa {nome}, tranquilo? Aqui é o Gui! Vi que você preencheu meu FORMS com interesse em entender mais sobre o mercado, certo?',
  pollMinutes: 2,
  intervalSeconds: 25,
  autoSend: true,
  // Respostas com data anterior a isto não são enviadas sozinhas (evita disparar para a base antiga).
  autoSendFrom: null,
};

class Store {
  constructor(dir) {
    this.dir = dir;
    fs.mkdirSync(dir, { recursive: true });
    this.configFile = path.join(dir, 'config.json');
    this.historyFile = path.join(dir, 'historico.json');
    this.config = { ...DEFAULT_CONFIG, ...this.#read(this.configFile, {}) };
    if (!this.config.autoSendFrom || !this.config.scriptToken) {
      this.config.autoSendFrom ||= new Date().toISOString();
      this.config.scriptToken ||= crypto.randomBytes(18).toString('base64url');
      this.saveConfig({});
    }
    this.history = this.#read(this.historyFile, {});
  }

  #read(file, fallback) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
    } catch {
      return fallback;
    }
  }

  #write(file, data) {
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, file);
  }

  saveConfig(partial) {
    this.config = { ...this.config, ...partial };
    this.#write(this.configFile, this.config);
    return this.config;
  }

  record(key, entry) {
    this.history[key] = { ...(this.history[key] || {}), ...entry, at: new Date().toISOString() };
    this.#write(this.historyFile, this.history);
  }

  clear(key) {
    if (!(key in this.history)) return;
    delete this.history[key];
    this.#write(this.historyFile, this.history);
  }

  get(key) {
    return this.history[key];
  }

  phoneAlreadyMessaged(phone) {
    return Object.values(this.history).some((h) => h.phone === phone && h.status === 'enviado');
  }
}

module.exports = { Store, DEFAULT_CONFIG };
