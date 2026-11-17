// Teste rápido da leitura de leads (sem WhatsApp nem Google): `npm run check`
const assert = require('assert');
const { rowsToLeads, normalizePhone, buildMessage } = require('../src/leads');

assert.strictEqual(normalizePhone('(11) 98888-7777'), '5511988887777');
assert.strictEqual(normalizePhone('+55 21 97777-6666'), '5521977776666');
assert.strictEqual(normalizePhone('5511912345678'), '5511912345678');
assert.strictEqual(normalizePhone('123'), null);

const values = [
  ['Qual o seu nome?', 'Telefone', 'Pontuação', 'Data', 'ID', 'Status'],
  ['Maria souza', '5511912345678', '0', '2026-11-17 00:10:18', 'e8ed', 'Completa'],
  ['ana', '123', '0', '2026-11-17 01:00:00', 'f1', 'Incompleta'],
];
const { leads, columns } = rowsToLeads(values, {});
assert.deepStrictEqual(columns, { name: 'Qual o seu nome?', phone: 'Telefone' });
assert.strictEqual(leads[0].firstName, 'Maria');
assert.strictEqual(leads[0].date, '2026-11-17T00:10:18.000Z'); // Respondi grava em UTC
assert.strictEqual(leads[0].key, 'e8ed');
assert.strictEqual(leads[0].complete, true);
assert.strictEqual(leads[1].phone, null);
assert.strictEqual(leads[1].complete, false);
assert.strictEqual(buildMessage('Opa {nome}, tranquilo?', leads[0]), 'Opa Maria, tranquilo?');
const br = rowsToLeads([['Nome', 'Telefone', 'Data'], ['Zé', '31 99999-0000', '17/11/2026 00:10:18']], {}).leads[0];
assert.strictEqual(new Date(br.date).getDate(), 17);
assert.ok(require('../src/leads').appsScriptCode('abc').includes("const TOKEN = 'abc'"));
console.log('ok: leitura de leads funcionando');
