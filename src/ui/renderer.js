const $ = (id) => document.getElementById(id);
let current = null;
let formFilled = false;

const WA_LABEL = {
  iniciando: ['Iniciando…', 'wait'],
  qr: ['Escaneie o QR', 'wait'],
  autenticando: ['Conectando…', 'wait'],
  conectado: ['Conectado', 'ok'],
  desconectado: ['Desconectado', 'bad'],
  erro: ['Erro', 'bad'],
};

const STATUS_LABEL = {
  enviado: 'Enviado',
  na_fila: 'Na fila',
  aguardando: 'Aguardando',
  sem_whatsapp: 'Sem WhatsApp',
  invalido: 'Telefone inválido',
  incompleta: 'Resposta incompleta',
  erro: 'Erro',
  ignorado: 'Ignorado',
  repetido: 'Já chamado antes',
};

const fmt = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

function el(tag, attrs = {}, text) {
  const e = document.createElement(tag);
  Object.assign(e, attrs);
  if (text != null) e.textContent = text;
  return e;
}

function render(s) {
  current = s;
  const [label, cls] = WA_LABEL[s.wa.status] || [s.wa.status, ''];
  $('wa-badge').textContent = `WhatsApp: ${label}`;
  $('wa-badge').className = `badge ${cls}`;

  const showPanel = s.wa.status !== 'conectado';
  $('wa-panel').classList.toggle('hidden', !showPanel);
  $('qr').classList.toggle('hidden', !s.wa.qr);
  if (s.wa.qr) $('qr').src = s.wa.qr;
  $('wa-msg').textContent = s.wa.error || (s.wa.status === 'iniciando' ? 'Abrindo o WhatsApp Web…' : '');

  $('btn-pause').textContent = s.paused ? 'Retomar envios' : 'Pausar envios';
  $('sync-info').textContent =
    `Última busca: ${fmt(s.lastSync)}` + (s.queueSize ? ` · ${s.queueSize} na fila` : '') + (s.paused ? ' · PAUSADO' : '');
  $('sync-error').textContent = s.syncError || '';
  $('sync-error').classList.toggle('hidden', !s.syncError);

  const tbody = $('leads');
  tbody.replaceChildren();
  $('empty').classList.toggle('hidden', s.leads.length > 0);
  for (const l of s.leads) {
    const tr = el('tr');
    tr.append(el('td', {}, l.name), el('td', {}, l.phone || l.rawPhone), el('td', {}, fmt(l.date)));
    const st = el('td');
    st.append(el('span', { className: `st st-${l.status}` }, STATUS_LABEL[l.status] || l.status));
    if (l.info) st.append(el('div', { className: 'muted' }, l.info));
    tr.append(st);
    const actions = el('td');
    if (['aguardando', 'erro', 'ignorado', 'sem_whatsapp', 'repetido', 'incompleta'].includes(l.status) && l.phone) {
      const b = el('button', { className: 'small primary' }, l.status === 'aguardando' ? 'Enviar' : 'Enviar mesmo assim');
      b.onclick = () => window.sdr.send(l.key);
      actions.append(b);
    }
    if (['aguardando', 'na_fila'].includes(l.status)) {
      const b = el('button', { className: 'small' }, 'Ignorar');
      b.onclick = () => window.sdr.ignore(l.key);
      actions.append(b);
    }
    tr.append(actions);
    tbody.append(tr);
  }

  $('cred-path').textContent = s.config.credentialsPath || 'nenhuma';
  $('cred-email').textContent = s.serviceEmail
    ? `Compartilhe a planilha com: ${s.serviceEmail} (Leitor)`
    : '';
  $('auto-from').textContent = `Envio automático vale para respostas a partir de ${fmt(s.config.autoSendFrom)}. As anteriores ficam como "Aguardando" para você enviar manualmente.`;

  if (!formFilled) {
    $('cfg-message').value = s.config.message;
    $('cfg-sheet').value = s.config.sheetId;
    $('cfg-scripturl').value = s.config.scriptUrl;
    $('cfg-poll').value = s.config.pollMinutes;
    $('cfg-interval').value = s.config.intervalSeconds;
    $('cfg-auto').checked = s.config.autoSend;
    $('cfg-namecol').value = s.config.nameColumn;
    $('cfg-phonecol').value = s.config.phoneColumn;
    formFilled = true;
  }
}

$('btn-sync').onclick = () => window.sdr.sync();
$('btn-pause').onclick = () => window.sdr.pause(!current?.paused);
$('btn-cred').onclick = () => window.sdr.chooseCredentials();
$('btn-copy-script').onclick = async () => {
  await window.sdr.copyScript();
  $('btn-copy-script').textContent = 'Código copiado ✓';
  setTimeout(() => ($('btn-copy-script').textContent = '1. Copiar código do Apps Script'), 2000);
};
$('btn-sheet').onclick = () => window.sdr.openSheet();
$('btn-data').onclick = () => window.sdr.openDataFolder();
$('btn-logout').onclick = () => {
  if (confirm('Desconectar o WhatsApp deste app? Vai precisar escanear o QR de novo.')) window.sdr.logout();
};
$('btn-save').onclick = async () => {
  await window.sdr.saveConfig({
    message: $('cfg-message').value,
    sheetId: $('cfg-sheet').value.trim(),
    scriptUrl: $('cfg-scripturl').value.trim(),
    pollMinutes: Number($('cfg-poll').value) || 2,
    intervalSeconds: Math.max(5, Number($('cfg-interval').value) || 25),
    autoSend: $('cfg-auto').checked,
    nameColumn: $('cfg-namecol').value.trim(),
    phoneColumn: $('cfg-phonecol').value.trim(),
  });
  $('btn-save').textContent = 'Salvo ✓';
  setTimeout(() => ($('btn-save').textContent = 'Salvar'), 1500);
};

window.sdr.onState(render);
window.sdr.state().then(render);
