// Lê a planilha do Respondi e transforma cada linha em um lead.
const fs = require('fs');
const { GoogleAuth } = require('google-auth-library');

const semAcento = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function findColumn(headers, configured, keywords) {
  if (configured) return headers.includes(configured) ? configured : null;
  for (const k of keywords) {
    const h = headers.find((c) => semAcento(c).includes(k));
    if (h) return h;
  }
  return null;
}

function normalizePhone(raw) {
  let d = String(raw ?? '').replace(/\D/g, '').replace(/^0+/, '');
  if (d.length === 10 || d.length === 11) d = '55' + d;
  return d.startsWith('55') && (d.length === 12 || d.length === 13) ? d : null;
}

function firstName(full) {
  const p = String(full ?? '').trim().split(/\s+/)[0] || '';
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : '';
}

function parseDate(s) {
  if (!s) return null;
  // Respondi: "2026-11-17 00:10:18" em UTC (resposta das 21:10 de Brasília aparece como 00:10)
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)));
  // Formato brasileiro: "17/11/2026 00:10:18"
  const br = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (br) return new Date(+br[3], +br[2] - 1, +br[1], +(br[4] || 0), +(br[5] || 0), +(br[6] || 0));
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function serviceAccountEmail(credentialsPath) {
  try {
    return JSON.parse(fs.readFileSync(credentialsPath, 'utf8')).client_email || null;
  } catch {
    return null;
  }
}

// Código para colar no Apps Script da planilha (Extensões → Apps Script).
function appsScriptCode(token) {
  return `// Lunna SDR - entrega as respostas da planilha para o app (somente leitura)
const TOKEN = '${token}';

function doGet(e) {
  const out = (obj) => ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
  if (!e || !e.parameter || e.parameter.token !== TOKEN) return out({ error: 'token invalido' });
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  return out({ values: sheet.getDataRange().getDisplayValues() });
}
`;
}

async function readViaScript({ scriptUrl, scriptToken }) {
  const url = `${scriptUrl}${scriptUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(scriptToken)}`;
  const res = await fetch(url, { redirect: 'follow' });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      'O link do Apps Script não devolveu dados. Confira se foi implantado como "App da Web" com acesso "Qualquer pessoa".'
    );
  }
  if (data.error) throw new Error(`Apps Script: ${data.error}. Copie o código de novo pelo app e reimplante.`);
  return data.values || [];
}

async function readSheet(config) {
  if (config.scriptUrl) return readViaScript(config);
  const { sheetId, credentialsPath } = config;
  if (!credentialsPath) throw new Error('Configure o link do Apps Script em Configurações (passo a passo no README).');
  const auth = new GoogleAuth({
    keyFile: credentialsPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const client = await auth.getClient();
  try {
    const res = await client.request({
      url: `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A:Z`,
    });
    return res.data.values || [];
  } catch (e) {
    const status = e.response?.status;
    if (status === 403 || status === 404) {
      throw new Error(
        `Sem acesso à planilha. Compartilhe-a com ${serviceAccountEmail(credentialsPath) || 'o e-mail da credencial'} (Leitor).`
      );
    }
    throw e;
  }
}

function rowsToLeads(values, config) {
  if (values.length < 2) return { leads: [], columns: {} };
  const headers = values[0].map((h) => String(h).trim());
  const nameCol = findColumn(headers, config.nameColumn, ['nome', 'name']);
  const phoneCol = findColumn(headers, config.phoneColumn, ['whatsapp', 'telefone', 'celular', 'fone', 'phone', 'zap']);
  if (!nameCol || !phoneCol) {
    throw new Error(`Não achei as colunas de nome/telefone. Cabeçalhos: ${headers.join(' | ')}`);
  }
  const idCol = headers.find((h) => semAcento(h) === 'id');
  const dateCol = headers.find((h) => semAcento(h) === 'data');
  const statusCol = headers.find((h) => semAcento(h) === 'status');

  const leads = values.slice(1).map((row, i) => {
    const obj = Object.fromEntries(headers.map((h, j) => [h, row[j] ?? '']));
    const phone = normalizePhone(obj[phoneCol]);
    return {
      key: (idCol && obj[idCol]) || `linha-${i + 2}-${phone || obj[phoneCol]}`,
      name: obj[nameCol],
      firstName: firstName(obj[nameCol]),
      rawPhone: obj[phoneCol],
      phone,
      date: parseDate(dateCol && obj[dateCol])?.toISOString() || null,
      complete: statusCol ? semAcento(obj[statusCol]) !== 'incompleta' : true,
    };
  });
  return { leads, columns: { name: nameCol, phone: phoneCol } };
}

function buildMessage(template, lead) {
  return template.replace(/\{nome\}/g, lead.firstName).replace(/ ,/g, ',');
}

module.exports = { readSheet, appsScriptCode, rowsToLeads, normalizePhone, firstName, buildMessage, serviceAccountEmail };
