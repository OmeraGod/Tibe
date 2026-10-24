/* Batch Manager UI; rendering continues independently of this page. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = {plans: [], jobs: [], timer: null, busy: false, files: new Map(), uploads: new Map()};
  const statuses = {queued: 'Đang chờ', preparing: 'Chuẩn bị', rendering: 'Đang dựng', mixing: 'Trộn âm thanh', done: 'Hoàn tất', failed: 'Có lỗi', cancelling: 'Đang hủy', cancelled: 'Đã hủy', interrupted: 'Bị gián đoạn'};
  function node(tag, className, value) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (value != null) element.textContent = value;
    return element;
  }
  function notify(message, error = false) {
    $('batchStatus').textContent = message;
    $('batchStatus').classList.toggle('error', error);
  }
  async function api(path, options) {
    const response = await TibeBackend.request(path, options);
    const data = await response.json();
    if (!response.ok || data.ok === false) throw Error(data.error || 'Không hoàn thành được yêu cầu.');
    return data;
  }
  const post = (path, value = {}) => api(path, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(value)});
  function selectedVariants() {
    const values = [...document.querySelectorAll('input[name=variant]:checked')].map(input => input.value);
    if (!values.length) throw Error('Chọn ít nhất một biến thể.');
    return values;
  }
  function sample(index) {
    return {id: 'omera_demo_' + (index + 1), title: ['Ánh sáng đẹp hơn', 'Khung hình có chiều sâu', 'Góc máy kể chuyện', 'Thiết bị gọn cho Reels', 'Chuyển động tự nhiên'][index % 5],
      hook: 'Chỉ đổi một điều, khung hình khác hẳn.', brand: 'Omera Studio',
      media: {before: {type: 'image', name: 'Ảnh mẫu trước', url: 'assets/demo/cliff-hd.png'}, after: {type: 'image', name: 'Ảnh mẫu sau', url: 'assets/demo/coast-hd.png'}},
      narration: {generate: false, voice: 'Hải Đăng'},
      scenes: [
        {mediaId: 'after', beforeId: 'before', layout: OmeraStudio.LAYOUTS[index % 4], duration: 4,
          caption: 'Đặt chủ thể gần nguồn sáng để ảnh trong trẻo hơn.', analysis: 'Quan sát hướng bóng trên gương mặt và giữ vùng sáng ở phía trước.', settings: 'Cửa sổ 45° · Tiêu cự 2×', gear: 'Tripod · Đèn LED'},
        {mediaId: 'after', beforeId: 'before', layout: 'BENTO_PIP_DIAGRAM', duration: 4,
          caption: 'Di chuyển máy chậm và giữ hậu cảnh gọn gàng.', analysis: 'Giữ trục máy ổn định, xem kỹ phần viền và khoảng trống sau chủ thể.',
          settings: 'Máy ngang mắt · Khóa phơi sáng', widgets: [{type: 'PhoneGridHUD', start: 1, duration: 3}]}]};
  }
  function extract(value) {
    const plans = Array.isArray(value) ? value : Array.isArray(value?.projects) ? value.projects : [value];
    if (!plans.length || plans.length > 20 || plans.some(plan => !plan || !Array.isArray(plan.scenes))) throw Error('JSON cần 1–20 mục, mỗi mục có scenes.');
    return plans.map(plan => ({...plan, media: {...(value.media || {}), ...(plan.media || {})}}));
  }
  function setPlans(plans, append = false) {
    const combined = append ? [...state.plans, ...plans] : plans;
    if (combined.length > 20) throw Error('Một lô tối đa 20 kịch bản.');
    combined.forEach(plan => OmeraStudio.validate(plan));
    state.plans = combined;
    $('batchJsonText').value = JSON.stringify({projects: combined}, null, 2);
    renderPlans();
  }
  function renderPlans() {
    const list = $('planList');
    list.replaceChildren();
    $('inputCount').textContent = state.plans.length + ' bài';
    if (!state.plans.length) {
      const empty = node('div', 'empty-state');
      empty.append(node('span', '', '✦'), node('strong', '', 'Bắt đầu với câu chuyện đầu tiên'), node('p', '', 'Nhập JSON hoặc chọn thư mục tư liệu.'));
      list.append(empty);
      return;
    }
    state.plans.forEach((plan, index) => {
      const card = node('article', 'plan-card');
      card.append(node('strong', '', (index + 1) + '. ' + (plan.title || plan.name)), node('p', '', plan.hook || 'Bento · Cinema Glass'));
      const footer = node('footer');
      footer.append(node('small', '', plan.scenes.length + ' cảnh · ' + (plan.narration?.generate ? 'Tạo giọng Việt' : plan.narration?.mediaId ? 'Giọng đã nhập' : 'Chưa thêm lời đọc')));
      const preview = node('button', 'soft-button', '▷ Xem thử 3 giây');
      preview.onclick = () => previewPlan(index);
      const remove = node('button', 'soft-button', '×');
      remove.title = 'Bỏ khỏi lô';
      remove.onclick = () => setPlans(state.plans.filter((_, i) => i !== index));
      footer.append(preview, remove); card.append(footer); list.append(card);
    });
  }
  async function upload(file) {
    const key = (file.webkitRelativePath || file.name) + ':' + file.size + ':' + file.lastModified;
    if (state.uploads.has(key)) return state.uploads.get(key);
    const form = new FormData(); form.append('file', file);
    const result = await api('/api/upload', {method: 'POST', body: form});
    const extension = file.name.split('.').at(-1).toLowerCase();
    const type = /^(png|jpe?g|webp|gif|bmp)$/.test(extension) ? 'image' : /^(wav|mp3|m4a|ogg|flac|aac)$/.test(extension) ? 'audio' : 'video';
    const duration = Number(result.metadata?.format?.duration) || 4;
    const item = {name: file.name, type, url: result.url, duration};
    state.uploads.set(key, item);
    return item;
  }
  async function bindFiles(plan, prefix = '') {
    const result = JSON.parse(JSON.stringify(plan));
    for (const [id, item] of Object.entries(result.media || {})) {
      if (!item.file) continue;
      const file = state.files.get(prefix + item.file) || state.files.get(item.file);
      if (!file) throw Error('Không tìm thấy tệp ' + item.file + '. Chọn thư mục chứa JSON cùng tư liệu.');
      notify('Đang nhập tư liệu: ' + file.name);
      result.media[id] = {...await upload(file), type: item.type || undefined};
      if (!result.media[id].type) delete result.media[id].type;
      result.media[id].type ||= (await upload(file)).type;
    }
    return result;
  }
  async function importFiles(files) {
    if (state.busy) return;
    state.busy = true;
    try {
      await TibeBackend.ensure();
      for (const file of files) {
        const relative = file.webkitRelativePath || file.name;
        state.files.set(relative, file);
        if (!state.files.has(file.name)) state.files.set(file.name, file);
      }
      const manifests = files.filter(file => file.name.toLowerCase().endsWith('.json'));
      const imported = [];
      if (manifests.length) {
        for (const file of manifests) {
          if (file.size > 8 * 1024 * 1024) throw Error('JSON vượt giới hạn 8 MB.');
          const raw = JSON.parse(await file.text());
          const prefix = (file.webkitRelativePath || '').replace(/[^/]+$/, '');
          for (const plan of extract(raw)) imported.push(await bindFiles(plan, prefix));
        }
      } else {
        const groups = new Map();
        for (const file of files.filter(file => /\.(mp4|mov|mkv|webm|png|jpe?g|webp)$/i.test(file.name))) {
          const group = (file.webkitRelativePath || file.name).replace(/[^/]+$/, '') || 'Tư liệu';
          if (!groups.has(group)) groups.set(group, []);
          groups.get(group).push(file);
        }
        if (groups.size > 20) throw Error('Chọn tối đa 20 thư mục có tư liệu.');
        for (const [name, sources] of groups) {
          notify('Đang nhập thư mục ' + name);
          const beforeFile = sources.find(file => /before|truoc/i.test(file.name)) || sources[0];
          const afterFile = sources.find(file => /after|sau/i.test(file.name)) || sources[1] || sources[0];
          const before = await upload(beforeFile), after = await upload(afterFile);
          imported.push({title: name.split('/').filter(Boolean).at(-1), hook: 'Khác biệt nằm ở chi tiết này.',
            media: {before, after}, scenes: [{mediaId: 'after', beforeId: 'before', layout: 'BENTO_SPLIT_VERTICAL',
              caption: 'Thêm nội dung hướng dẫn của bạn.', analysis: 'Bổ sung phần phân tích chi tiết tại đây.', duration: 4}]});
        }
      }
      if (!imported.length) throw Error('Thư mục chưa có JSON hoặc ảnh/video hỗ trợ.');
      setPlans(imported, true);
      notify('Đã nhập ' + imported.length + ' kịch bản. Kiểm tra nội dung trước khi xuất.');
    } catch (error) {notify(error.message, true);}
    finally {state.busy = false;}
  }
  async function previewPlan(index) {
    try {
      notify('Đang xếp bản xem thử 3 giây…');
      const result = await post('/api/batch/jobs', {projects: [state.plans[index]], variants: [selectedVariants()[0]], profile: 'draft', preview: true, previewSeconds: 3});
      await post('/api/batch/start', {ids: result.jobs.map(job => job.id)});
      await refresh(); notify('Bản xem thử đã được xếp riêng. Các bản đầy đủ đang chờ được giữ lại.');
    } catch (error) {notify(error.message, true);}
  }
  async function renderAll() {
    if (state.busy) return;
    if (!state.plans.length) return notify('Nhập ít nhất một kịch bản.', true);
    state.busy = true; $('renderAll').disabled = true;
    try {
      const variants = selectedVariants();
      notify('Đang kiểm tra ' + state.plans.length + ' kịch bản và ' + variants.length + ' biến thể…');
      const result = await post('/api/batch/jobs', {projects: state.plans, variants, profile: $('batchProfile').value});
      await post('/api/batch/start', {ids: result.jobs.map(job => job.id)});
      notify('Đã xếp ' + result.jobs.length + ' video. Bộ dựng tiếp tục chạy khi bạn chuyển hoặc đóng tab này.');
      await refresh();
    } catch (error) {notify(error.message, true);}
    finally {state.busy = false; $('renderAll').disabled = false;}
  }
  function showVideo(job) {
    $('previewTitle').textContent = job.title + ' · ' + job.variant;
    const video = $('batchPreviewVideo');
    video.crossOrigin = 'anonymous'; video.src = TibeBackend.url(job.outputUrl);
    $('batchPreview').showModal();
    video.play().catch(() => {});
  }
  function action(label, callback) {
    const button = node('button', 'soft-button', label);
    button.onclick = async () => {
      button.disabled = true;
      try {await callback(); await refresh();} catch (error) {notify(error.message, true);}
      finally {button.disabled = false;}
    };
    return button;
  }
  function renderQueue() {
    const host = $('batchQueue');
    const scrollTop = host.scrollTop;
    const openWarnings = new Set([...host.querySelectorAll('.queue-item')].filter(row => row.querySelector('details')?.open).map(row => row.dataset.id));
    host.replaceChildren();
    const finished = state.jobs.filter(job => job.state === 'done').length;
    const running = state.jobs.filter(job => ['preparing', 'rendering', 'mixing'].includes(job.state)).length;
    $('queueSummary').textContent = `${state.jobs.length} bản · ${finished} hoàn tất · ${running} đang dựng`;
    if (!state.jobs.length) host.append(node('div', 'empty-state', 'Chưa có video trong hàng đợi.'));
    for (const job of state.jobs) {
      const row = node('article', 'queue-item'); row.dataset.state = job.state; row.dataset.id = job.id;
      const header = node('header'), title = node('div');
      title.append(node('strong', '', job.title + ' · ' + job.variant), node('small', '', `${job.preview ? 'XEM THỬ · ' : ''}${job.width} × ${job.height} · ${job.fps} fps · ${job.duration.toFixed(1)}s`));
      header.append(title, node('span', 'queue-state', statuses[job.state] || job.state)); row.append(header);
      const progress = document.createElement('progress'); progress.max = 1; progress.value = job.progress;
      row.append(progress, node('div', 'queue-message', job.message));
      const buttons = node('div', 'queue-actions');
      if (job.state === 'done') {
        buttons.append(action('▷ Xem video', () => showVideo(job)));
        const download = node('a', '', 'Tải MP4'); download.download = job.variant + '.mp4'; download.href = TibeBackend.url('/api/batch/jobs/' + job.id + '/download'); download.target = '_blank'; download.rel = 'noopener'; buttons.append(download);
        const manifest = node('a', '', 'Thông tin bản xuất'); manifest.href = TibeBackend.url(job.manifestUrl); manifest.target = '_blank'; manifest.rel = 'noopener'; buttons.append(manifest);
      }
      if (['queued', 'preparing', 'rendering', 'mixing'].includes(job.state)) buttons.append(action('Hủy', () => post('/api/batch/jobs/' + job.id + '/cancel')));
      if (['failed', 'cancelled', 'interrupted'].includes(job.state)) buttons.append(action('Thử lại', () => post('/api/batch/jobs/' + job.id + '/retry')));
      const edit = node('a', '', 'Mở trong editor ↗'); edit.href = '/?batch=' + job.id; edit.target = '_blank'; edit.rel = 'noopener'; buttons.append(edit);
      row.append(buttons);
      if (job.warnings?.length) {
        const details = node('details', 'queue-warnings'); details.open = openWarnings.has(job.id); details.append(node('summary', '', 'Lưu ý bản dựng'));
        for (const warning of job.warnings) details.append(node('p', '', warning)); row.append(details);
      }
      host.append(row);
    }
    host.scrollTop = scrollTop;
  }
  let lastQueue = '';
  async function refresh() {
    const result = await api('/api/batch/jobs');
    const signature = JSON.stringify(result.jobs);
    if (signature === lastQueue) return;
    lastQueue = signature; state.jobs = result.jobs; renderQueue();
  }
  async function poll() {
    clearTimeout(state.timer);
    try {if (!document.hidden) await refresh();} catch (error) {notify(error.message, true);}
    state.timer = setTimeout(poll, document.hidden ? 5000 : 1800);
  }
  async function start() {
    $('importJson').onclick = () => $('batchJsonFiles').click();
    $('importFolder').onclick = () => $('batchFolderFiles').click();
    $('batchJsonFiles').onchange = event => importFiles([...event.target.files]);
    $('batchFolderFiles').onchange = event => importFiles([...event.target.files]);
    $('loadSamples').onclick = () => {try {setPlans(Array.from({length: 5}, (_, i) => sample(i))); notify('Đã nạp 5 mẫu minh họa; thay tư liệu và lời dẫn của bạn trước khi xuất.');} catch (error) {notify(error.message, true);}};
    $('applyJson').onclick = async () => {try {const plans = extract(JSON.parse($('batchJsonText').value)); const bound = []; for (const plan of plans) bound.push(await bindFiles(plan)); setPlans(bound); notify('Đã nạp JSON.');} catch (error) {notify(error.message, true);}};
    $('renderAll').onclick = renderAll;
    $('resumeQueue').onclick = async () => {try {await post('/api/batch/start'); await refresh();} catch (error) {notify(error.message, true);}};
    $('closeBatchPreview').onclick = () => $('batchPreview').close();
    $('batchPreview').addEventListener('close', () => {$('batchPreviewVideo').pause(); $('batchPreviewVideo').removeAttribute('src'); $('batchPreviewVideo').load();});
    window.addEventListener('beforeunload', () => clearTimeout(state.timer));
    try {await TibeBackend.ensure(); await refresh(); notify('Bộ dựng đã sẵn sàng. Nhập kịch bản hoặc thử 5 bài mẫu.'); poll();}
    catch (error) {notify(error.message, true);}
  }
  start();
})();