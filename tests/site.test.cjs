const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');

test('HTML has Spanish language and responsive viewport', () => {
  assert.match(html, /<html lang="es">/);
  assert.match(html, /name="viewport"/);
});

test('All three operators are selectable', () => {
  for (const operator of ['Claro', 'Altice', 'Viva']) {
    assert.ok(html.includes('data-operator="' + operator + '"'), operator);
  }
});

test('All six amounts are available', () => {
  for (const amount of [100, 200, 300, 500, 1000, 2000]) {
    assert.ok(html.includes('data-amount="' + amount + '"'), amount);
  }
});

test('Demo warnings are clearly shown', () => {
  assert.match(html, /DEMO · Sin pagos reales/);
  assert.match(html, /no procesa|no se ha cargado dinero|no realiza recargas reales/i);
});

test('Inline JavaScript parses without syntax errors', () => {
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
  assert.ok(scripts.length > 0, 'Expected JavaScript');
  for (const [, source] of scripts) new vm.Script(source);
});

test('Valid Dominican numbers must contain 10 digits and supported prefixes', () => {
  const source = html.match(/function validPhone\(d\)\{return (\/[^\n]+?\/).test\(d\)\}/);
  assert.ok(source, 'Phone validation rule must exist');
  const pattern = vm.runInNewContext(source[1]);
  for (const number of ['8095551234', '8295551234', '8495551234']) assert.equal(pattern.test(number), true);
  for (const number of ['809555123', '80955512345', '8005551234', '809abc1234']) assert.equal(pattern.test(number), false);
});
