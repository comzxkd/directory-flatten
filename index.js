const $ = (sel) => document.querySelector(sel);
const folderList = $('#folder-list');
const folderCount = $('#folder-count');
const statusBadge = $('#status-badge');
const progressArea = $('#progress-area');
const progressBar = $('#progress-bar');
const progressText = $('#progress-text');
const progressFolderLabel = $('#progress-folder-label');
const progressFileLabel = $('#progress-file-label');
const resultArea = $('#result-area');
const btnStart = $('#btn-start');
const btnClear = $('#btn-clear');
const btnClose = $('#btn-close');
const dropZone = $('#selected-folders');

let selectedPaths = [];
let isProcessing = false;

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  if (isProcessing) return;
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  if (isProcessing) return;
  const paths = Array.from(e.dataTransfer.files).map((f) => f.path).filter(Boolean);
  if (paths.length === 0) return;
  addPaths(paths);
});

function addPaths(paths) {
  progressArea.classList.add('hidden');
  resultArea.classList.add('hidden');
  resultArea.innerHTML = '';
  progressBar.style.width = '0%';
  progressText.textContent = '';
  statusBadge.textContent = '就绪';
  statusBadge.className = '';
  const existing = new Set(selectedPaths);
  let added = 0;
  for (const p of paths) {
    if (!existing.has(p)) {
      selectedPaths.push(p);
      existing.add(p);
      added++;
    }
  }
  if (added === 0) return;
  renderFolderList();
  btnStart.disabled = false;
}

function resetAll() {
  selectedPaths = [];
  progressArea.classList.add('hidden');
  resultArea.classList.add('hidden');
  resultArea.innerHTML = '';
  progressBar.style.width = '0%';
  progressText.textContent = '';
  statusBadge.textContent = '就绪';
  statusBadge.className = '';
  btnStart.disabled = true;
  folderList.innerHTML = '<div class="drop-hint">拖拽文件夹到此处添加</div>';
  folderCount.textContent = '0 个';
}

utools.onPluginEnter(({ code, type, payload }) => {
  if (code !== 'collapse') return;
  if (!payload || !Array.isArray(payload)) return;
  selectedPaths = payload.filter((item) => item.isDirectory).map((item) => item.path);
  if (selectedPaths.length === 0) {
    folderList.innerHTML = '<div class="drop-hint">拖拽文件夹到此处添加</div>';
    btnStart.disabled = true;
    return;
  }
  renderFolderList();
  btnStart.disabled = false;
});

function renderFolderList() {
  folderList.innerHTML = '';
  folderCount.textContent = `${selectedPaths.length} 个`;
  selectedPaths.forEach((fp, idx) => {
    const item = document.createElement('div');
    item.className = 'folder-item';
    item.dataset.index = idx;
    item.dataset.path = fp;
    item.innerHTML = `<span class="folder-icon">📁</span><span class="folder-path" title="${escapeHtml(fp)}">${escapeHtml(fp)}</span><span class="folder-status pending">待处理</span>`;
    folderList.appendChild(item);
  });
}

function updateFolderStatus(index, status, text) {
  const items = folderList.querySelectorAll('.folder-item');
  if (items[index]) {
    const badge = items[index].querySelector('.folder-status');
    badge.className = `folder-status ${status}`;
    badge.textContent = text;
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

btnStart.addEventListener('click', () => {
  if (isProcessing || selectedPaths.length === 0) return;
  startCollapse();
});

btnClear.addEventListener('click', () => {
  if (isProcessing) return;
  resetAll();
});

btnClose.addEventListener('click', () => {
  utools.hideMainWindow();
  utools.outPlugin();
});

function startCollapse() {
  isProcessing = true;
  btnStart.disabled = true;
  resultArea.classList.add('hidden');
  resultArea.innerHTML = '';
  progressArea.classList.remove('hidden');
  progressBar.style.width = '0%';
  progressText.textContent = '准备中...';
  statusBadge.textContent = '处理中';
  statusBadge.className = 'processing';
  selectedPaths.forEach((_, i) => updateFolderStatus(i, 'pending', '待处理'));
  window.folderApi.collapseFolders(selectedPaths,
    (data) => {
      if (data.type === 'folder-start') {
        progressFolderLabel.textContent = `[${data.index}/${data.total}] ${data.folderName}`;
        updateFolderStatus(data.index - 1, 'processing', '处理中...');
      } else if (data.type === 'file-progress') {
        const pct = data.total > 0 ? Math.round((data.moved / data.total) * 100) : 0;
        progressBar.style.width = `${pct}%`;
        progressFileLabel.textContent = `${data.moved} / ${data.total}`;
        progressText.textContent = `正在移动: ${data.currentFile}`;
        if (data.renamed > 0) progressText.textContent += ` (已重命名 ${data.renamed} 个)`;
      } else if (data.type === 'folder-done') {
        progressFolderLabel.textContent = `[${data.index}/${data.total}] ${data.folderName}`;
        progressBar.style.width = '100%';
        const hasErr = data.failed > 0;
        updateFolderStatus(data.index - 1, hasErr ? 'error' : 'done', hasErr ? `${data.moved} 个 | ${data.failed} 失败` : `${data.moved} 个 ✓`);
      } else if (data.type === 'folder-error') {
        updateFolderStatus(data.index - 1, 'error', '失败');
      }
    },
    (summary) => {
      isProcessing = false;
      statusBadge.textContent = '完成';
      statusBadge.className = 'done';
      progressBar.style.width = '100%';
      progressText.textContent = '全部处理完成';
      renderSummary(summary);
      setTimeout(() => {
        progressArea.classList.add('hidden');
        resultArea.classList.remove('hidden');
      }, 800);
    }
  );
}

function renderSummary(summary) {
  const hasAnyError = summary.totalFailed > 0;
  let html = `<div class="result-title ${hasAnyError ? 'has-error' : ''}">${hasAnyError ? '⚠️ 处理完成（部分失败）' : '✅ 全部处理完成'}</div>`;
  html += `<div class="result-item">📦 处理文件夹：<span class="highlight">${summary.totalFolders}</span> 个</div>`;
  html += `<div class="result-item">📄 移动文件：<span class="highlight">${summary.totalMoved}</span> 个</div>`;
  if (summary.totalRenamed > 0) html += `<div class="result-item">🔀 重命名去重：<span class="warn">${summary.totalRenamed}</span> 个</div>`;
  if (summary.totalDeletedDirs > 0) html += `<div class="result-item">🗑️ 删除空目录：<span class="highlight">${summary.totalDeletedDirs}</span> 个</div>`;
  if (summary.totalFailed > 0) html += `<div class="result-item fail">❌ 失败：<span class="fail">${summary.totalFailed}</span> 个</div>`;
  for (const r of summary.results) {
    if (r.errors && r.errors.length > 0) {
      html += `<div class="result-item" style="font-size:12px;color:#ff3b30"><strong>${escapeHtml(r.folderName)}</strong> 的错误：</div>`;
      for (const e of r.errors) {
        html += `<div class="result-item" style="font-size:11px;color:#6e6e73;padding-left:16px">${escapeHtml(e.file || '')} — ${escapeHtml(e.error)}</div>`;
      }
    }
  }
  resultArea.innerHTML = html;
}
