# 首页改版：音乐品牌与可交互声场

用户要求优先提高吸引力、减少模板感，并授权 Three.js 动态方案；此次首页不再以逐像素复制旧原型为目标。

## 设计依据

- 旧页面：蓝紫渐变、四张等宽功能卡、动漫首屏、六列小封面；主入口偏工具目录，文案重功能而缺少创作动机。
- 新方向：独立音乐品牌式首页；炭黑 #10110f、纸白 #f0f0e8、单一强调色 #e0f298；原生 CSS 与既有 Lucide 图标。设计变化 8、动效 6、信息密度 4。
- 保留品牌、全部路由与主导航标签。首页 CTA 修正为直达 /create，原先误导到 /membership。
- 首屏情绪文案、直接输入灵感、三种创作入口、错位专辑展示、创作步骤、收尾邀请。移除首页虚构播放量与收藏量，不新增虚假用户评价。
- 首页独有内容样式限定于 .music-landing；后续全站改版将导航、页脚和基础配色推广到所有页面，详见 site-design-system.md。

## 动态实现

- 首屏是 Three.js 实时粒子声场，并未生成或宣称生成视频。
- ShaderMaterial 在 GPU 中计算扭曲环形粒子表面。鼠标悬停局部推开粒子，拖动增强离散，点击触发向外传播的波纹，离开后逐渐复位；接触时减缓空闲形变。基于投影后的屏幕坐标计算排斥，避免旋转和宽高比导致交互点错位。
- 试听为本地 Web Audio 原创合成片段「暮色」，24 秒，用户点击才播放。该声音不来自作品列表，也不是模型生成示例。
- AnalyserNode 的真实频谱能量驱动声场起伏。切换到后台停止声音，卸载销毁 AudioContext。
- Three.js 通过动态 import 加载，不阻塞服务端标题、表单、静态内容。桌面约 3.7 万粒子，窄屏或低并发设备约 1.35 万粒子，像素倍率上限 1.6。
- IntersectionObserver 暂停屏幕外渲染，visibilitychange 暂停后台绘制；支持手动暂停与 prefers-reduced-motion。WebGL 不可用或上下文丢失时显示静态唱片图形。
- effect 清理取消帧、释放 GPU 几何 / 材质 / renderer、移除事件和观察器。
- 触控使用 pointer 事件并保留纵向页面滚动；pointercancel、失去捕获和切换后台都会清理拖动。暂停和减少动画模式不响应粒子扰动。

## 字体与交互更新

- 全站本地加载 Noto Sans SC Variable 与 Manrope Variable，使用 Fontsource 的 unicode-range 分片与 font-display: swap；英文、数字优先 Manrope，中文由 Noto Sans SC 显示。字体包许可证随依赖保留，部署后无需访问字体 CDN。依据：[Fontsource 自托管安装说明](https://fontsource.org/docs/getting-started/install)。
- 首页标题改为实际可变字重 500，减轻过粗笔画，缩小负字距，并调整手机标题字号；全站主要标题同步减重。
- `node --test tests/sound-field.test.mjs` 覆盖跨画幅鼠标坐标、点击波纹、拖动取消、回弹、暂停、减少动画、后台与资源释放。测试使用真实 Three.js 几何与材质，模拟 renderer，不代表 GPU shader 编译或视觉验收。

## 交互与边界

- 首页输入和预设灵感通过 GET /create?prompt=... 传入创作工作台，服务端限长 500 字；保留原有 mode 参数。
- 正式歌曲生成、账号、支付仍是原型。首页试听具有真实声音，不改变其他示例作品尚无音频的状态。
- Three.js API 依据：[Three.js 官方文档](https://threejs.org/docs/)。
- 浏览器截图启动此前被自动审批策略阻止，此轮不绕过该限制；生产构建、类型、Lint 与 HTTP / SSR 检查不等于浏览器视觉验收。

检查结果：Next.js 生产构建通过；TypeScript 与 ESLint 通过；首页、带 prompt 的创作页、作品广场和会员页返回 200。生产预渲染 HTML 含新标题、灵感表单及试听说明，创作页 SSR textarea 含传入的灵感内容。尚未完成真实浏览器中的 WebGL 视觉、试听与跨视口验收。
