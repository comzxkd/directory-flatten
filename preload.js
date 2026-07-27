const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

/**
 * 递归收集指定目录下所有文件路径和子目录路径
 */
async function walkDir(rootDir) {
  const files = [];
  const dirs = [];

  async function walk(dir) {
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch (_) {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        dirs.push(fullPath);
        await walk(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  await walk(rootDir);
  return { files, dirs };
}

/**
 * 将一个文件夹塌缩——将其所有文件（含子文件夹内文件）移动到父级目录
 */
async function collapseOneFolder(folderPath, onProgress) {
  const parentPath = path.dirname(folderPath);
  const folderName = path.basename(folderPath);

  if (!parentPath || parentPath === folderPath) {
    return mkResult(folderName, folderPath, 0, 0, 0, [{ error: '目标文件夹不存在父级目录' }], 0);
  }

  const parentParent = path.dirname(parentPath);
  if (!parentParent || parentParent === parentPath) {
    return mkResult(folderName, folderPath, 0, 0, 0, [{ error: '父级目录是驱动器根目录，跳过' }], 0);
  }

  const { files: allFiles, dirs: allDirs } = await walkDir(folderPath);

  if (allFiles.length === 0) {
    let deletedDirs = 0;
    try {
      await fsp.rmdir(folderPath);
      deletedDirs = 1;
    } catch (_) {}
    return mkResult(folderName, folderPath, 0, 0, 0, [], deletedDirs);
  }

  let moved = 0;
  let renamed = 0;
  let failed = 0;
  const errors = [];

  for (const filePath of allFiles) {
    const fileName = path.basename(filePath);
    const ext = path.extname(fileName);
    const baseName = path.basename(fileName, ext);

    let destPath = path.join(parentPath, fileName);
    let isRenamed = false;

    try {
      await fsp.access(destPath);
      isRenamed = true;
      let newName = `${baseName}_${folderName}${ext}`;
      destPath = path.join(parentPath, newName);

      let counter = 2;
      while (true) {
        try {
          await fsp.access(destPath);
          newName = `${baseName}_${folderName} (${counter})${ext}`;
          destPath = path.join(parentPath, newName);
          counter++;
        } catch (_) {
          break;
        }
      }
    } catch (_) {}

    try {
      await fsp.rename(filePath, destPath);
      if (isRenamed) renamed++;
      moved++;
    } catch (err) {
      if (err.code === 'EXDEV') {
        try {
          const srcContent = await fsp.readFile(filePath);
          await fsp.writeFile(destPath, srcContent);
          await fsp.unlink(filePath);
          if (isRenamed) renamed++;
          moved++;
        } catch (copyErr) {
          failed++;
          errors.push({ file: fileName, error: copyErr.message });
        }
      } else {
        failed++;
        errors.push({ file: fileName, error: err.message });
      }
    }

    onProgress({ total: allFiles.length, moved, renamed, failed, currentFile: fileName, folderName, folderPath });
    await sleep(5);
  }

  let deletedDirs = 0;
  const reversedDirs = [...allDirs].reverse();
  for (const dir of reversedDirs) {
    try {
      if (await exists(dir)) {
        const remaining = await fsp.readdir(dir);
        if (remaining.length === 0) {
          await fsp.rmdir(dir);
          deletedDirs++;
        }
      }
    } catch (_) {}
  }

  try {
    if (await exists(folderPath)) {
      const remaining = await fsp.readdir(folderPath);
      if (remaining.length === 0) {
        await fsp.rmdir(folderPath);
        deletedDirs++;
      }
    }
  } catch (_) {}

  return mkResult(folderName, folderPath, moved, renamed, failed, errors, deletedDirs);
}

function mkResult(folderName, folderPath, moved, renamed, failed, errors, deletedDirs) {
  return { folderName, folderPath, moved, renamed, failed, errors, deletedDirs };
}

async function exists(p) {
  try {
    await fsp.access(p);
    return true;
  } catch (_) {
    return false;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

window.folderApi = {
  async collapseFolders(folderPaths, onProgress, onComplete) {
    const results = [];
    let totalMoved = 0;
    let totalRenamed = 0;
    let totalFailed = 0;
    let totalDeletedDirs = 0;

    for (let i = 0; i < folderPaths.length; i++) {
      const fp = folderPaths[i];
      const folderName = path.basename(fp);

      onProgress({ type: 'folder-start', folderPath: fp, folderName, index: i + 1, total: folderPaths.length });

      try {
        const result = await collapseOneFolder(fp, (p) => {
          onProgress({ type: 'file-progress', ...p, index: i + 1, total: folderPaths.length });
        });

        results.push(result);
        totalMoved += result.moved;
        totalRenamed += result.renamed;
        totalFailed += result.failed;
        totalDeletedDirs += result.deletedDirs;

        onProgress({ type: 'folder-done', ...result, index: i + 1, total: folderPaths.length });
        await sleep(20);
      } catch (err) {
        results.push({ folderName: path.basename(fp), folderPath: fp, moved: 0, renamed: 0, failed: 0, errors: [{ error: err.message }], deletedDirs: 0 });
        totalFailed++;
        onProgress({ type: 'folder-error', folderPath: fp, folderName: path.basename(fp), error: err.message, index: i + 1, total: folderPaths.length });
      }
    }

    onComplete({ results, totalMoved, totalRenamed, totalFailed, totalDeletedDirs, totalFolders: folderPaths.length });
  }
};
