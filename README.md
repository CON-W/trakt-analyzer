# Trakt Analyzer 🎬

> 一个现代化 Apple 风格的 Trakt.tv 观看记录分析工具。连接你的 Trakt 账号，深入分析你的观影习惯，用数据讲述你的观影故事。

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![React](https://img.shields.io/badge/React-18-61DAFB)
![Vite](https://img.shields.io/badge/Vite-5-646CFF)
![Tailwind](https://img.shields.io/badge/Tailwind-3-06B6D4)
![Express](https://img.shields.io/badge/Express-4-000000)

---

## ✨ 特性一览

| 特性 | 说明 |
|------|------|
| 🎨 **Apple 风格设计** | 毛玻璃效果、SF Pro 字体、优雅的动画过渡 |
| 📊 **全面分析** | 月度趋势、星期分布、时段分析、年度统计 |
| 🏆 **内容排行** | 最常观看的内容、导演、演员排行 |
| 🎭 **类型分布** | 可视化你的内容偏好 |
| 🔥 **连续观看** | 追踪你的最长连续观看记录 |
| 🖼️ **动态背景** | 自动轮播你的观看海报墙 |
| 🎯 **智能推荐** | 基于你的观看记录推荐你可能喜欢的作品 |
| 📅 **即将上映** | 追踪你追的剧集更新和即将上映的电影 |
| 🔍 **搜索筛选** | 快速搜索和排序你的观看记录 |
| 📱 **响应式设计** | 完美适配桌面和移动设备 |
| 🌐 **中文支持** | 中文标题、中文简介、豆瓣评分 |
| ⚡ **缓存加速** | 7天媒体缓存 + 1小时分析缓存 |
| 🎬 **人物详情** | 查看导演/演员的全部作品，标记已看过的 |

---

## 🚀 快速开始

### 前置要求

- **Node.js 18+**（推荐 20+）
- **Trakt.tv 账号**（[注册](https://trakt.tv/join)）
- **Trakt API 应用**（[创建应用](https://trakt.tv/oauth/applications)）
- **TMDB API Key**（可选，[申请](https://www.themoviedb.org/settings/api)，用于中文标题和丰富信息）

### 安装步骤

#### 1️⃣ 克隆项目

```bash
git clone https://github.com/your-username/trakt-analyzer.git
cd trakt-analyzer
```

#### 2️⃣ 安装依赖

```bash
npm install
```

#### 3️⃣ 配置环境变量

复制环境变量模板：

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入你的 API Key：

```env
# === Trakt API 配置（必需）===
# 1. 前往 https://trakt.tv/oauth/applications 创建应用
# 2. 设置 Redirect URI 为 http://localhost:5173/auth/callback
# 3. 获取 CLIENT_ID 和 CLIENT_SECRET
TRAKT_CLIENT_ID=your_trakt_client_id
TRAKT_CLIENT_SECRET=your_trakt_client_secret

# === TMDB API 配置（可选，强烈推荐）===
# 用于获取中文标题、海报、简介、评分等丰富信息
TMDB_API_KEY=your_tmdb_api_key
TMDB_LANGUAGE=zh-CN

# TMDB API 地址（默认 https://api.themoviedb.org/3）
# 如果在中国无法访问 api.themoviedb.org，可以使用镜像:
TMDB_API_URL=https://api.tmdb.org/3

# TMDB 图片地址（默认 https://image.tmdb.org/t/p）
# 如果在中国无法访问 image.tmdb.org，可以使用镜像:
TMDB_IMG_URL=https://image.tmdb.org/t/p
```

#### 4️⃣ 启动项目

**方式一：双击启动脚本（推荐）**

```bash
# 先启动后端
start-backend.bat

# 再启动前端
start-frontend.bat
```

**方式二：命令行启动**

```bash
# 启动后端（终端 1）
node server/index.js

# 启动前端（终端 2）
npx vite
```

#### 5️⃣ 打开浏览器

访问 **http://localhost:5173**，点击「通过 Trakt 登录」完成授权即可。

---

## 🏗️ 项目结构

```
trakt-analyzer/
├── server/
│   └── index.js              # 后端服务器（Express + Trakt API + TMDB API）
├── src/
│   ├── components/
│   │   ├── Charts.jsx            # 图表组件（Recharts）
│   │   ├── LoadingProgress.jsx   # 加载进度组件
│   │   ├── LoadingSpinner.jsx    # 加载动画
│   │   ├── Navbar.jsx            # 导航栏（含问候语、刷新倒计时）
│   │   └── StatCard.jsx          # 统计卡片
│   ├── context/
│   │   ├── AuthContext.jsx       # 认证上下文
│   │   └── DataCacheContext.jsx  # 数据缓存上下文
│   ├── pages/
│   │   ├── Home.jsx              # 首页（登录页）
│   │   ├── Dashboard.jsx         # 分析概览（背景海报、台词轮播、推荐等）
│   │   ├── Movies.jsx            # 电影记录页
│   │   ├── Shows.jsx             # 剧集记录页
│   │   └── AuthCallback.jsx      # OAuth 回调页
│   ├── utils/
│   │   └── api.js                # API 工具（SSE 流式加载）
│   ├── App.jsx                   # 应用入口（路由配置）
│   ├── index.css                 # 全局样式（Tailwind + 自定义动画）
│   └── main.jsx                  # 渲染入口
├── .env                          # 环境变量（已加入 .gitignore）
├── .env.example                  # 环境变量示例
├── .gitignore                    # Git 忽略规则
├── index.html                    # HTML 模板
├── package.json                  # 依赖配置
├── postcss.config.js             # PostCSS 配置
├── tailwind.config.js            # Tailwind 配置
├── vite.config.js                # Vite 配置（含 API 代理）
├── start-backend.bat             # 后端启动脚本
└── start-frontend.bat            # 前端启动脚本
```

---

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| **前端框架** | React 18 + React Router 6 |
| **构建工具** | Vite 5 |
| **样式** | Tailwind CSS 3 + 自定义 Apple 风格主题 |
| **图表** | Chart.js 4 + react-chartjs-2 |
| **后端** | Express.js |
| **HTTP 客户端** | Axios |
| **API** | Trakt.tv API + TMDB API |
| **数据流** | SSE (Server-Sent Events) 流式加载 |
| **设计系统** | Apple Design System (SF Pro, 毛玻璃, 渐变) |

---

## 📊 功能详解

### 🏠 概览页面（Dashboard）

概览页面是进入应用后的主界面，包含：

- **🖼️ 动态背景海报墙** - 自动轮播你观看过的作品海报，每 7 秒切换
- **💬 台词轮播** - 随机展示你观看过作品的经典台词
- **📊 核心统计** - 右下角实时显示电影数、剧集数、平均评分、总观看时长
- **📅 即将上映** - 展示即将上映的电影和剧集新季
- **📺 追剧提醒** - 追踪你正在追的剧集，显示下一集播出倒计时
- **👥 常看的人** - 展示你最常看的导演和演员
- **🎯 为你推荐** - 基于你的观看记录智能推荐
- **🎭 类型偏好** - 可视化你的内容类型分布

### 🎬 电影页面（Movies）

- 海报网格展示，支持懒加载
- 搜索（按标题/年份）
- 排序（最近/名称/年份/评分）
- 点击查看详情（简介、导演、演员、评分）
- 实时海报加载进度

### 📺 剧集页面（Shows）

- 与电影页面类似的功能
- 额外显示：季数、集数、已完结状态
- 创作者/编剧信息

### 🔄 自动刷新

- 导航栏显示 5 分钟倒计时
- 自动刷新即将上映和追剧数据
- 支持手动点击刷新

---

## 🔧 配置说明

### Trakt API 配置

1. 访问 [Trakt.tv OAuth Applications](https://trakt.tv/oauth/applications)
2. 点击 **Create New Application**
3. 填写：
   - **Name**: 任意名称（如 `Trakt Analyzer`）
   - **Description**: 简短描述
   - **Redirect URI**: `http://localhost:5173/auth/callback`
4. 保存后复制 **Client ID** 和 **Client Secret** 到 `.env`

### TMDB API 配置（可选但推荐）

1. 访问 [TMDB API Settings](https://www.themoviedb.org/settings/api)
2. 申请 API Key（选择 Developer 类型）
3. 复制 API Key (v3 auth) 到 `.env`

配置 TMDB 后可获得：
- ✅ 中文标题
- ✅ 中文简介
- ✅ 高清海报和背景图
- ✅ 评分信息
- ✅ 导演/演员信息
- ✅ 类型标签
- ✅ 经典台词
- ✅ 即将上映信息
- ✅ 智能推荐

---

## 📝 注意事项

### 首次使用
- 首次加载需要从 Trakt 获取所有观看记录，速度取决于你的记录数量
- 建议配置 TMDB API Key 以获得最佳体验
- 如果在中国大陆使用，建议配置 TMDB 镜像地址

### 缓存机制
- **媒体信息缓存**: 7 天（海报、简介等）
- **分析结果缓存**: 1 小时
- **历史记录缓存**: 30 分钟
- 缓存过期后会自动重新获取

### 数据安全
- API Key 存储在本地 `.env` 文件中，不会上传到 GitHub
- Trakt 访问令牌存储在浏览器 localStorage 中
- 所有数据通过本地服务器中转，不会泄露给第三方

---

## 🤝 贡献指南

本项目会持续更新迭代，欢迎贡献！

### 开发流程

```bash
# 1. Fork 项目
# 2. 创建功能分支
git checkout -b feature/your-feature

# 3. 提交更改
git add .
git commit -m "feat: 添加某个功能"

# 4. 推送到远程
git push origin feature/your-feature

# 5. 创建 Pull Request
```

### 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

- `feat:` 新功能
- `fix:` 修复
- `docs:` 文档更新
- `style:` 样式调整
- `refactor:` 重构
- `perf:` 性能优化
- `chore:` 构建/工具

---

## 🗺️ 开发路线图

- [x] 基础 Trakt 认证
- [x] 电影/剧集观看记录
- [x] 分析概览页面
- [x] TMDB 中文支持
- [x] 动态背景海报墙
- [x] 智能推荐
- [x] 即将上映/追剧提醒
- [x] 人物详情弹窗
- [ ] 年度报告生成
- [ ] 数据导出功能
- [ ] 多语言支持
- [ ] PWA 支持
- [ ] 暗色/亮色主题切换
- [ ] 自定义分析时间段

---

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源。

基于 [xbgmsharp/trakt](https://github.com/xbgmsharp/trakt) 构建。

---

## 🙏 致谢

- [Trakt.tv](https://trakt.tv/) - 提供影视数据 API
- [TMDB](https://www.themoviedb.org/) - 提供影视元数据
- [xbgmsharp/trakt](https://github.com/xbgmsharp/trakt) - 原始项目
- [Chart.js](https://www.chartjs.org/) - 图表库
- [Tailwind CSS](https://tailwindcss.com/) - CSS 框架
- [Vite](https://vitejs.dev/) - 构建工具

---

> **💡 提示**: 如果遇到问题，请检查：
> 1. 后端是否已启动（`http://localhost:3001/api/health`）
> 2. `.env` 文件是否配置正确
> 3. Trakt API 的 Redirect URI 是否匹配
> 4. 浏览器是否允许弹窗（用于 Trakt 登录）
