# 第三方来源

| 项目 / 素材 | 来源 | 说明 |
| --- | --- | --- |
| ikaBeat 原代码及图片 | https://github.com/yukinsnow/ikaBeat | 原代码 GPLv3；图片权利依原仓库声明归原权利人 |
| Essentia.js 0.1.3 | https://github.com/MTG/essentia.js | AGPLv3，许可原文随运行时打包；未修改上游运行时 |
| Essentia | https://essentia.upf.edu/ | Essentia.js 内含的底层音频算法，源码应匹配实际分发版本 |
| React / React DOM | https://github.com/facebook/react | MIT |
| Tauri | https://github.com/tauri-apps/tauri | MIT / Apache-2.0，详见上游许可 |
| Lucide | https://github.com/lucide-icons/lucide | ISC |

新界面的 `ika.jpg` 对应原仓库 `Resource/ika.jpg`；`icon.jpg` 对应 `Resource/icon.jpg`；应用图标以 `src/Assets.xcassets/AppIcon.appiconset/icon_512x512.png` 为来源，由 Tauri CLI 转换为桌面和移动端规格。原始三张图片按原字节复制，没有 AI 重绘或裁剪写回。

依赖精确版本由 `package-lock.json` 固定。上表不是完整的传递依赖许可清单；正式分发需保留实际依赖的 notices / licenses，并提供所需对应源码。原仓库 GPLv3 LICENSE 和 Essentia.js AGPLv3 LICENSE 均在交付中保留。
