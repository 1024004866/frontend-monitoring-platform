# 项目验证记录

验证日期：2026-10-07

## 已通过

| 模块 | 验证命令 | 结果 |
| --- | --- | --- |
| 监控 SDK | `npm run build` | UMD、ESM 与类型声明构建成功 |
| React 管理后台 | `npm run build` | Webpack 生产构建成功 |
| React 页面 | Playwright 逐页检查 | 注册、登录、应用列表、流量、性能、接口、异常、Top 和地域页面正常渲染 |
| Egg.js 服务端 | `npm run tsc` | TypeScript 编译通过 |
| 本地演示 API | PowerShell HTTP 请求与 Playwright | 注册、登录态、应用列表和监控样例数据接口通过 |

浏览器检查期间修复了以下问题：

- 删除管理后台入口中用于测试监控能力的主动 `throw Error(1)`
- 修复用户信息接口失败后加载状态无法结束、页面停留在空白状态的问题
- 未登录或服务端不可用时自动跳转登录页
- 将页面标题由脚手架默认值改为 `Frontend Monitoring Platform`
- 增加无需 Docker 的本地演示模式和 `demo2026 / Demo2026` 演示账号
- 将“小慕问卷”作为被监控业务，统一页面、接口和异常样例数据
- 修复接口表格缺失字段时崩溃、性能样例数据结构不匹配及 SDK 错误处理二次异常

## 已知警告

管理后台构建成功，但 Webpack 报告以下资源超过推荐体积：

- 主 JavaScript 包约 2.05 MiB
- `moder.png` 约 1.72 MiB
- `logo.png` 约 952 KiB

后续可通过路由拆包、依赖分组、图片压缩和 WebP/AVIF 转换优化。

## 完整链路环境

当前验证机器没有安装 Docker，因此未验证 MySQL、Redis、Kafka、Elasticsearch 和 Kibana 组成的真实数据链路。本地演示模式已经绕过这些外部依赖，可用于功能展示和面试演示。

完整联调需要先执行：

```bash
cd service
export hostIP=你的本机IP
docker compose up -d
npm run dev
```

启动真实链路前还需设置 `MONITOR_USE_EXTERNAL_SERVICES=true`；未设置时默认使用本地演示数据。

Docker Compose 中的 Redis 已配置为使用 `auth` 密码，与 `config.local.ts` 保持一致。

## 代码质量现状

服务端 ESLint 配置文件名已从错误的 `slintrc` 修正为 `.eslintrc`。配置生效后，历史代码仍有较多 Egg ESLint 风格问题；这些问题不影响 TypeScript 编译，但应作为独立格式化任务处理，避免在功能验证提交中一次性改写大量业务文件。
