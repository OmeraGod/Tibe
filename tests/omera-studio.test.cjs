'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const {createCanvas, GlobalFonts} = require('@napi-rs/canvas');
const Core = require('../assets/js/omera-studio-core.js');
const Renderer = require('../assets/js/omera-studio-canvas.js');
Renderer.setCanvasFactory(createCanvas);
GlobalFonts.registerFromPath(path.join(__dirname, '../assets/fonts/PlusJakartaSans-Variable.ttf'), 'Plus Jakarta Sans');
GlobalFonts.registerFromPath(path.join(__dirname, '../assets/fonts/PlayfairDisplay-Variable.ttf'), 'Playfair Display');
function image(left, right) {
  const canvas = createCanvas(540, 960), ctx = canvas.getContext('2d');
  const fill = ctx.createLinearGradient(0, 0, 540, 960);
  fill.addColorStop(0, left); fill.addColorStop(1, right); ctx.fillStyle = fill; ctx.fillRect(0, 0, 540, 960);
  ctx.fillStyle = '#e7edce'; ctx.fillRect(150, 250, 180, 420);
  return canvas;
}
const sources = {after: image('#a3cce2', '#c99f78'), before: image('#6d86a2', '#b7b2a7')};
const plan = {id: 'test', title: 'Kiểm tra Omera', hook: 'Một góc máy mới cho video',
  media: {after: {type: 'image', url: 'assets/demo/coast-hd.png'}, before: {type: 'image', url: 'assets/demo/cliff-hd.png'}},
  scenes: [{mediaId: 'after', beforeId: 'before', duration: 4, caption: 'Đặt nguồn sáng bên cạnh chủ thể để khung hình có chiều sâu', analysis: 'Quan sát bóng đổ và giữ hậu cảnh gọn gàng.', settings: 'Ánh sáng 45° · Khóa EV', gear: 'Tripod và đèn LED'}]};
