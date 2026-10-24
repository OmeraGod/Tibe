/* Bridge Omera plans into the existing editable Tibe timeline. */
(function (root) {
  'use strict';
  let cached = null, cachedKey = '', firstFrame = null;
  function syncHelpers(timeline, original, library) {
    if (!original) return;
    const previous = new Map(timeline.filter(clip => clip.omeraHelper).map(clip => [clip.omeraParent + ':' + clip.mediaId, clip]));
    const primary = timeline.filter(clip => clip.omeraSceneId);
    const helpers = [];
    for (const clip of primary) {
      const scene = original.scenes.find(scene => scene.id === clip.omeraSceneId);
      if (!scene) continue;
      for (const id of new Set([scene.beforeId, scene.diagramId, scene.gearId, ...scene.widgets.map(widget => widget.mediaId)].filter(Boolean))) {
        if (id === clip.mediaId || library[id]?.type !== 'video') continue;
        const old = previous.get(clip.id + ':' + id);
        helpers.push(ClipCore.normalize({...old, id: old?.id || ClipCore.uid(), track: 'overlay', mediaId: id,
          omeraHelper: true, omeraParent: clip.id, title: 'Nguồn Bento', start: clip.start, duration: clip.duration,
          sourceIn: clip.sourceIn, speed: clip.speed, muted: true, opacity: 0}));
      }
    }
    const visible = timeline.filter(clip => !clip.omeraHelper);
    timeline.splice(0, timeline.length, ...visible, ...helpers);
  }
  function synchronize(original, timeline) {
    const primary = timeline.filter(clip => clip.omeraSceneId && !clip.hidden).sort((a, b) => a.start - b.start);
    const key = JSON.stringify(primary.map(clip => [clip.id, clip.start, clip.duration, clip.sourceIn, clip.speed, clip.title, clip.mediaId, clip.omeraCaption, clip.omeraLayout, clip.omeraSettings, clip.omeraGear]));
    if (cached && key === cachedKey && cached.seed === original.seed) return cached;
    const scenes = primary.map(clip => {
      const source = original.scenes.find(scene => scene.id === clip.omeraSceneId);
      if (!source) return null;
      const caption = clip.omeraCaption ?? clip.title;
      const tokens = caption.split(/\s+/).filter(Boolean);
      const words = caption === source.caption ? source.words.map(word => ({...word, start: word.start * clip.duration / source.duration, end: word.end * clip.duration / source.duration})) :
        tokens.map((text, index) => ({text, start: .1 + index * Math.max(.1, clip.duration - .2) / tokens.length, end: .1 + (index + 1) * Math.max(.1, clip.duration - .2) / tokens.length}));
      return {...source, id: clip.id, layout: clip.omeraLayout || source.layout, settings: clip.omeraSettings ?? source.settings, gear: clip.omeraGear ?? source.gear, start: clip.start, duration: clip.duration, sourceIn: clip.sourceIn, speed: clip.speed, mediaId: clip.mediaId, caption, words};
    }).filter(Boolean);
    const events = [];
    for (const scene of scenes) for (let time = 2.5, index = 0; time < scene.duration - .25; time += 2.5, index++) {
      events.push({time: scene.start + time, duration: .7, type: index % 2 ? 'hud' : 'microZoom', sceneId: scene.id});
    }
    cached = {...original, scenes, events, duration: Math.max(.1, ...scenes.map(scene => scene.start + scene.duration))};
    cachedKey = key; firstFrame = null;
    return cached;
  }
  function draw(ctx, original, timeline, library, time) {
    const spec = synchronize(original, timeline);
    if (!spec.scenes.length || !spec.scenes.some(scene => time >= scene.start && time < scene.start + scene.duration)) return false;
    const scene = OmeraStudio.currentScene(spec, time), sources = {};
    for (const id of new Set([scene.mediaId, scene.beforeId, scene.diagramId, scene.gearId, ...scene.widgets.map(widget => widget.mediaId)].filter(Boolean))) {
      const item = library[id];
      if (!item) continue;
      if (item.type === 'image') sources[id] = loadImage(item);
      else {
        const clip = timeline.find(clip => clip.mediaId === id && time >= clip.start && time < clip.start + clip.duration);
        sources[id] = clip && instances.get(clip.id)?.el;
      }
    }
    OmeraCanvas.drawFrame(ctx, spec, time, sources, {loopFrame: firstFrame});
    if (time < .01 && (!sources[scene.mediaId] || sources[scene.mediaId].complete !== false)) {
      firstFrame = document.createElement('canvas'); firstFrame.width = ctx.canvas.width; firstFrame.height = ctx.canvas.height;
      firstFrame.getContext('2d').drawImage(ctx.canvas, 0, 0);
    }
    return true;
  }
  root.OmeraEditor = {draw, syncHelpers};
  root.addEventListener('tibe:ready', async () => {
    const key = new URLSearchParams(location.search).get('batch');
    if (!key || !/^[a-f0-9]{32}$/.test(key)) return;
    try {
      const response = await TibeProjects.api('/api/batch/jobs/' + key + '/spec');
      TibeProjects.replaceProject(OmeraStudio.editableProject(response.spec));
      toast('Đã mở bản Omera riêng. Có thể cắt cảnh, đổi tư liệu, sửa phụ đề và bố cục trong bảng thuộc tính, thêm chữ/lớp phủ.');
    } catch (error) {toast(error.message);}
  }, {once: true});
})(window);