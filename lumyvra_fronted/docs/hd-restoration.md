# 高清素材修复记录

使用内置 imagegen 编辑模式。保留源图，高清图为参考原图的细节重建，并非无损找回原始设计像素。

## 产物

- `public/assets/hd/hero.webp`: 1536×1024，原始人物素材 631×355；以首页参考图校准构图。
- `public/assets/hd/promo.webp`: 1536×1024，原素材 339×197；移除烘焙在图片中的文案与导航。
- `public/assets/hd/{summer,city,stars,future,ocean,rain}.webp`: 1254×1254，原图约 66–114 像素宽；删除 UI 后恢复场景。
- 同目录 PNG 为生成原件，WebP 为不改变尺寸的编码转换。未对旧缩略图做普通插值放大冒充高清。

## 布局修复

- 删除首页新增英文眉题、补充说明和底部引导，保留参考中的标题、说明和 CTA。
- 右侧人物与落日背景延伸至四张玻璃卡片后方，恢复原型的图层关系。
- 桌面六列作品，独立的封面、文本、播放图标；避免截图文字重复显示。
- 修正社区大图仍按 220px 请求资源的 sizes 错误；高清素材使用 quality=90。
- 删除宣传背景 150% / 210% 的放大，以完整清晰图像替换。

## 约束与检查

参考首页仅 429×468，原始设计画板、字体和分层源图均未提供。因此布局按可观察的相对位置和比例校准，不能声称与未知原始设计逐像素一致。自动审批策略拒绝本地 Chrome 截图启动；没有完成浏览器视觉验收。

验证完成：生产构建、TypeScript、ESLint 全部通过。首页、宣传、社区、创作、播放器 HTTP 200。Next Image 的 q=90 接口对两个背景返回 1536×1024，对六张封面的 640 宽请求返回 640×640；全部 HTTP 200。社区和创作页服务端 HTML 的图片 URL 已指向 /assets/hd，非旧裁切路径。预览继续运行在 http://localhost:3000。

## ImageGen 提示词

### hero

Restore the hero illustration from the supplied homepage screenshot, using the character crop as identity reference. Girl with purple-blue headphones on far right, closed eyes facing left, sunset sea and dark starry navy sky on left. Preserve original colors and placement. Remove all UI, text, cards, buttons and borders. High-resolution detailed anime illustration.

### summer

Restore this exact tiny screenshot crop as a clean high-definition SQUARE album artwork, 1024 by 1024 pixels. Target scene: a pink-orange beach sunset, dark palm trees rising at left and right, sun at the horizon, violet ocean waves and rosy clouds. Preserve the source palette, recognizable silhouettes, arrangement and anime illustration style. Reconstruct crisp illustrated detail with fine clean lines, natural textures and rich but faithful color. Fill the entire square edge-to-edge with the SCENE ONLY. Remove ALL text, captions, letters, playback circles, triangle icons, black bottom label areas, UI overlays, borders, frames and rounded corners. Reconstruct unobstructed landscape underneath those removed UI elements. This is a high-fidelity cleanup and detail restoration, not a new design. Output a single artwork, no mockup, no grid, no typography.

### city

Restore this exact tiny screenshot crop as a clean high-definition SQUARE album artwork, 1024 by 1024 pixels. Target scene: a violet and cobalt twilight futuristic city skyline, many luminous blue skyscrapers, tallest central tower, purple and pink starry sky. Preserve the source palette, recognizable silhouettes, arrangement and anime illustration style. Reconstruct crisp illustrated detail with fine clean lines, natural textures and rich but faithful color. Fill the entire square edge-to-edge with the SCENE ONLY. Remove ALL text, captions, letters, playback circles, triangle icons, black bottom label areas, UI overlays, borders, frames and rounded corners. Reconstruct unobstructed landscape underneath those removed UI elements. This is a high-fidelity cleanup and detail restoration, not a new design. Output a single artwork, no mockup, no grid, no typography.

### stars

