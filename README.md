# ikaBeat

<img src="modern/public/assets/app-icon.png" alt="ikaBeat" width="96" />

**离线音乐 BPM 分析工具 · Windows / macOS / Android / iOS**

作者：**[Github@Yukinsnow](https://github.com/Yukinsnow)**。

ikaBeat 2.0 使用 Tauri 2、React、TypeScript 和 Essentia WebAssembly 重构，保留原来的 ika 横幅、角色图片和应用图标。音乐在设备本地分析，无需上传。

> **当前正式发布版本为 v2.0.0。** 四个平台已通过云端编译和打包；原生应用及手机真机的导入、分析、导出仍待完整验收。下载前请留意各平台的签名和运行时要求。

## 下载

[查看 v2.0.0 全部下载与更新说明](https://github.com/yukinsnow/ikaBeat/releases/tag/v2.0.0)

| 平台 | 推荐下载 | 说明 |
| --- | --- | --- |
| Windows x64 | [绿色版 ZIP](https://github.com/yukinsnow/ikaBeat/releases/download/v2.0.0/ikaBeat_2.0.0_Windows_x64_portable.zip) | 解压后运行 `ikaBeat.exe`；需系统已有 WebView2 |
| Windows x64 | [安装版 EXE](https://github.com/yukinsnow/ikaBeat/releases/download/v2.0.0/ikaBeat_2.0.0_x64-setup.exe) | NSIS 安装程序，未正式代码签名 |
| macOS Apple Silicon / Intel | [免安装 APP ZIP](https://github.com/yukinsnow/ikaBeat/releases/download/v2.0.0/ikaBeat_2.0.0_macOS_universal_app.zip) · [DMG](https://github.com/yukinsnow/ikaBeat/releases/download/v2.0.0/ikaBeat_2.0.0_universal.dmg) | Universal，未正式签名或公证 |
| Android ARM64 | [开发版 APK ZIP](https://github.com/yukinsnow/ikaBeat/releases/download/v2.0.0/ikaBeat_2.0.0_Android_arm64-debug.zip) | 常见现代 Android 真机；解压后安装 APK |
| Android ARMv7 | [开发版 APK ZIP](https://github.com/yukinsnow/ikaBeat/releases/download/v2.0.0/ikaBeat_2.0.0_Android_arm-debug.zip) | 32 位 ARM 设备 |
| Android x86_64 | [开发版 APK ZIP](https://github.com/yukinsnow/ikaBeat/releases/download/v2.0.0/ikaBeat_2.0.0_Android_x86_64-debug.zip) | x86_64 设备或模拟器 |
| iOS / iPadOS ARM64 | [未签名 IPA](https://github.com/yukinsnow/ikaBeat/releases/download/v2.0.0/ikaBeat_2.0.0_iOS_arm64_unsigned.ipa) | 必须用 Apple 开发者证书及相应 provisioning 签名后安装 |

另提供 [Web 静态资源](https://github.com/yukinsnow/ikaBeat/releases/download/v2.0.0/ikaBeat_2.0.0_web.zip)、[独立现代版源码](https://github.com/yukinsnow/ikaBeat/releases/download/v2.0.0/ikaBeat_2.0.0_modern-source.zip) 和 [SHA256 校验值](https://github.com/yukinsnow/ikaBeat/releases/download/v2.0.0/SHA256SUMS.txt)。

需要旧版原生 macOS 应用时，可下载 [1.1.0](https://github.com/yukinsnow/ikaBeat/releases/tag/1.1.0)。它与跨平台重构版独立保留。

## 使用

1. 启动应用，选择音频；桌面版也支持拖入文件。
2. 等待“正在计算BPM”，查看 BPM、原始算法置信度、节拍数量和波形。
3. 使用搜索、状态筛选查看结果，按需导出 CSV。

每批队列最多 30 首；单文件最大 80 MB，时长 5 秒至 10 分钟。任务串行执行，支持取消、失败提示和本机最近 100 首已完成记录。原始音频不保存在历史中。

音频解码依赖操作系统和 WebView。当前测试覆盖合成 PCM WAV；MP3 及 FLAC、OGG、AIFF、AAC、M4A 仍需在目标平台验收，不能保证各平台格式覆盖完全一致。置信度为原始数值，不是百分比；双倍或半速节奏需要结合听感判断。

### Windows 绿色版

完整解压 ZIP，保留 EXE 旁的 `portable.flag`。绿色模式把历史和缓存写入程序旁的 `data/`；迁移时复制整个文件夹。需要系统已有 Microsoft Edge WebView2 Runtime，此轻量包不包含或自动安装运行时。[详细说明](modern/docs/绿色版.md)

macOS `.app` ZIP 可解压后直接打开，历史和缓存仍使用系统标准目录。Android APK 是包含调试符号的开发版本，体积较大；iOS IPA 未签名，不能直接安装到普通 iPhone。

## 本地开发

现代版代码位于 [`modern/`](modern/)，旧版 Swift / Xcode 工程保留在仓库原目录。

需要 Node.js 24 和 npm：

```sh
git clone https://github.com/yukinsnow/ikaBeat.git
cd ikaBeat/modern
npm ci
npm run dev
```

打开终端显示的地址，默认 `http://localhost:1420`。生产构建与测试：

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

原生构建需要对应的 Rust、Windows C++ / SDK、Xcode 或 Android SDK / NDK 工具链，详见 [现代版开发与构建说明](modern/README.md)。四端构建和桌面免安装包分别由仓库的两个 GitHub Actions 工作流提供，可手动触发。

## 构建与验证

- [四平台构建成功记录](https://github.com/yukinsnow/ikaBeat/actions/runs/39365079143)
- [Windows / macOS 免安装构建成功记录](https://github.com/yukinsnow/ikaBeat/actions/runs/39366673811)
- [构建结果与验收边界](modern/docs/构建结果.md)
- [项目分析与迁移说明](modern/docs/项目分析与迁移.md)

已执行 TypeScript 检查、生产构建、3 项单元测试及 2 项端到端测试；真实运行 Essentia WASM 检测 120 / 140 BPM 合成音频，并测试静音失败、队列、取消、历史恢复和 CSV 导出。编译成功不替代原生运行及手机实机验收。

## 来源与许可

原代码 GPLv3 许可保存在 [LICENSE](LICENSE)。Essentia.js 0.1.3 附带 AGPLv3，完整许可见 [第三方许可](modern/public/vendor/ESSENTIA-LICENSE.txt)，来源见 [THIRD_PARTY.md](modern/THIRD_PARTY.md)。包含 Essentia 的产物分发还需处理对应的第三方许可及源码义务。

ika 角色图片沿用原仓库，相关权利归原权利人；代码重构和图片复用不构成新的图片授权。
