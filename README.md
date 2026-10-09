# Lumyvra

AI 音乐创作项目，前后端统一放在本仓库。

## 目录

```text
lumyvra/
├── lumyvra_fronted/    Next.js 前端、静态资源、测试和设计文档
└── lumyvra_backend/    Go 后端预留目录，尚未实现
```

## 启动前端

需要 Node.js 20.9 或更高版本，推荐 Node.js 22。

```bash
cd lumyvra_fronted
npm ci
npm run dev
```

打开 <http://localhost:3000>。

前端检查和生产构建：

```bash
npm run lint
npm run test:interaction
npm run test:works
npm run build
```

运行生产构建使用 `npm run start`。具体页面、实现与素材说明见 [前端 README](lumyvra_fronted/README.md)。

## 当前进度

已完成初步前端搭建，包括首页粒子互动、创作灵感、创作工作台、草稿、发布演示、个人中心和作品广场。当前生成和发布使用浏览器本地演示数据，尚未接入真实服务。

后端计划使用 Go，目前仅预留目录，尚未添加服务、接口、数据库或依赖。

本地依赖、构建产物、环境变量与密钥文件不提交；原始设计素材保留在前端目录中。
