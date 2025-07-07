# 临时邮箱系统 (Temp Mail System)

基于 Cloudflare Email Workers + KV 存储的独立临时邮箱服务，完全兼容 tempmail.plus API 格式。

## 🎯 项目目标

替代 tempmail.plus 服务，为油猴脚本提供自主可控的临时邮箱系统，用于自动注册 Augment 账号。

## 🏗️ 系统架构

```
域名邮箱 → Cloudflare Email Workers → KV 存储 → Pages API → 油猴脚本
```

### 组件说明

- **Email Worker** (`email-worker.js`) - 接收邮件，提取验证码，存储到 KV
- **Pages Functions** (`functions/api/mails.js`) - 提供 RESTful API 接口
- **KV 存储** - 邮件数据持久化存储
- **管理界面** (`public/index.html`) - 系统状态和 API 文档

## 🚀 部署步骤

### 1. 准备工作

```bash
# 安装依赖
npm install

# 登录 Cloudflare
npx wrangler login
```

### 2. 创建 KV 命名空间

```bash
# 创建生产环境 KV
npx wrangler kv:namespace create "TEMP_MAILS"

# 创建预览环境 KV
npx wrangler kv:namespace create "TEMP_MAILS" --preview
```

### 3. 配置 wrangler.toml

更新 `wrangler.toml` 文件中的配置：

```toml
# 替换为你的 Account ID
account_id = "your-account-id"

# 替换为实际的 KV 命名空间 ID
[[kv_namespaces]]
binding = "TEMP_MAILS"
id = "your-kv-namespace-id"
preview_id = "your-preview-kv-namespace-id"

# 配置环境变量
[vars]
AUTH_TOKEN = "your-secret-auth-token"  # 可选，API 认证
DOMAIN = "your-domain.com"             # 你的域名
```

### 4. 部署 Email Worker

```bash
# 部署邮件接收 Worker
npx wrangler deploy email-worker.js --name temp-mail-email-worker
```

### 5. 配置域名邮件路由

在 Cloudflare Dashboard 中：

1. 进入你的域名管理页面
2. 点击 "Email" 选项卡
3. 添加邮件路由规则：
   - **匹配表达式**: `*@your-domain.com`
   - **操作**: Send to Worker
   - **Worker**: `temp-mail-email-worker`

### 6. 部署 Pages 项目

```bash
# 部署到 Cloudflare Pages
npx wrangler pages deploy public --project-name=temp-mail-system

# 或者连接到 Git 仓库进行自动部署
```

### 7. 配置 Pages 环境变量

在 Cloudflare Pages 设置中添加：

- **KV 绑定**: `TEMP_MAILS` → 你的 KV 命名空间
- **环境变量**: 
  - `AUTH_TOKEN` (可选)
  - `DOMAIN`

## 📡 API 接口

### 获取邮件列表

```http
GET /api/mails?email={email}&limit=20
```

**响应格式**:
```json
{
  "result": true,
  "first_id": "mail_id_123",
  "mails": [
    {
      "id": "mail_id_123",
      "from": "sender@example.com",
      "subject": "Verification Code",
      "timestamp": 1703123456789,
      "read": false
    }
  ]
}
```

### 获取邮件详情

```http
GET /api/mails/{mailId}?email={email}
```

**响应格式**:
```json
{
  "result": true,
  "id": "mail_id_123",
  "from": "sender@example.com",
  "to": "user@your-domain.com",
  "subject": "Verification Code",
  "text": "Your verification code is: 123456",
  "html": "<p>Your verification code is: <strong>123456</strong></p>",
  "timestamp": 1703123456789
}
```

### 删除邮件

```http
DELETE /api/mails
Content-Type: application/x-www-form-urlencoded

email=user@your-domain.com&first_id=mail_id_123
```

**响应格式**:
```json
{
  "result": true
}
```

## 🔧 油猴脚本集成

修改现有油猴脚本中的 API 配置：

```javascript
// 替换 tempmail.plus 配置
const TEMP_MAIL_CONFIG = {
    username: "testuser",                    // 邮箱用户名
    emailExtension: "@your-domain.com",      // 你的域名
    epin: "your-auth-token"                  // 可选的认证token
};

// API 基础 URL
const API_BASE_URL = "https://your-temp-mail-system.pages.dev";

// 获取邮件列表的 URL 格式保持不变
const mailListUrl = `${API_BASE_URL}/api/mails?email=${username}${emailExtension}&limit=20&epin=${epin}`;
```

## 🛠️ 验证码提取

系统支持多种验证码格式：

- **6位数字**: `123456`
- **4位数字**: `1234`
- **8位数字**: `12345678`
- **字母数字混合**: `ABC123`

提取模式包括：
- 中英文验证码标识
- 独立数字匹配
- HTML 内容解析
- 合理性验证

## 🔒 安全考虑

- 邮件数据自动过期（验证码10分钟过期）
- 可选的 API 认证机制
- CORS 跨域访问控制
- 数据存储在 Cloudflare KV（安全可靠）

## 📊 监控和调试

- 查看 Email Worker 日志：Cloudflare Dashboard → Workers → Logs
- 查看 Pages Functions 日志：Pages 项目 → Functions → Logs
- 检查 KV 存储：Cloudflare Dashboard → KV → 浏览数据

## 🔄 与现有系统的关系

- **独立运行**: 不依赖 Token Manager 系统
- **API 兼容**: 完全兼容 tempmail.plus 格式
- **无缝替换**: 油猴脚本只需修改 API 地址
- **数据分离**: 邮件数据与 Token 数据完全分离

## 📝 注意事项

1. 确保域名已添加到 Cloudflare 并启用邮件功能
2. Email Worker 和 Pages 项目需要绑定相同的 KV 命名空间
3. 邮件路由配置正确，确保邮件能够到达 Worker
4. 测试时可以发送邮件到配置的域名验证功能
