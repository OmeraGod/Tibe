/* Background frame worker. No browser/tab lifecycle is involved in rendering. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {once} = require('node:events');
const {createCanvas, loadImage, ImageData, GlobalFonts} = require('@napi-rs/canvas');
const Core = require('../assets/js/omera-studio-core.js');
const Renderer = require('../assets/js/omera-studio-canvas.js');
const ROOT = path.resolve(__dirname, '..');
Renderer.setCanvasFactory(createCanvas);
for (const [file, family] of [['PlusJakartaSans-Variable.ttf', 'Plus Jakarta Sans'], ['PlayfairDisplay-Variable.ttf', 'Playfair Display']]) {
  const font = path.join(ROOT, 'assets/fonts', file);
  if (!GlobalFonts.registerFromPath(font, family)) throw Error('Không nạp được font ' + family);
}
function report(value) { process.stdout.write(JSON.stringify(value) + '\n'); }
class VideoReader {
  constructor(asset, scene, width, height, fps) {
    if (asset.width && asset.height) {
      // Preserve the source framing; the compositor crops separately for each Bento pane.
      const scale = Math.min(1, height / Math.max(asset.width, asset.height));
      width = Math.max(2, Math.round(asset.width * scale / 2) * 2);
      height = Math.max(2, Math.round(asset.height * scale / 2) * 2);
    }
    this.width = width; this.height = height; this.chunk = null; this.offset = 0; this.error = '';
    this.process = spawn('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-threads', '1',
      '-ss', String(scene.sourceIn), '-stream_loop', '-1', '-i', asset.path,
      '-an', '-vf', `setpts=(PTS-STARTPTS)/${scene.speed},fps=${fps},scale=${width}:${height}:force_original_aspect_ratio=decrease,setsar=1`,
      '-t', String(scene.duration + 1 / fps), '-pix_fmt', 'rgba', '-f', 'rawvideo', 'pipe:1'],
      {windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']});
    this.process.on('error', error => {this.error = error.message;});
    this.process.stderr.on('data', chunk => {this.error = (this.error + chunk).slice(-4000);});
    this.iterator = this.process.stdout[Symbol.asyncIterator]();
    this.canvas = createCanvas(width, height);
  }
  async frame() {
    const pixels = Buffer.allocUnsafe(this.width * this.height * 4);
    let filled = 0;
    while (filled < pixels.length) {
      if (!this.chunk || this.offset >= this.chunk.length) {
        const next = await this.iterator.next();
        if (next.done) throw Error('Không giải mã đủ khung hình video: ' + this.error);
        this.chunk = next.value; this.offset = 0;
      }
      const take = Math.min(pixels.length - filled, this.chunk.length - this.offset);
      this.chunk.copy(pixels, filled, this.offset, this.offset + take);
      this.offset += take; filled += take;
    }
    this.canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pixels.buffer, pixels.byteOffset, pixels.length), this.width, this.height), 0, 0);
    this.canvas._omeraRevision = (this.canvas._omeraRevision || 0) + 1;
    return this.canvas;
  }
  async close() {
    if (this.process.exitCode === null) this.process.kill();
    this.process.stdout.destroy();
    if (this.process.exitCode === null) await Promise.race([once(this.process, 'close'), new Promise(resolve => setTimeout(resolve, 2000))]);
  }
}
async function render(job) {
  const {spec, assets, output, cancelFile} = job;
  const {width, height, fps, duration} = job;
  if (![270, 540, 1080].includes(width) || height !== width * 16 / 9 || ![24, 30, 60].includes(fps) || duration <= 0 || duration > 75) throw Error('Cấu hình khung hình không hợp lệ.');
  const canvas = createCanvas(width, height), ctx = canvas.getContext('2d');
  const first = createCanvas(width, height);
  const frames = Math.ceil(duration * fps);
  const images = new Map(), readers = new Map();
  let activeScene = null, encoderError = '';
  const encoder = spawn('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-video_size', `${width}x${height}`, '-framerate', String(fps), '-i', 'pipe:0',
    '-an', '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-c:v', 'libx264', '-threads', '4', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-map_metadata', '-1', '-map_chapters', '-1', '-frames:v', String(frames), '-movflags', '+faststart', output],
    {windowsHide: true, stdio: ['pipe', 'ignore', 'pipe']});
  encoder.stderr.on('data', chunk => {encoderError = (encoderError + chunk).slice(-6000);});
  encoder.stdin.on('error', error => {encoderError = error.message;});
  const completion = new Promise((resolve, reject) => {
    encoder.on('error', reject);
    encoder.on('close', code => code === 0 ? resolve() : reject(Error('Mã hóa video thất bại: ' + encoderError)));
  });
  completion.catch(() => {});
  try {
    for (let frame = 0; frame < frames; frame++) {
      if (cancelFile && fs.existsSync(cancelFile)) throw Error('Đã hủy tác vụ.');
      const time = frame / fps, scene = Core.currentScene(spec, time);
      if (scene.id !== activeScene) {
        for (const reader of readers.values()) await reader.close();
        readers.clear(); activeScene = scene.id;
      }
      const required = new Set([scene.mediaId, scene.beforeId, scene.diagramId, scene.gearId,
        ...scene.widgets.map(widget => widget.mediaId)].filter(Boolean));
      const sources = {};
      for (const id of required) {
        const asset = assets[id];
        if (!asset) throw Error('Không tìm thấy tư liệu ' + id);
        if (asset.type === 'video') {
          if (!readers.has(id)) readers.set(id, new VideoReader(asset, scene, width, height, fps));
          sources[id] = await readers.get(id).frame();
        } else {
          if (!images.has(id)) {
            images.set(id, await loadImage(asset.path));
            if (images.size > 12) images.delete(images.keys().next().value);
          }
          sources[id] = images.get(id);
        }
      }
      Renderer.drawFrame(ctx, spec, time, sources, {loopFrame: frame ? first : null});
      if (frame === 0) first.getContext('2d').drawImage(canvas, 0, 0);
      const data = ctx.getImageData(0, 0, width, height).data;
      if (!encoder.stdin.write(Buffer.from(data.buffer, data.byteOffset, data.byteLength))) await once(encoder.stdin, 'drain');
      if (frame % 15 === 0 || frame === frames - 1) report({state: 'rendering', frame: frame + 1, frames, progress: (frame + 1) / frames});
    }
    encoder.stdin.end(); await completion;
    report({state: 'encoded', frames, width, height, fps});
  } finally {
    for (const reader of readers.values()) await reader.close();
    if (encoder.exitCode === null) encoder.kill();
  }
}
async function main() {
  if (process.argv[2] === '--compile') {
    let data = ''; for await (const chunk of process.stdin) data += chunk;
    const request = JSON.parse(data), plan = request.plan;
    report({specs: (request.variants || ['A', 'B', 'C']).map((variant, index) => Core.compile(plan, variant, (request.seed || 1) + index, request.media || {}))});
  } else if (process.argv[2] === '--render') {
    const job = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
    await render(job);
  } else throw Error('Cần chọn chế độ compile hoặc render.');
}
main().catch(error => {report({state: 'error', error: error.message}); process.exitCode = 1;});