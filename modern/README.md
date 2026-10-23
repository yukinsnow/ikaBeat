# ikaBeat 2.0

作者：**[Github@Yukinsnow](https://github.com/Yukinsnow)**。

桌面端另提供免安装包：Windows x64 绿色 ZIP，以及 macOS Universal `.app` ZIP。Windows 绿色模式将应用数据写入程序旁的 `data/`，需保留随包附带的 `portable.flag`；运行时要求与限制见 [绿色版说明](docs/绿色版.md)。

保留原版 ika 图片的离线音乐 BPM 分析工具。此目录是独立、可运行的跨平台重构源码，不依赖旧项目的 macOS ARM64 动态库。

**当前状态：Windows、macOS、Android、iOS 云端构建全部通过，安装包已生成；原生运行和移动端实机验收仍待完成。**

## 运行

需要 Node.js 24 和 npm。安装依赖时自动将 Essentia 运行时复制到本地静态资源，无需 CDN。

```sh
npm ci
npm run dev
```

浏览器打开终端显示的地址（默认 `http://localhost:1420`）。生产预览：

```sh
npm run build
npm run preview
```

不要直接双击 `dist/index.html`；Worker 和 WASM 需要 HTTP 或 Tauri 应用协议环境。

## 功能

- 多选 / 桌面拖入音频，串行队列，取消分析。
- Essentia `RhythmExtractor2013(multifeature)`：BPM、原始置信度、节拍数。
- 系统解码后统一为 44.1 kHz 单声道，WASM 在 Web Worker 中运行；每首结束即销毁线程，释放分析堆。
- 波形、搜索、状态筛选、本机最近 100 首已完成记录、CSV 导出。
- 保留原横幅、角色图和应用图标；响应式桌面 / 手机布局。
- 原始音频只驻留当前会话，不上传、不持久化。历史记录存在当前应用的 localStorage。

单文件最多 80 MB，解码后检查时长为 5 秒至 10 分钟，每批队列最多 30 首。解码阶段本身不能中断，取消会在解码完成后生效；Worker 阶段立即终止。压缩音频需先完整解码才能检查时长，因此这些限制不等于移动端内存保证。

## 平台构建

先按 [Tauri 官方前置要求](https://v2.tauri.app/start/prerequisites/) 配置工具链。

| 平台 | 必要环境 | 开发 / 构建 |
| --- | --- | --- |
| Windows | Rust MSVC、Visual Studio C++ Build Tools、Windows SDK、WebView2 | `npm run tauri dev` / `npm run tauri build` |
| macOS | macOS、Rust、Xcode Command Line Tools | `npm run tauri dev` / `npm run tauri build` |
| Android | Rust Android targets、Android Studio、JDK、SDK / NDK，设置 `JAVA_HOME` / `ANDROID_HOME` / `NDK_HOME` | 首次 `npm run tauri android init`，随后 `npm run tauri android dev` / `npm run tauri android build` |
| iOS | macOS、完整 Xcode、iOS Rust targets，真机签名团队 | 首次 `npm run tauri ios init`，再运行下面的 AppIcon 安装命令，然后开发或构建 |

iOS 每次初始化原生工程后，必须把 ika 图标安装到 Xcode 实际使用的资源目录：

```sh
node scripts/install-ios-icons.mjs
node scripts/install-ios-icons.mjs --check
npm run tauri ios build -- --ci --target aarch64 --no-sign
```

脚本根据 `Assets.xcassets/AppIcon.appiconset/Contents.json` 逐项检查尺寸、写入原版 ika 图案，并输出不含 alpha 通道的 RGB PNG。只生成 `src-tauri/icons/ios/` 而不更新 Xcode AppIcon 目录，会导致应用继续使用 Tauri 默认图标。CI 已在 `ios init` 之后加入安装及校验步骤。

iOS 图标使用原始 `public/assets/icon.jpg` 铺满方形画布，不加入桌面图标的透明留白、圆角或阴影，圆角交给系统处理。修改原图后运行 `node scripts/generate-ios-icons.mjs`，再执行上述安装步骤；生成时仅裁去原图边缘 2%，移除图片自带的白色圆角尖端。

界面通过 `env(safe-area-inset-*)` 为顶部、底部和横屏两侧预留系统安全区，固定侧栏及帮助弹窗也使用相同边距；桌面安全区为零时保持原布局。

移动端 `gen/` 工程需要在具备工具链的主机首次初始化，云端工作流已成功执行 Android / iOS 初始化和编译；本机没有移动端工具链。应用标识为 `com.yukinsnow.ikabeat`，发布前按开发者账户确认。macOS Universal 构建需要添加 `aarch64-apple-darwin` 和 `x86_64-apple-darwin` targets，并使用 `npm run tauri build -- --target universal-apple-darwin`。

仓库附带 `.github/workflows/build-multiplatform.yml`，用于前端测试及 Windows / macOS / Android / iOS 构建。已通过 PR #5 合并到 `main`，GitHub 仓库中的应用源码位于 `modern/`；工作流的 `APP_DIR` 相应设置为 `modern`。本地独立源码包中的 `APP_DIR` 为 `.`。

产物分别为 Windows NSIS EXE、macOS Universal DMG、Android 开发签名 APK、未签名 iOS IPA。iOS IPA 需要用自己的 Apple 开发者证书重新签名才能在普通真机安装；当前没有配置正式签名凭证。正式发布仍需签名、公证和实机测试。构建完成后的实际结果以 `docs/构建结果.md` 为准。

## 格式与导出边界

已验证合成 PCM WAV。WAV / MP3 是优先验收格式；FLAC / OGG / AIFF / AAC / M4A 是否可解码取决于 WebView 和操作系统。受 DRM 保护的音频不在支持范围内。格式不支持时给出转换提示，当前没有打包 FFmpeg 兜底，不能声称与旧版 FFmpeg MonoLoader 格式覆盖完全一致。

CSV 优先尝试系统文件分享，随后使用浏览器下载。Android / iOS WebView 上的系统分享及下载保存行为仍待原生实测；如不支持，后续应接入原生文件保存 / 分享插件。文件选择目前通过系统 WebView 的 HTML file input，同样待各移动端验收。

算法参数与旧版一致，但不同 Essentia 编译版本、音频解码和重采样可能产生差异。原始 confidence 不是百分比；双倍 / 半速节奏仍需人工判断。合成节拍测试不能代替真实音乐准确率基准。

## 验证

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

端到端测试运行 **生产构建**，并应用与 Tauri 相同的 CSP，实际执行 WASM。覆盖 120 / 140 BPM 合成音频、静音失败、串行队列、取消、历史恢复、CSV 下载、非法文件、390px 手机布局。测试输出 `desktop-preview.png` 和 `mobile-preview.png`。

Windows 本地缺少 Rust、Cargo、MSVC / SDK，因此本次通过 GitHub Actions 的对应平台工具链生成 EXE / DMG / APK / IPA。[已成功的构建记录](https://github.com/yukinsnow/ikaBeat/actions/runs/39365079143)，构建代码 revision 为 `55ad56f67ce39f904ade8b54ab5269d33e243afb`。

## 目录

```text
src/                       React 界面、队列、音频适配、历史和 CSV
public/analysis-worker.js   Essentia WASM 后台分析入口
public/assets/             复用的原版图片
public/vendor/             本地 Essentia 运行时和许可
src-tauri/                 Tauri 2 Rust 壳、平台图标和 CSP
scripts/prepare.mjs         从锁定依赖复制运行时
tests/                     生产环境端到端测试
legacy/                    原版 Swift / Objective-C++ 参考副本
docs/                      分析和迁移说明
```

## 来源与许可

原项目：[yukinsnow/ikaBeat](https://github.com/yukinsnow/ikaBeat)，分析基线 commit `3fa5b7e29ed9ff3c0a35a7859cf2bb99a9675228`。原始 GPLv3 许可保存在 `LICENSE`。原始 Swift / Objective-C++ 副本保存在 `legacy/`，不参与新版本构建。

Essentia.js 0.1.3 的包声明和运行时代码附带 **AGPLv3**，完整文本在 `public/vendor/ESSENTIA-LICENSE.txt`。本项目保留原代码 GPLv3 声明，不应据此将包含 Essentia 的成品整体描述为仅 GPLv3；分发时须一并处理第三方许可及对应源码义务。依赖和素材来源见 [THIRD_PARTY.md](THIRD_PARTY.md)。

项目原有角色图片继续复用，未生成替代图片；复用不代表取得新的图片授权。
