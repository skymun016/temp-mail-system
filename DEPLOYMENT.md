# 🚀 Cloudflare 部署指南

## 快速部署步骤

### 1. Cloudflare Pages 部署

1. **连接 GitHub 仓库**
   - 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
   - Pages → Create a project → Connect to Git
   - 选择 `skymun016/temp-mail-system` 仓库

2. **构建设置**
   - 项目名称: `temp-mail-system`
   - 生产分支: `main`
   - 构建命令: 留空
   - 构建输出目录: `public`

3. **部署**
   - 点击 "Save and Deploy"
   - 等待部署完成

### 2. 创建 KV 命名空间

1. **创建 KV**
   - Workers & Pages → KV → Create a namespace
   - 名称: `TEMP_MAILS`
   - 记录命名空间 ID: `435fdf61f77c4f02950cd20ff71bef1a`

### 3. 配置 Pages 环境（通过 Dashboard）

1. **进入 Pages 项目设置**
   - Pages → temp-mail-system → Settings

2. **绑定 KV 命名空间**
   - Settings → Functions → KV namespace bindings
   - 点击 "添加" 或 "Add binding"
   - 变量名: `TEMP_MAILS`
   - KV 命名空间: 选择 `TEMP_MAILS` (ID: 435fdf61f77c4f02950cd20ff71bef1a)
   - 点击 "保存" 或 "Save"

3. **添加环境变量**
   - Settings → Environment variables → 变量和机密
   - 点击 "添加" 或 "Add variable"
   - 添加以下变量：
     ```
     AUTH_TOKEN = your-secret-token (可选，API 认证)
     DOMAIN = your-domain.com (您的域名)
     EPIN = your-epin (可选，访问密码)
     ```
   - 每个变量添加后点击 "保存" 或 "Save"

### 4. 重新部署

- 配置完成后，点击 "Deployments" → "Retry deployment"
- 或者推送任意代码更改触发重新部署

### 4. 部署 Email Worker

1. **创建 Worker**
   - Workers & Pages → Create application → Create Worker
   - 名称: `temp-mail-email-worker`

2. **上传代码**
   - 复制 `email-worker.js` 内容
   - 粘贴到 Worker 编辑器
   - Save and Deploy

3. **配置 Worker**
   - Settings → Variables → Environment Variables
     ```
     DOMAIN = your-domain.com
     ```
   - Settings → Variables → KV Namespace Bindings
     ```
     Variable name: TEMP_MAILS
     KV namespace: TEMP_MAILS
     ```

### 5. 配置邮件路由

1. **启用邮件路由**
   - 进入域名管理 → Email → Email Routing
   - 点击 "Enable Email Routing"

2. **添加路由规则**
   - Routing rules → Create rule
   - 匹配表达式: `*@your-domain.com`
   - 操作: Send to Worker
   - Worker: `temp-mail-email-worker`

## 🎯 部署完成

部署完成后，您将获得：

- **Pages URL**: `https://temp-mail-system.pages.dev`
- **API 端点**: `https://temp-mail-system.pages.dev/api/mails`
- **邮件接收**: `anything@your-domain.com`

## 🔧 测试部署

1. **测试 API**
   ```bash
   curl "https://temp-mail-system.pages.dev/api/mails?email=test@your-domain.com"
   ```

2. **测试邮件接收**
   - 发送邮件到 `test@your-domain.com`
   - 检查 API 是否收到邮件

## 📝 注意事项

- 确保域名已添加到 Cloudflare
- 邮件路由需要域名验证
- KV 命名空间必须正确绑定
- Worker 和 Pages 都需要绑定相同的 KV
