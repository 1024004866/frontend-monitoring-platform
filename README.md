# Frontend Monitoring Platform

一个覆盖数据采集、异步处理、存储检索和可视化分析的前端监控平台。项目由浏览器监控 SDK、Egg.js 数据服务和 React 管理后台组成，可用于分析页面性能、JavaScript 异常、接口质量及访问流量。

## 核心能力

- 性能监控：采集 FCP、LCP、FID、TTFB、DNS、TCP、白屏时间及静态资源耗时
- 异常监控：捕获 JavaScript 运行时错误、未处理的 Promise 异常和资源加载失败
- 接口监控：拦截 XMLHttpRequest 与 Fetch，记录请求状态、耗时和异常信息
- 行为分析：记录页面访问、停留时间、路由变化及点击元素路径
- 流量分析：提供 PV、UV、IP、新用户、地域、浏览器、操作系统和设备统计
- 数据看板：展示性能趋势、错误趋势、高频异常和慢接口 Top 50
- 源码定位：结合 Source Map 还原压缩代码中的错误位置

## 技术栈

| 模块 | 技术 |
| --- | --- |
| 监控 SDK | TypeScript、Web Vitals、Performance API |
| 管理后台 | React 18、TypeScript、Ant Design、React Router、ECharts、Rematch |
| 数据服务 | Node.js、Egg.js、TypeScript、Kafka |
| 数据存储 | Elasticsearch、MySQL、Redis |
| 工程化 | pnpm workspace、Lerna、Docker Compose |

## 系统架构

```text
业务应用
   |
   | 性能、异常、请求、行为数据
   v
Web Monitoring SDK
   |
   | 批量上报
   v
Egg.js Report API --> Kafka --> 数据消费者
                                  |-- Elasticsearch：监控明细与聚合检索
                                  |-- MySQL：用户、应用等业务数据
                                  `-- Redis：实时指标与热点统计
                                             |
                                             v
                                  React + ECharts 管理后台
```

## 项目结构

```text
.
|-- desktop/             # React 监控管理后台
|-- packages/web-sdk/    # 浏览器监控 SDK
|-- service/             # Egg.js 数据接收、处理和查询服务
|-- imgs/                # 项目界面截图
|-- pnpm-workspace.yaml  # Monorepo 工作区配置
`-- lerna.json           # 多包版本与任务管理
```

## SDK 使用示例

```ts
import { Monitor } from '@frontend-watch-dog/web-sdk';

new Monitor({
  appId: 'your-app-id',
  api: 'http://localhost:7001/report',
  cacheMax: 10,
  webVitalsTimeouts: 10000,
});
```

SDK 会自动初始化性能采集、异常监听、请求拦截、路由监听和点击行为记录。达到批量阈值时统一上报，页面卸载前会通过图片请求发送剩余数据。

## 本地运行

### 环境要求

- Node.js 18+（已使用 Node.js 24 验证构建）
- pnpm 7.33.7
- 本地演示模式不需要 Docker
- 完整数据链路需要 Docker 与 Docker Compose

### 1. 安装依赖

```bash
npx pnpm@7.33.7 install --frozen-lockfile
```

如果 Windows 环境安装 workspace 依赖时遇到符号链接占用，也可以分别执行：

```bash
cd packages/web-sdk && npm install --workspaces=false
cd ../../desktop && npm ci
cd ../service && npm install --workspaces=false
```

### 2. 启动本地演示

本地开发默认启用演示模式，内置完整看板样例数据，不依赖 MySQL、Redis、Kafka 和 Elasticsearch：

```bash
npm run dev:service
npm run dev:desktop
```

演示账号：`demo2026`，密码：`Demo2026`。也可以直接在登录页注册新账号。

### 3. 启动完整数据链路

Docker Compose 会启动 MySQL、Redis、Kafka、Elasticsearch 和 Kibana。启动前需要为 Kafka 提供宿主机地址：

```bash
cd service
export hostIP=你的本机IP
docker compose up -d
```

Windows PowerShell：

```powershell
cd service
$env:hostIP = "你的本机IP"
docker compose up -d
```

启动真实基础设施后，为服务端设置 `MONITOR_USE_EXTERNAL_SERVICES=true`。

### 4. 启动服务端

```bash
cd service
export MONITOR_USE_EXTERNAL_SERVICES=true
pnpm dev
```

### 5. 启动管理后台

```bash
cd desktop
pnpm dev
```

## 数据模块职责

- Elasticsearch：保存性能、异常、接口和访问明细，支持聚合统计及条件检索
- MySQL：保存用户、应用配置等关系型业务数据
- Redis：缓存实时 PV、UV、IP 和排行榜等高频统计结果
- Kafka：解耦数据接收与持久化，降低集中上报对 API 的写入压力

## 已实现页面

- 应用管理
- 流量分析
- 性能分析与首屏查询
- 接口异常分析与接口查询
- JavaScript 异常趋势与源码定位
- 页面、地域、浏览器、操作系统和设备 Top 分析
- 地域分布

## 面试资料

项目的数据链路、个人职责表达和常见追问整理在 [docs/INTERVIEW_GUIDE.md](docs/INTERVIEW_GUIDE.md)。

实际构建和运行检查记录见 [docs/VALIDATION.md](docs/VALIDATION.md)。

## License

ISC
