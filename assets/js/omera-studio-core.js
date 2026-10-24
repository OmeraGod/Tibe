/* Omera production plans and deterministic motion. Shared by browser and worker. */
(function (root) {
  'use strict';
  const VERSION = 1;
  const LAYOUTS = ['BENTO_SPLIT_VERTICAL', 'BENTO_PIP_DIAGRAM', 'BENTO_TRIPLE_GEAR', 'BENTO_HERO_GLASS'];
  const WIDGETS = ['ABCompareSlider', 'PhoneGridHUD', 'FollowPulseToast', 'GearShowcaseCard'];
  const VARIANTS = {
    A: {name: 'Shorts Loop', filename: 'Variant_A_Shorts_Loop', duration: 34, min: 32, max: 36},
    B: {name: 'Reels Follow', filename: 'Variant_B_Reels_FollowGate', duration: 42, min: 38, max: 45},
    C: {name: 'WatchTime Breakdown', filename: 'Variant_C_WatchTime_65s', duration: 68, min: 65, max: 75}
  };
  const clone = value => JSON.parse(JSON.stringify(value));
  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  function number(value, fallback, min, max, label) {
    const result = Number(value ?? fallback);
    if (!Number.isFinite(result) || result < min || result > max) throw Error(label + ' không hợp lệ.');
    return result;
  }
  function text(value, fallback = '', limit = 500) {
    if (value == null) return fallback;
    if (typeof value !== 'string' || value.length > limit) throw Error('Nội dung chữ vượt giới hạn.');
    return value.trim();
  }
  function spring(seconds, frequency = 18, damping = .72) {
    if (seconds <= 0) return 0;
    const wd = frequency * Math.sqrt(1 - damping * damping);
    return 1 - Math.exp(-damping * frequency * seconds) *
      (Math.cos(wd * seconds) + damping * frequency / wd * Math.sin(wd * seconds));
  }
  function hookEase(progress) {
    const x = clamp(progress);
    if (x === 0 || x === 1) return x;
    const bezier = (t, a, b) => 3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t;
    let lo = 0, hi = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (bezier(mid, .16, .3) < x) lo = mid;
      else hi = mid;
    }
    return bezier((lo + hi) / 2, 1, 1);
  }
  function envelope(local, duration) {
    return clamp(spring(local + .012)) * clamp(spring(Math.max(0, duration - local)));
  }
  function mediaReference(id, media, optional = false, audio = false) {
    if (!id && optional) return null;
    const item = media[id];
    if (!item || !(audio ? ['audio', 'video'] : ['image', 'video']).includes(item.type)) {
      throw Error('Chưa gán đúng tư liệu: ' + String(id || '(trống)'));
    }
    return id;
  }
  function validate(input, library = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Kịch bản cần là một đối tượng JSON.');
    const media = {...library, ...(input.media || {})};
    if (!Array.isArray(input.scenes) || input.scenes.length < 1 || input.scenes.length > 40) throw Error('Mỗi kịch bản cần từ 1 đến 40 cảnh.');
    const title = text(input.title ?? input.name, 'Video Omera', 120);
    const scenes = input.scenes.map((scene, index) => {
      if (!scene || typeof scene !== 'object') throw Error('Cảnh không hợp lệ.');
      const layout = scene.layout || input.layout || 'BENTO_HERO_GLASS';
      if (!LAYOUTS.includes(layout)) throw Error('Bố cục Bento chưa hỗ trợ: ' + layout);
      const mediaId = mediaReference(scene.mediaId, media);
      const beforeId = mediaReference(scene.beforeId, media, layout !== 'BENTO_SPLIT_VERTICAL');
      if (scene.widgets != null && !Array.isArray(scene.widgets)) throw Error('widgets cần là một mảng.');
      const widgets = (scene.widgets || []).map(widget => {
        if (!widget || !WIDGETS.includes(widget.type)) throw Error('Widget chưa hỗ trợ.');
        const start = number(widget.start, 0, 0, 600, 'Thời điểm widget');
        const duration = number(widget.duration, 3, .2, 120, 'Thời lượng widget');
        return {...clone(widget), start, duration, title: text(widget.title, '', 180)};
      });
      if (widgets.some(widget => widget.type === 'ABCompareSlider') && !beforeId) throw Error('ABCompareSlider cần tư liệu beforeId.');
      for (const widget of widgets) if (widget.mediaId) mediaReference(widget.mediaId, media);
      if (widgets.length > 12) throw Error('Tối đa 12 widget trong một cảnh.');
      if (scene.words != null && !Array.isArray(scene.words)) throw Error('words cần là một mảng mốc từ.');
      const words = Array.isArray(scene.words) ? scene.words.map(word => ({
        text: text(word.text, '', 80), start: number(word.start, 0, 0, 600, 'Mốc từ'),
        end: number(word.end, .2, 0, 600, 'Mốc cuối từ')
      })) : null;
      if (words && (words.length > 400 || words.some((w, i) => !w.text || w.end <= w.start || (i && w.start < words[i - 1].end)))) throw Error('Mốc từ cần tăng dần, không chồng nhau.');
      return {
        id: 'scene_' + index, mediaId, beforeId,
        diagramId: mediaReference(scene.diagramId, media, true),
        gearId: mediaReference(scene.gearId, media, true), layout,
        duration: number(scene.duration, 4, .6, 120, 'Thời lượng cảnh'),
        sourceIn: number(scene.sourceIn, 0, 0, 21600, 'Điểm vào video'),
        speed: number(scene.speed, 1, .25, 4, 'Tốc độ cảnh'),
        caption: text(scene.caption ?? scene.text, '', 500),
        analysis: text(scene.analysis, '', 500),
        wordTimingProvided: !!words?.length,
        settings: text(scene.settings, 'Ánh sáng · Bố cục · Chuyển động', 180),
        gear: text(scene.gear, 'Thiết bị của bạn', 120), words, widgets
      };
    });
    const narration = input.narration || {};
    const narrationId = mediaReference(narration.mediaId, media, true, true);
    const musicId = mediaReference(input.musicId, media, true, true);
    return {
      format: 'tibe-omera-plan', version: VERSION,
      id: text(input.id, 'omera', 80), title, brand: text(input.brand, 'Omera Studio', 60),
      hook: text(input.hook, scenes[0].caption || title, 160),
      gift: text(input.gift, 'Sơ đồ góc máy · Gợi ý dụng cụ', 180),
      media: clone(media), scenes, musicId,
      narration: {mediaId: narrationId, text: text(narration.text, '', 5000), voice: text(narration.voice, 'Hải Đăng', 100), generate: narration.generate === true},
      durations: Object.fromEntries(Object.entries(VARIANTS).map(([key, v]) => [key, number(input.durations?.[key], v.duration, v.min, v.max, 'Thời lượng ' + key)])),
      captionColor: input.captionColor === '#FBBF24' ? '#FBBF24' : '#2DD4BF'
    };
  }
  function wordsFor(scene) {
    if (scene.words?.length) return scene.words;
    const tokens = scene.caption.split(/\s+/).filter(Boolean);
    const span = Math.max(.1, scene.duration - .3);
    return tokens.map((token, i) => ({text: token, start: .1 + i * span / tokens.length, end: .1 + (i + 1) * span / tokens.length}));
  }
  function compile(input, variant = 'A', seed = 1, library = {}) {
    const plan = validate(input, library);
    const preset = VARIANTS[variant];
    if (!preset) throw Error('Biến thể cần là A, B hoặc C.');
    const duration = plan.durations[variant];
    const baseDuration = variant === 'C' ? duration * .5 : duration;
    const weight = plan.scenes.reduce((sum, scene) => sum + scene.duration, 0);
    let start = 0;
    const scenes = plan.scenes.map(scene => {
      const length = scene.duration / weight * baseDuration;
      const words = scene.words?.map(word => ({...word}));
      if (words?.some(word => word.end > length)) throw Error('Mốc từ vượt thời lượng cảnh của biến thể.');
      const result = {...scene, id: scene.id + '_main', start, duration: length, words, analysisPass: false};
      start += length;
      return result;
    });
    if (variant === 'C') {
      for (const scene of plan.scenes) {
        const length = scene.duration / weight * (duration - baseDuration);
        scenes.push({...scene, id: scene.id + '_analysis', start, duration: length, speed: .6,
          caption: scene.analysis || scene.caption, words: null, wordTimingProvided: false, analysisPass: true});
        start += length;
      }
    }
    const events = [];
    const cues = [{time: 0, source: 'whoosh_bass_hit', db: -12}];
    scenes.forEach((scene, index) => {
      scene.words = wordsFor(scene);
      cues.push({time: scene.start + .06, source: 'pop_soft', db: -14});
      if (index) cues.push({time: scene.start, source: 'swish_transition', db: -12});
      for (let t = 2.5, n = 0; t < scene.duration - .25; t += 2.5, n++) {
        if (scene.widgets.some(widget => Math.abs(widget.start - t) < .5)) continue;
        events.push({time: scene.start + t, duration: .7, type: n % 2 ? 'hud' : 'microZoom', sceneId: scene.id});
      }
      for (const widget of scene.widgets) {
        if (widget.start < scene.duration) cues.push({time: scene.start + widget.start, source: 'pop_soft', db: -14});
        if (widget.type === 'ABCompareSlider' && widget.start + widget.duration * .5 < scene.duration) cues.push({time: scene.start + widget.start + widget.duration * .5, source: 'camera_shutter', db: -12});
      }
    });
    if (variant === 'B') cues.push({time: 14.8, source: 'bell_ding', db: -14});
    return {
      format: 'tibe-omera-render', version: VERSION, id: plan.id, title: plan.title,
      brand: plan.brand, hook: plan.hook, gift: plan.gift, captionColor: plan.captionColor,
      variant, filename: preset.filename, duration, width: 1080, height: 1920, fps: 60,
      seed: Number(seed) >>> 0, scenes, media: plan.media, narration: plan.narration,
      musicId: plan.musicId, events, cues,
      warnings: [
        'Biến thiên hình và MD5 dùng để quản lý phiên bản; không bảo đảm tránh phát hiện nội dung trùng.',
        ...(scenes.some(scene => scene.caption && !scene.wordTimingProvided) ? ['Phụ đề đang chia thời gian theo cụm chữ; cung cấp words để khớp chính xác giọng đọc.'] : []),
        ...(variant === 'C' && plan.scenes.every(s => !s.analysis) ? ['Nên bổ sung analysis riêng cho biến thể dài để có phần giải thích hữu ích.'] : [])
      ]
    };
  }
  function currentScene(spec, time) {
    return spec.scenes.find(scene => time >= scene.start && time < scene.start + scene.duration) || spec.scenes.at(-1);
  }
  function captionAt(scene, local) {
    const words = scene.words || [];
    const index = words.findIndex(word => local >= word.start && local < word.end);
    if (index < 0) return null;
    const group = Math.floor(index / 4) * 4;
    return {words: words.slice(group, group + 4), active: index - group};
  }
  function visualState(spec, time) {
    const scene = currentScene(spec, time);
    const event = spec.events.find(item => item.sceneId === scene.id && time >= item.time && time < item.time + item.duration);
    const local = time - scene.start;
    const micro = event?.type === 'microZoom' ? .08 * (1 - clamp((time - event.time) / event.duration)) : 0;
    return {scene, local, zoom: (time < .4 ? 1.25 - .25 * hookEase(time / .4) : 1) + micro,
      flash: time < .4 ? .12 * (1 - time / .4) : 0,
      panX: Math.sin(time * .73 + spec.seed % 17) * 3,
      panY: Math.cos(time * .61 + spec.seed % 13) * 3,
      showHUD: event?.type === 'hud', caption: captionAt(scene, local)};
  }
  function editableProject(spec) {
    const clips = spec.scenes.map(scene => ({id: scene.id, track: 'video', title: scene.caption || spec.title,
      omeraSceneId: scene.id, omeraCaption: scene.caption, omeraLayout: scene.layout, omeraSettings: scene.settings, omeraGear: scene.gear, mediaId: scene.mediaId, start: scene.start, duration: scene.duration, sourceIn: scene.sourceIn,
      speed: scene.speed, muted: true, filter: 'original', effect: 'none'}));
    for (const scene of spec.scenes) {
      for (const id of new Set([scene.beforeId, scene.diagramId, scene.gearId, ...scene.widgets.map(widget => widget.mediaId)].filter(Boolean))) {
        if (spec.media[id]?.type !== 'video') continue;
        clips.push({id: scene.id + '_source_' + id, track: 'overlay', omeraHelper: true, omeraParent: scene.id, mediaId: id, title: 'Nguồn Bento',
          start: scene.start, duration: scene.duration, sourceIn: scene.sourceIn, speed: scene.speed, muted: true, opacity: 0});
      }
    }
    const projectMedia = clone(spec.media);
    const addAudio = (id, url, start, duration, volume, role) => {
      projectMedia[id] = {id, name: id, type: 'audio', url, duration};
      clips.push({id, track: 'audio', mediaId: id, title: role === 'voice' ? 'Giọng Omera' : id, start, duration,
        volume, audioRole: role, fadeOut: .04, ducking: role === 'music'});
    };
    if (spec.voiceTracks?.length) {
      spec.voiceTracks.forEach((track, index) => addAudio('omera_voice_' + index, track.url, track.start, track.duration, 1, 'voice'));
    } else if (spec.narration.mediaId) {
      const item = spec.media[spec.narration.mediaId];
      addAudio('omera_voice', item.url, 0, Math.min(spec.duration, item.duration), 1, 'voice');
    }
    if (spec.musicId) {
      const item = spec.media[spec.musicId];
      for (let start = 0, i = 0; start < spec.duration && i < 120; start += item.duration, i++) {
        addAudio('omera_music_' + i, item.url, start, Math.min(item.duration, spec.duration - start), .12, 'music');
      }
    }
    spec.cues.forEach((cue, index) => addAudio('omera_sfx_' + index, 'assets/sfx/' + cue.source + '.wav', cue.time,
      Math.min(.65, spec.duration - cue.time), Math.pow(10, cue.db / 20), 'sfx'));
    return {format: 'clipcut-project', version: 2, name: spec.title + ' · ' + spec.variant,
      ratio: '9:16', media: projectMedia, clips, canvas: {enabled: true, color: '#e8edf0'},
      production: {omera: clone(spec), output: {fps: spec.fps, width: 1080, height: 1920}}};
  }
  const api = {VERSION, LAYOUTS, WIDGETS, VARIANTS, validate, compile, currentScene, captionAt, visualState, editableProject, spring, hookEase, envelope, clamp};
  if (typeof module !== 'undefined') module.exports = api;
  else root.OmeraStudio = api;
})(typeof window === 'undefined' ? globalThis : window);