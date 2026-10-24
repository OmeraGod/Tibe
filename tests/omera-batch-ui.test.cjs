/* Controller checks without a browser: import, batch submission and isolated preview. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
class Element {
  constructor(tag = 'div') {
    this.tag = tag; this.children = []; this.dataset = {}; this.value = ''; this.scrollTop = 0;
    this.classList = {toggle() {}};
  }
  append(...children) {this.children.push(...children);}
  replaceChildren(...children) {this.children = children;}
  addEventListener() {}
  querySelectorAll(selector) {return selector === '.queue-item' ? this.children.filter(child => child.className === 'queue-item') : [];}
  querySelector(selector) {return this.children.find(child => selector === 'details' && child.tag === 'details');}
  click() {}
}
(async () => {
  const elements = new Map(), calls = [], jobs = [];
  const element = id => {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id);
  };
  const context = {
    console, JSON, URLSearchParams, FormData, Map, Set,
    document: {hidden: false, getElementById: element, createElement: tag => new Element(tag),
      querySelectorAll: () => [{value: 'A'}, {value: 'B'}, {value: 'C'}]},
    addEventListener() {}, setTimeout() {return 1;}, clearTimeout() {},
    OmeraStudio: require('../assets/js/omera-studio-core.js'),
    TibeBackend: {ensure: async () => ({}), url: path => path, request: async (url, options = {}) => {
      const payload = options.body ? JSON.parse(options.body) : null;
      calls.push({url, payload});
      if (url === '/api/batch/jobs' && options.method === 'POST') {
        const created = payload.projects.flatMap((plan, i) => payload.variants.map(variant => ({
          id: String(jobs.length + i * 3 + variant.charCodeAt(0)).padStart(32, '0'), title: plan.title, variant,
          state: 'queued', duration: payload.preview ? 3 : 34, width: payload.preview ? 540 : 1080,
          height: payload.preview ? 960 : 1920, fps: payload.preview ? 30 : 60, progress: 0, message: 'Chờ', preview: !!payload.preview
        })));
        jobs.push(...created);
        return {ok: true, json: async () => ({ok: true, jobs: created})};
      }
      return {ok: true, json: async () => ({ok: true, jobs})};
    }}
  };
  context.window = context;
  element('batchProfile').value = 'production';
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(require.resolve('../assets/js/omera-batch-ui.js'), 'utf8'), context);
  await new Promise(resolve => setImmediate(resolve));
  element('loadSamples').onclick();
  assert.equal(element('planList').children.length, 5);
  assert.equal(JSON.parse(element('batchJsonText').value).projects.length, 5);
  await element('renderAll').onclick();
  const all = calls.find(call => call.url === '/api/batch/jobs' && call.payload);
  assert.equal(all.payload.projects.length, 5);
  assert.deepEqual(Array.from(all.payload.variants), ['A', 'B', 'C']);
  assert.equal(all.payload.profile, 'production');
  assert.equal(jobs.length, 15);
  assert.equal(calls.filter(call => call.url === '/api/batch/start').at(-1).payload.ids.length, 15);
  const preview = element('planList').children[0].children.at(-1).children[1];
  await preview.onclick();
  const last = calls.filter(call => call.url === '/api/batch/jobs' && call.payload).at(-1);
  assert.equal(last.payload.preview, true);
  assert.equal(last.payload.profile, 'draft');
  assert.equal(last.payload.variants.length, 1);
  assert.equal(calls.filter(call => call.url === '/api/batch/start').at(-1).payload.ids.length, 1);
  element('batchJsonText').value = '{invalid';
  await element('applyJson').onclick();
  assert.equal(element('planList').children.length, 5, 'bad JSON keeps the previously imported plans');
  assert.ok(element('batchStatus').textContent);
  console.log('Batch UI: five sample inputs submit 15 jobs, preview starts only its own job, invalid JSON preserves inputs.');
})().catch(error => {console.error(error); process.exitCode = 1;});
