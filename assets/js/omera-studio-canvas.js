/* Cinema-glass Canvas compositor shared by editor preview and background export. */
(function (root) {
  'use strict';
  const Core = typeof module !== 'undefined' ? require('./omera-studio-core.js') : root.OmeraStudio;
  let canvasFactory = null;
  const caches = new WeakMap();
  const grades = new WeakMap();
  const graded = new WeakSet();
  function setCanvasFactory(factory) { canvasFactory = factory; }
  function buffer(owner, key, width, height) {
    let cache = caches.get(owner);
    if (!cache) { cache = new Map(); caches.set(owner, cache); }
    let canvas = cache.get(key);
    if (!canvas) { canvas = canvasFactory ? canvasFactory(width, height) : root.document.createElement('canvas'); cache.set(key, canvas); }
    if (canvas.width !== width || canvas.height !== height) {canvas.width = width; canvas.height = height; canvas._omeraReady = false;}
    return canvas;
  }
  function rounded(ctx, x, y, width, height, radius = 28) {
    ctx.beginPath(); ctx.roundRect(x, y, width, height, radius);
  }
  function prepareImage(source) {
    if (!source || graded.has(source)) return source;
    const width = source.videoWidth || source.naturalWidth || source.width;
    const height = source.videoHeight || source.naturalHeight || source.height;
    if (!width || !height) return source;
    const revision = source.currentTime ?? source._omeraRevision ?? 0;
    let cache = grades.get(source);
    if (cache && cache.revision === revision && cache.width === width && cache.height === height) return cache.canvas;
    const ratio = Math.min(1, 2160 / Math.max(width, height));
    if (!cache) cache = {canvas: canvasFactory ? canvasFactory(1, 1) : root.document.createElement('canvas')};
    const canvas = cache.canvas;
    canvas.width = Math.max(1, Math.round(width * ratio)); canvas.height = Math.max(1, Math.round(height * ratio));
    const context = canvas.getContext('2d');
    context.filter = 'contrast(1.06) saturate(1.10)'; context.drawImage(source, 0, 0, canvas.width, canvas.height); context.filter = 'none';
    cache.revision = revision; cache.width = width; cache.height = height;
    grades.set(source, cache); graded.add(canvas);
    return canvas;
  }
  function cover(ctx, source, rectangle, zoom = 1, panX = 0, panY = 0) {
    const {x, y, w, h} = rectangle;
    const width = source?.videoWidth || source?.naturalWidth || source?.width;
    const height = source?.videoHeight || source?.naturalHeight || source?.height;
    ctx.save(); rounded(ctx, x, y, w, h); ctx.clip();
    if (width && height) {
      const scale = Math.max(w / width, h / height) * zoom;
      if (!graded.has(source)) ctx.filter = 'contrast(1.06) saturate(1.10)';
      ctx.drawImage(source, x + (w - width * scale) / 2 + panX, y + (h - height * scale) / 2 + panY, width * scale, height * scale);
    } else {
      const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
      gradient.addColorStop(0, '#b5dce2'); gradient.addColorStop(1, '#eacbb8');
      ctx.fillStyle = gradient; ctx.fillRect(x, y, w, h);
      label(ctx, 'Thêm ảnh hoặc video', x + w / 2, y + h / 2, 34, '#1c4654', 'center');
    }
    ctx.restore();
  }
  function label(ctx, value, x, y, size = 38, color = '#f8fafc', align = 'left', family = 'Plus Jakarta Sans') {
    ctx.font = `700 ${size}px "${family}", "Segoe UI", sans-serif`;
    ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.fillText(String(value), x, y);
  }
  function wrapped(ctx, value, x, y, width, size = 42, color = '#f8fafc', maxLines = 3) {
    ctx.font = `700 ${size}px "Plus Jakarta Sans", "Segoe UI", sans-serif`;
    const lines = [];
    for (const word of String(value).split(/\s+/)) {
      const index = lines.length - 1;
      if (index < 0 || ctx.measureText(lines[index] + ' ' + word).width > width) lines.push(word);
      else lines[index] += ' ' + word;
    }
    const displayed = lines.slice(0, maxLines);
    if (lines.length > maxLines) displayed[maxLines - 1] = displayed[maxLines - 1].replace(/\s+\S*$/, '') + '…';
    displayed.forEach((line, index) => label(ctx, line, x, y + index * size * 1.3, size, color));
    return displayed.length * size * 1.3;
  }
  function glass(ctx, key, rectangle, tint = 'rgba(15,23,42,.55)') {
    const {x, y, w, h} = rectangle;
    const sourceDensity = ctx.canvas.width / 1080;
    const density = Math.max(.1, sourceDensity * .5);
    const sample = buffer(ctx.canvas, 'glass_' + key, Math.max(1, Math.ceil(w * density)), Math.max(1, Math.ceil(h * density)));
    const sc = sample.getContext('2d');
    sc.clearRect(0, 0, sample.width, sample.height);
    sc.filter = `blur(${18 * density}px)`;
    sc.drawImage(ctx.canvas, x * sourceDensity, y * sourceDensity, w * sourceDensity, h * sourceDensity, 0, 0, sample.width, sample.height);
    sc.filter = 'none';
    ctx.save();
    const shadowKey = 'shadow_' + Math.ceil(w) + '_' + Math.ceil(h);
    const shadow = buffer(ctx.canvas, shadowKey, Math.ceil((w + 160) * density), Math.ceil((h + 160) * density));
    if (!shadow._omeraReady) {
      const sc = shadow.getContext('2d'); sc.scale(density, density);
      sc.shadowColor = 'rgba(0,0,0,.45)'; sc.shadowBlur = 50; sc.shadowOffsetY = 20;
      sc.fillStyle = 'rgba(15,23,42,.2)'; rounded(sc, 80, 80, w, h); sc.fill(); shadow._omeraReady = true;
    }
    ctx.drawImage(shadow, x - 80, y - 80, w + 160, h + 160);
    rounded(ctx, x, y, w, h); ctx.fillStyle = tint; ctx.fill();
    ctx.save(); rounded(ctx, x, y, w, h); ctx.clip(); ctx.drawImage(sample, x, y, w, h);
    ctx.fillStyle = tint; ctx.fillRect(x, y, w, h); ctx.restore();
    rounded(ctx, x, y, w, h); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(56,189,248,.35)'; ctx.stroke();
    ctx.restore();
  }
  function pill(ctx, text, x, y, color = '#2dd4bf', foreground = '#103c3e', size = 30) {
    ctx.font = `800 ${size}px "Plus Jakarta Sans", "Segoe UI"`;
    const width = ctx.measureText(text).width + 48;
    ctx.fillStyle = color; rounded(ctx, x, y, width, size + 34, 20); ctx.fill();
    label(ctx, text, x + 24, y + (size + 34) / 2, size, foreground);
    return width;
  }
  function diagram(ctx, rectangle, time) {
    const {x, y, w, h} = rectangle;
    glass(ctx, 'diagram', rectangle);
    label(ctx, 'SƠ ĐỒ GÓC MÁY', x + 28, y + 37, 26, '#b4f2e7');
    const cx = x + w * .5, cy = y + h * .55;
    ctx.strokeStyle = '#8bccd2'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, 27, 0, Math.PI * 2); ctx.stroke();
    const angle = -.8 + .1 * Math.sin(time * 1.4), lx = cx + Math.cos(angle) * w * .3, ly = cy + Math.sin(angle) * h * .3;
    ctx.fillStyle = '#fbbf24'; rounded(ctx, lx - 18, ly - 18, 36, 36, 6); ctx.fill();
    ctx.setLineDash([8, 9]); ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(cx, cy); ctx.stroke(); ctx.setLineDash([]);
    rounded(ctx, cx - 28, y + h - 65, 56, 35, 8); ctx.stroke();
    label(ctx, 'Minh họa ánh sáng 45°', x + 26, y + h - 22, 19, '#d1e2ea');
  }
  const Widgets = {
    ABCompareSlider(ctx, data, env) {
      const {time, sources, scene} = env;
      const area = {x: 72, y: 260, w: 936, h: 1160};
      cover(ctx, sources[scene.beforeId], area);
      const progress = .5 - .5 * Math.cos(Math.PI * Core.clamp(time / data.duration));
      ctx.save(); ctx.beginPath(); ctx.rect(area.x, area.y, area.w * progress, area.h); ctx.clip(); cover(ctx, sources[scene.mediaId], area); ctx.restore();
      const x = area.x + progress * area.w;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x, area.y); ctx.lineTo(x, area.y + area.h); ctx.stroke();
      ctx.fillStyle = '#2dd4bf'; ctx.beginPath(); ctx.arc(x, area.y + area.h / 2, 33, 0, Math.PI * 2); ctx.fill();
      label(ctx, '↔', x, area.y + area.h / 2, 35, '#123b3a', 'center');
      pill(ctx, 'BEFORE', area.x + 18, area.y + 18, '#fff');
      pill(ctx, 'OMERA AFTER', area.x + area.w - 295, area.y + 18);
    },
    PhoneGridHUD(ctx, data, env) {
      const {time, spec} = env;
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2;
      for (let n = 1; n < 3; n++) {
        ctx.beginPath(); ctx.moveTo(n * 360, 180); ctx.lineTo(n * 360, 1540); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(54, 180 + n * 1360 / 3); ctx.lineTo(1026, 180 + n * 1360 / 3); ctx.stroke();
      }
      const focus = 1 + .03 * Math.sin(time * 4);
      ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 4; rounded(ctx, 540 - 90 * focus, 850 - 90 * focus, 180 * focus, 180 * focus, 16); ctx.stroke();
      glass(ctx, 'camera', {x: 230, y: 1480, w: 620, h: 90});
      ['0.5×', '1×', '2×', '3×'].forEach((zoom, index) => label(ctx, zoom, 310 + index * 150, 1525, 30, index === Math.floor(time / 2) % 4 ? '#2dd4bf' : '#ffffff', 'center'));
      const evY = 650 + Math.sin(time) * 90;
      ctx.strokeStyle = '#fbbf24'; ctx.beginPath(); ctx.moveTo(930, 560); ctx.lineTo(930, 950); ctx.stroke();
      label(ctx, '☀', 930, evY, 44, '#fbbf24', 'center');
      if (spec.meter?.length) {
        const level = spec.meter[Math.min(spec.meter.length - 1, Math.floor(env.globalTime / spec.duration * spec.meter.length))];
        label(ctx, 'VOICE', 80, 1380, 20, '#d3e7e9');
        for (let n = 0; n < 12; n++) {ctx.fillStyle = n / 12 < level ? '#2dd4bf' : '#73838a'; ctx.fillRect(80 + n * 23, 1410 - n * 3, 13, 24 + n * 3);}
      }
      ctx.restore();
    },
    FollowPulseToast(ctx, data, env) {
      const progress = Core.spring(env.time + .02), activated = env.time >= .8;
      const rectangle = {x: 100, y: 1030 + 80 * (1 - progress), w: 880, h: 170};
      glass(ctx, 'follow', rectangle, activated ? 'rgba(8,79,73,.78)' : 'rgba(15,23,42,.65)');
      label(ctx, activated ? '✓ Đang theo dõi' : '+ Theo dõi ' + env.spec.brand, 148, rectangle.y + 64, 40, activated ? '#5eead4' : '#ffffff');
      label(ctx, data.title || 'Góc máy đẹp hơn · Mỗi ngày', 148, rectangle.y + 122, 25, '#c7e8eb');
      const scale = activated ? 1 + .12 * Math.exp(-(env.time - .8) * 5) * Math.sin((env.time - .8) * 16) : 1;
      ctx.save(); ctx.translate(899, rectangle.y + 75); ctx.scale(scale, scale); label(ctx, activated ? '✓' : '+', 0, 0, 46, '#2dd4bf', 'center'); ctx.restore();
    },
    GearShowcaseCard(ctx, data, env) {
      const rectangle = {x: 72, y: 1060 + 70 * (1 - Core.spring(env.time + .02)), w: 936, h: 535};
      glass(ctx, 'gear', rectangle);
      const picture = env.sources[data.mediaId || env.scene.gearId];
      if (picture) cover(ctx, picture, {x: rectangle.x + 24, y: rectangle.y + 96, w: 270, h: 285});
      else diagram(ctx, {x: rectangle.x + 24, y: rectangle.y + 96, w: 270, h: 285}, env.time);
      label(ctx, data.title || 'GÓC MÁY & THIẾT BỊ', rectangle.x + 28, rectangle.y + 46, 31, '#b0f1e6');
      wrapped(ctx, env.scene.gear, rectangle.x + 330, rectangle.y + 152, 550, 38, '#ffffff');
      wrapped(ctx, data.benefit || env.spec.gift, rectangle.x + 330, rectangle.y + 275, 550, 28, '#d8e7ed');
      label(ctx, '↓ Sơ đồ và gợi ý ở bình luận', 540, rectangle.y + 456 + 6 * Math.sin(env.time * 4), 31, '#fbbf24', 'center');
    }
  };
  function drawCaption(ctx, caption, color) {
    if (!caption) return;
    ctx.font = '800 48px "Plus Jakarta Sans", "Segoe UI"';
    const widths = caption.words.map(word => ctx.measureText(word.text).width + 36);
    const total = widths.reduce((sum, width) => sum + width, 0) + (widths.length - 1) * 10;
    const scale = Math.min(1, 940 / total);
    ctx.save(); ctx.translate(540 - total * scale / 2, 1610); ctx.scale(scale, scale);
    let x = 0;
    caption.words.forEach((word, index) => {
      const active = index === caption.active, width = widths[index];
      ctx.save(); ctx.translate(x + width / 2, 0); ctx.scale(active ? 1.12 : 1, active ? 1.12 : 1);
      ctx.fillStyle = active ? color : 'rgba(15,23,42,.8)'; rounded(ctx, -width / 2, -38, width, 76, 23); ctx.fill();
      label(ctx, word.text, 0, 0, 48, active ? '#103734' : '#ffffff', 'center'); ctx.restore(); x += width + 10;
    });
    ctx.restore();
  }
  function grain(ctx, spec, time) {
    const tile = buffer(ctx.canvas, 'grain', 72, 72), gc = tile.getContext('2d');
    const image = gc.createImageData(72, 72); let seed = (spec.seed + Math.floor(time * 24) * 1664525) >>> 0;
    for (let i = 0; i < image.data.length; i += 4) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const v = seed >>> 24; image.data[i] = v; image.data[i + 1] = v; image.data[i + 2] = v; image.data[i + 3] = 7;
    }
    gc.putImageData(image, 0, 0); ctx.fillStyle = ctx.createPattern(tile, 'repeat'); ctx.fillRect(0, 0, 1080, 1920);
  }
  function drawFrame(ctx, spec, time, sources = {}, options = {}) {
    sources = Object.fromEntries(Object.entries(sources).map(([id, source]) => [id, prepareImage(source)]));
    const state = Core.visualState(spec, time), {scene, local} = state;
    ctx.save(); ctx.setTransform(ctx.canvas.width / 1080, 0, 0, ctx.canvas.height / 1920, 0, 0);
    ctx.clearRect(0, 0, 1080, 1920);
    ctx.fillStyle = '#d8e8eb'; ctx.fillRect(0, 0, 1080, 1920);
    cover(ctx, sources[scene.mediaId], {x: -12, y: -12, w: 1104, h: 1944}, state.zoom * 1.012, state.panX, state.panY);
    const cardOpacity = .2 + .8 * Core.envelope(local, scene.duration);
    ctx.save(); ctx.globalAlpha = cardOpacity;
    if (scene.layout === 'BENTO_SPLIT_VERTICAL') {
      const top = {x: 72, y: 145, w: 936, h: 740}, bottom = {x: 72, y: 915, w: 936, h: 740};
      cover(ctx, sources[scene.beforeId], top, state.zoom); cover(ctx, sources[scene.mediaId], bottom, state.zoom);
      for (const rectangle of [top, bottom]) {rounded(ctx, rectangle.x, rectangle.y, rectangle.w, rectangle.h); ctx.strokeStyle = '#80e5e4'; ctx.lineWidth = 2; ctx.stroke();}
      pill(ctx, 'BEFORE', 98, 170, '#ffffff'); pill(ctx, 'OMERA AFTER', 98, 1000);
    } else if (scene.layout === 'BENTO_PIP_DIAGRAM') {
      if (scene.diagramId) {glass(ctx, 'pip', {x: 570, y: 1060, w: 440, h: 400}); cover(ctx, sources[scene.diagramId], {x: 590, y: 1130, w: 400, h: 300});}
      else diagram(ctx, {x: 570, y: 1060, w: 440, h: 400}, local);
    } else if (scene.layout === 'BENTO_TRIPLE_GEAR') {
      cover(ctx, sources[scene.mediaId], {x: 72, y: 140, w: 936, h: 1120}, state.zoom);
      glass(ctx, 'settings', {x: 72, y: 1290, w: 452, h: 250});
      label(ctx, 'THÔNG SỐ', 100, 1335, 25, '#a8f2e8'); wrapped(ctx, scene.settings, 100, 1400, 390, 30);
      glass(ctx, 'equipment', {x: 548, y: 1290, w: 460, h: 250});
      if (scene.gearId) cover(ctx, sources[scene.gearId], {x: 568, y: 1310, w: 160, h: 205});
      wrapped(ctx, scene.gear, scene.gearId ? 750 : 580, 1370, scene.gearId ? 220 : 390, 29);
    } else {
      glass(ctx, 'hero', {x: 72, y: 1240, w: 936, h: 270});
      label(ctx, 'OMERA NOTES', 108, 1290, 24, '#9de8e2'); wrapped(ctx, scene.settings, 108, 1370, 850, 40);
    }
    ctx.restore();
    if (scene.analysisPass) {
      const source = sources[scene.mediaId], size = source?.videoWidth || source?.naturalWidth || source?.width;
      if (size) {
        ctx.save(); const x = 790 + Math.sin(local) * 25, y = 620;
        ctx.beginPath(); ctx.arc(x, y, 155, 0, Math.PI * 2); ctx.clip();
        cover(ctx, source, {x: x - 155, y: y - 155, w: 310, h: 310}, 2.2); ctx.restore();
        ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x, y, 155, 0, Math.PI * 2); ctx.stroke();
      }
      pill(ctx, '0.6× · PHÂN TÍCH CHẬM', 72, 150, '#fbbf24');
    }
    const env = {sources, spec, scene, time: local, globalTime: time};
    if (state.showHUD) Widgets.PhoneGridHUD(ctx, {}, env);
    for (const widget of scene.widgets) {
      const elapsed = local - widget.start;
      if (elapsed < 0 || elapsed >= widget.duration) continue;
      ctx.save(); ctx.globalAlpha = Core.envelope(elapsed, widget.duration);
      Widgets[widget.type](ctx, widget, {...env, time: elapsed}); ctx.restore();
    }
    if (time < 3) {
      const alpha = Core.clamp((3 - time) / .25); ctx.save(); ctx.globalAlpha = alpha;
      glass(ctx, 'hook', {x: 78, y: 720, w: 924, h: 250}, 'rgba(255,255,255,.9)');
      wrapped(ctx, spec.hook, 115, 780, 850, 53, '#153b43', 3); ctx.restore();
    }
    if (spec.variant === 'B' && time >= 14 && time < 17) {
      ctx.save(); ctx.globalAlpha = Core.envelope(time - 14, 3); Widgets.FollowPulseToast(ctx, {}, {...env, time: time - 14}); ctx.restore();
    }
    if (spec.variant === 'B' && time >= spec.duration - 6) {
      ctx.save(); ctx.globalAlpha = Core.envelope(time - spec.duration + 6, 6); Widgets.GearShowcaseCard(ctx, {}, {...env, time: time - spec.duration + 6}); ctx.restore();
    }
    if (spec.variant === 'A' && time > spec.duration - 3 && time < spec.duration - .7) {
      const elapsed = time - spec.duration + 3;
      ctx.save(); ctx.globalAlpha = Core.envelope(elapsed, 2.3);
      pill(ctx, '+ Subscribe · ' + spec.brand, 240, 1370 + 20 * (1 - Core.spring(elapsed)), '#ffffff', '#1b4c50', 32); ctx.restore();
    }
    drawCaption(ctx, state.caption, spec.captionColor);
    label(ctx, spec.brand, 74, 85, 29, '#ffffff', 'left', 'Playfair Display');
    if (state.flash) {ctx.fillStyle = `rgba(255,248,227,${state.flash})`; ctx.fillRect(0, 0, 1080, 1920);}
    grain(ctx, spec, time);
    if (spec.variant === 'A' && options.loopFrame && time > spec.duration - .6) {
      ctx.save(); ctx.globalAlpha = Core.hookEase((time - spec.duration + .6) / .6);
      ctx.drawImage(options.loopFrame, 0, 0, 1080, 1920); ctx.restore();
    }
    ctx.restore();
    return state;
  }
  const api = {drawFrame, Widgets, setCanvasFactory, prepareImage, cover, glass};
  if (typeof module !== 'undefined') module.exports = api;
  else root.OmeraCanvas = api;
})(typeof window === 'undefined' ? globalThis : window);