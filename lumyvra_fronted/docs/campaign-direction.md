# 更大胆的首页

用户授权以吸引用户为目标继续改版。本次选择音乐厂牌海报方向：保留炭黑 / 纸白 / 黄绿色、全站导航和功能，增加字号、画幅与明暗对比。

- 超大两行中文主标题「别只听歌。让世界听你。」；保留灵感输入与可交互 Three.js 声场，强化真实合成试听的按钮。
- 增加三个手动切换的音乐场景：逃离日常、深夜独白、写给某个人。切换图片、叙事和提示词，创作链接同时携带风格和情绪参数；服务端校验允许值。
- 唱片海报式作品展示，展示实际高清素材。封面与做同款直达对应模板；手机横向滑动。
- 新的舞台摄影感背景，承载草稿、打磨和发布流程；大字号收尾邀请。
- 页面样式集中在 campaign.css，并限定 .campaign-landing 或独有组件类名，工作台和其他路由继续使用共享主题。保留减少动画设置和所有原有声场清理逻辑。

## 新资产

通过内置 imagegen 生成，属于品牌概念图，不是真实活动摄影。

- public/assets/hd/stage-campaign-source.png：原始图，1672 × 941。
- public/assets/hd/stage-campaign.webp：网页用 WebP，约 136 KiB，编码质量 92；只进行格式编码，保留原图。

最终提示词：

> Use case: photorealistic-natural / music brand campaign. Generate ONE cinematic widescreen 1536x1024 or wider editorial photograph to be used as a music creation website background, no text no logos no typography no interface. A young adult indie singer in a loose dark shirt, viewed from behind and slightly from the side on the RIGHT half of frame, leaning into a microphone on a small underground concert stage. Silhouette and shoulder, no identifiable facial details, a raised arm holding the mic naturally. Dramatic narrow warm ivory stage lights, subtle pale acid-yellow light through textured haze, deep near-black charcoal surroundings. Restrained analog 35mm music magazine photography, authentic tactile grain, realistic live music atmosphere, high contrast but beautiful detailed luminous haze, slight optical halation only around lights. Large dark negative space on LEFT half for website headline. One subject, natural anatomy, convincing microphone, no crowd faces, no neon purple, no sci-fi, no glossy CGI, no decorative symbols. Strong off-centre composition. Keep image sharp and cinematic, not globally blurred.

浏览器截图验收仍未完成，不声称已验证跨视口实际渲染。生成、发布依然为本地演示，未新增真实后台服务。

## 2026-10-09 粒子增强

- 首屏在原有 Three.js 声场外增加星尘、十字星芒和错峰流星，移动鼠标有短光尾，点击非控件区域有光点爆发和扩散圆环。
- 情绪场景与舞台摄影增加漂浮光点，使用遮罩降低文字区域的密度。页尾增加最多 2,880 个点组成的多层波浪，鼠标改变局部起伏，点击向波面传播扰动。
- 四块 Canvas 2D 装饰层复用同一引擎；不拦截按钮、输入框和触屏滚动。首屏与页尾按钮统一暂停新粒子层和现有 Three.js。
- 装饰层限制到约 30 fps、DPR 最高 1.5；手机降低点数；离屏、标签页隐藏、暂停和系统减少动态效果均停止持续绘制；临时光点与扩散环设数量上限并自动回收。
- 新增四项引擎测试，与四项原有 Three.js 交互测试一起通过；验证生命周期、暂停/可见性/减少动画、点击有界缓冲和移动端密度。测试使用模拟 Canvas，不代表实际 GPU 或浏览器视觉验收。

## 覆盖修复与中文排版

截图审查：原实现漏掉创作方式条和作品展示区，情绪区的粒子只存在于右侧图片中；流星只在 stars 变体中绘制；链接与按钮的 pointermove 被整体过滤，导致封面上没有光尾。原排版的中文标题使用 -0.065em 的紧字距，说明文字多数只有 12–13px，标题和正文比例过于悬殊。

保留现有炭黑、纸白、黄绿品牌、路由和 SSR 内容；按音乐创作网站的海报排版做局部演进，设计变化 / 动效 / 密度取 7 / 8 / 4。不新增视觉素材或依赖。

- 首页六个 section 各自使用同一粒子引擎，覆盖自身全部区域；所有变体都绘制星芒和流星。装饰 Canvas 在封面上层且 pointer-events:none，密度按面积自适应，离屏仍暂停。
- 链接与按钮支持悬停光尾；编辑框抑制光尾；控件点击仍正常导航或提交，非控件区域保留点击爆发。
- 中文标题明确使用本地 Noto Sans SC Variable，字重统一约 500、字距 -0.025em、行高 1.26–1.45；桌面歌曲名 20–25px，说明 15–16px，移动端说明以 14px 为主。提亮正文，精简首屏与作品区文案。
- 验证：10 项动效测试、ESLint、生产构建通过；localhost 返回 200，SSR 检查确认六个 section 均有独立 Canvas。没有可用浏览器自动化工具，未声称完成实际截图或 GPU 验收。