Restore this exact tiny screenshot crop as a clean high-definition SQUARE album artwork, 1024 by 1024 pixels. Target scene: an azure blue sky of sculptural bright white cumulus clouds, sparkling stars and crystalline blue ocean, an airy luminous anime cloudscape. Preserve the source palette, recognizable silhouettes, arrangement and anime illustration style. Reconstruct crisp illustrated detail with fine clean lines, natural textures and rich but faithful color. Fill the entire square edge-to-edge with the SCENE ONLY. Remove ALL text, captions, letters, playback circles, triangle icons, black bottom label areas, UI overlays, borders, frames and rounded corners. Reconstruct unobstructed landscape underneath those removed UI elements. This is a high-fidelity cleanup and detail restoration, not a new design. Output a single artwork, no mockup, no grid, no typography.

### future

Restore this exact tiny screenshot crop as a clean high-definition SQUARE album artwork, 1024 by 1024 pixels. Target scene: a tropical coast with two dark slender palms on the left, bright pink-orange sun at the horizon, lavender water, cotton-candy peach clouds. Preserve the source palette, recognizable silhouettes, arrangement and anime illustration style. Reconstruct crisp illustrated detail with fine clean lines, natural textures and rich but faithful color. Fill the entire square edge-to-edge with the SCENE ONLY. Remove ALL text, captions, letters, playback circles, triangle icons, black bottom label areas, UI overlays, borders, frames and rounded corners. Reconstruct unobstructed landscape underneath those removed UI elements. This is a high-fidelity cleanup and detail restoration, not a new design. Output a single artwork, no mockup, no grid, no typography.

### ocean

Restore this exact tiny screenshot crop as a clean high-definition SQUARE album artwork, 1024 by 1024 pixels. Target scene: an idyllic tropical cove with turquoise shallow water, cream sand, a tall green rocky island to the right, blue summer sky and white clouds. Preserve the source palette, recognizable silhouettes, arrangement and anime illustration style. Reconstruct crisp illustrated detail with fine clean lines, natural textures and rich but faithful color. Fill the entire square edge-to-edge with the SCENE ONLY. Remove ALL text, captions, letters, playback circles, triangle icons, black bottom label areas, UI overlays, borders, frames and rounded corners. Reconstruct unobstructed landscape underneath those removed UI elements. This is a high-fidelity cleanup and detail restoration, not a new design. Output a single artwork, no mockup, no grid, no typography.

### rain

Restore this exact tiny screenshot crop as a clean high-definition SQUARE album artwork, 1024 by 1024 pixels. Target scene: a magical pink flowering forest, purple-blue tree trunks along both sides, pink blossoms and petals, a glowing pale blue path leading into the center. Preserve the source palette, recognizable silhouettes, arrangement and anime illustration style. Reconstruct crisp illustrated detail with fine clean lines, natural textures and rich but faithful color. Fill the entire square edge-to-edge with the SCENE ONLY. Remove ALL text, captions, letters, playback circles, triangle icons, black bottom label areas, UI overlays, borders, frames and rounded corners. Reconstruct unobstructed landscape underneath those removed UI elements. This is a high-fidelity cleanup and detail restoration, not a new design. Output a single artwork, no mockup, no grid, no typography.

### promo

Restore ONLY the background illustration from this tiny website screenshot as a high-resolution landscape illustration 1536x1024, no website UI. Preserve the exact anime scene: back view of a young dark-haired man sitting on a city rooftop at dusk playing an acoustic guitar, on the lower RIGHT half, wearing a loose pale blue shirt; warm peach sun setting over a river and dense luminous city skyline, tall narrow lit tower at far right, stars and flowing pink violet musical light trails in deep blue sky. Keep left 50% mostly sky for HTML headline overlay. Preserve camera view, palette, subject placement and proportions. Remove ALL logo, text, headline, buttons, icons, navigation bar, borders and UI. Restore sharp architectural windows, detailed hair, crisp guitar strings, nuanced clouds, clean hand-drawn anime linework. A clean standalone high-detail artwork, not a screenshot or UI mockup.