const variants = ['A', 'B', 'C'].map(variant => Core.compile(plan, variant, 42));
assert.deepEqual(variants.map(spec => spec.duration), [34, 42, 68]);
assert.ok(variants[2].scenes.some(scene => scene.analysisPass && scene.speed === .6));
assert.ok(variants[1].cues.some(cue => cue.time === 14.8 && cue.source === 'bell_ding'));
assert.ok(variants[0].events.length >= 10);
assert.equal(Core.visualState(variants[0], 0).zoom, 1.25);
assert.ok(Math.abs(Core.visualState(variants[0], .4).zoom - 1) < 1e-6);
assert.equal(Core.spring(0), 0); assert.ok(Math.abs(Core.spring(1) - 1) < .001);
const frame = (spec, time, loopFrame) => {
  const output = createCanvas(270, 480);
  Renderer.drawFrame(output.getContext('2d'), spec, time, sources, {loopFrame});
  return output;
};
const hash = output => crypto.createHash('sha256').update(output.toBuffer('image/png')).digest('hex');
for (const layout of Core.LAYOUTS) {
  const spec = Core.compile({...plan, scenes: [{...plan.scenes[0], layout}]}, 'A', 42);
  const first = frame(spec, 0), later = frame(spec, 1.1);
  assert.equal(hash(first), hash(frame(spec, 0)), layout + ' deterministic first frame');
  assert.notEqual(hash(first), hash(later), layout + ' has motion');
  const pixels = first.getContext('2d').getImageData(0, 0, 270, 480).data;
  let dark = 0;
  for (let i = 0; i < pixels.length; i += 4) {assert.equal(pixels[i + 3], 255); if (pixels[i] + pixels[i + 1] + pixels[i + 2] < 40) dark++;}
  assert.ok(dark / (270 * 480) < .1, layout + ' opens with a visible subject');
}
for (const type of Core.WIDGETS) {
  const spec = Core.compile({...plan, scenes: [{...plan.scenes[0], widgets: [{type, start: 0, duration: 3}]}]}, 'B', 42);
  assert.notEqual(hash(frame(spec, .3)), hash(frame(spec, 1.3)), type + ' animates');
  assert.equal(hash(frame(spec, 1.3)), hash(frame(spec, 1.3)), type + ' is deterministic');
}
const first = frame(variants[0], 0), last = frame(variants[0], variants[0].duration - .00001, first);
const a = first.getContext('2d').getImageData(0, 0, 270, 480).data;
const b = last.getContext('2d').getImageData(0, 0, 270, 480).data;
assert.ok(a.every((value, index) => Math.abs(value - b[index]) <= 1), 'Shorts tail blends back to the exact opening frame');
const wordScene = {...variants[0].scenes[0], words: Array.from({length: 8}, (_, i) => ({text: 'từ' + i, start: i, end: i + 1}))};
assert.deepEqual(Core.captionAt(wordScene, 4.1).words.map(word => word.text), ['từ4', 'từ5', 'từ6', 'từ7']);
assert.equal(Core.captionAt(wordScene, 4.1).active, 0);
const editable = Core.editableProject(variants[1]);
assert.ok(editable.clips.some(clip => clip.omeraSceneId));
assert.ok(editable.clips.some(clip => clip.audioRole === 'sfx'));
assert.throws(() => Core.compile({...plan, scenes: []}));
assert.throws(() => Core.compile({...plan, scenes: [{mediaId: 'unknown'}]}));
assert.throws(() => Core.compile({...plan, scenes: [{mediaId: 'after', widgets: [{type: 'ABCompareSlider'}]}]}));
const preview = frame(variants[1], 15);
require('node:fs').mkdirSync(path.join(__dirname, '../docs/previews'), {recursive: true});
require('node:fs').writeFileSync(path.join(__dirname, '../docs/previews/omera-bento-frame.png'), preview.toBuffer('image/png'));
console.log('Omera: 4 layouts, 4 widgets, 3 variants, visible hook, 2.5-second events, word groups, loop and deterministic pixels passed.');
// Explicit word timestamps stay in seconds; analysis text gets its own timings.
const precise = Core.compile({...plan, scenes: [{...plan.scenes[0], words: [{text: 'Đẹp', start: .2, end: .7}]}]}, 'C');
assert.equal(precise.scenes[0].words[0].end, .7);
assert.equal(precise.scenes[1].wordTimingProvided, false);
assert.throws(() => Core.compile({...plan, scenes: [{...plan.scenes[0], words: {}}]}));
// Helper sources follow split, retime and delete rather than remaining stale overlays.
const vm = require('node:vm'), fs = require('node:fs');
const editorContext = {ClipCore: require('../assets/js/editor-core.js'), addEventListener() {}};
editorContext.window = editorContext;
vm.createContext(editorContext);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/js/omera-studio-editor.js'), 'utf8'), editorContext);
const spec = Core.compile({...plan, media: {...plan.media, before: {type: 'video', url: '/workspace/uploads/example.mp4'}},
  scenes: [{...plan.scenes[0], layout: 'BENTO_SPLIT_VERTICAL'}]}, 'A');
const timeline = Core.editableProject(spec).clips;
editorContext.OmeraEditor.syncHelpers(timeline, spec, spec.media);
const primary = timeline.find(clip => clip.omeraSceneId);
primary.start = 3; primary.duration = 5; primary.sourceIn = 2;
timeline.push({...primary, id: 'second', start: 9});
editorContext.OmeraEditor.syncHelpers(timeline, spec, spec.media);
const helpers = timeline.filter(clip => clip.omeraHelper);
assert.equal(helpers.length, 2);
assert.ok(helpers.some(clip => clip.omeraParent === 'second' && clip.start === 9 && clip.sourceIn === 2));
timeline.splice(timeline.findIndex(clip => clip.id === 'second'), 1);
editorContext.OmeraEditor.syncHelpers(timeline, spec, spec.media);
assert.equal(timeline.filter(clip => clip.omeraHelper).length, 1);
console.log('Editor helper retime/split/delete and explicit word timing regressions passed.');
