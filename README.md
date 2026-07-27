<p align="center">
  <img src="logo.png" width="128" alt="一键释放目录">
</p>

<h1 align="center">📁 一键释放目录</h1>

<p align="center">
  <strong>uTools 插件</strong> — 将选中文件夹内的所有文件释放到父级目录，一键打平目录结构
</p>

<p align="center">
  <a href="#功能特性">功能特性</a> ·
  <a href="#安装">安装</a> ·
  <a href="#使用方式">使用方式</a> ·
  <a href="#工作原理">工作原理</a> ·
  <a href="#开发">开发</a>
</p>

---

## 功能特性

- **批量处理** — 支持同时选中多个文件夹，顺序执行
- **递归提取** — 子文件夹内的文件全部提到父级，不限层级深度
- **智能重命名** — 同名文件自动改名 `文件名_原文件夹名.后缀`，继续冲突则追加序号 `文件名_原文件夹名 (2).后缀`，绝不覆盖
- **跨驱动器安全** — 跨文件系统自动降级为复制+删除，不报错中断
- **空目录清理** — 自底向上清理所有空目录（含目标文件夹本身）
- **拖拽补充** — 打开插件后可直接从文件管理器拖拽文件夹到界面添加，自动去重
- **实时进度** — 进度条 + 当前文件名 + 重命名计数，处理结果完整统计

## 安装

### 方法一：插件应用市场（审核通过后）

在 uTools 搜索框输入「一键释放目录」安装。

### 方法二：手动安装

1. 从 [Releases](https://github.com/nhcpy/directory-flatten/releases) 下载最新 `.upx` 文件
2. 将 `.upx` 文件拖入 uTools 搜索框
3. 确认安装即可

## 使用方式

**方式 A — 选中后呼出：**

1. 在文件管理器中选中一个或多个文件夹
2. 呼出 uTools（默认 Alt+Space）
3. 输入「一键释放目录」或继续粘贴时自动匹配
4. 进入插件后点击「开始塌缩」

**方式 B — 拖拽：**

1. 呼出 uTools 打开插件
2. 直接从文件管理器拖拽文件夹到插件界面
3. 点击「开始塌缩」

## 工作原理

```
处理前：                         处理后：
~/Downloads/                     ~/Downloads/
  └── 26ID-059/                    ├── cover.jpg
      ├── cover.jpg                ├── sample.mp4
      ├── sample.mp4               └── thumbs_26ID-059.png
      └── thumbs.png  ← 冲突 → 重命名为 thumbs_26ID-059.png
```

插件会从最内层开始逐级向外移动文件。遇到同名文件时追加原文件夹名作为命名空间，确保所有文件安全归位。处理完成后，沿途所有空目录（包括最初选中的文件夹）自底向上依次删除。

**跨驱动器行为：** 同一驱动器下使用 `rename()` 瞬间完成；跨驱动器（如从 C 盘拖到 D 盘的文件夹）自动回退到 `copy + unlink`。

## 开发

### 项目结构

```
directory-flatten/
├── plugin.json      # uTools 插件配置
├── preload.js       # 核心逻辑（Node.js 层，文件操作）
├── index.html       # UI 骨架
├── index.css        # 样式
├── index.js         # 交互逻辑（前端）
├── logo.png         # 插件图标
├── .gitignore
└── README.md
```

### 本地调试

在 uTools 开发者工具中接入开发模式：

```
开发者工具 → 接入开发 → 选择 plugin.json
```

### 打包

```bash
# 将插件文件打包为 .upx（实际是重命名的 .zip）
Compress-Archive -Path plugin.json, preload.js, index.html, index.css, index.js, logo.png -DestinationPath directory-flatten.zip
Rename-Item directory-flatten.zip directory-flatten.upx
```

## 许可

MIT
