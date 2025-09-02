# 技术假设 (Technical Assumptions)

## 4.1 代码仓库结构 (Repository Structure)

- **假设**: 采用 **Monorepo** 结构。
- **待定决策**: 具体的Monorepo管理工具由**架构/开发团队**进行选型。

## 4.2 服务架构 (Service Architecture)

- **假设**: 采用 **无服务器架构 (Serverless)**。
- **约束**: 本地开发流程**必须**围绕Cloudflare Wrangler CLI建立。

## 4.3 测试要求 (Testing Requirements)

- **假设**: MVP阶段的测试策略为 **单元测试 + 集成测试 (Unit + Integration Tests)**。
- **待定决策**: 具体的测试库由**架构/开发团队**进行选型。

## 4.4 其他技术假设与请求 (Additional Technical Assumptions and Requests)

- **核心平台**: **Cloudflare** (Workers, Pages, Queues, D1, R2, Workers AI)。
- **开发语言**: **TypeScript**。
- **数据库**: **Cloudflare D1**，并采用 **Drizzle ORM** 进行Schema管理和迁移。
- **前端框架**: 采用现代前端框架，具体选型由**UX/设计师**决定。