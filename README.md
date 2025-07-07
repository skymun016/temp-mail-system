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

### 1. Cloudflare Pages 部署（推荐）

#### 步骤 1：连接 GitHub 仓库

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Pages** 页面
3. 点击 **"Create a project"**
4. 选择 **"Connect to Git"**
5. 选择 GitHub 并授权访问
6. 选择 `temp-mail-system` 仓库

#### 步骤 2：配置构建设置

- **项目名称**: `temp-mail-system`
- **生产分支**: `main`
- **构建命令**: `npm run build`（可留空）
- **构建输出目录**: `public`

#### 步骤 3：创建 KV 命名空间

在 Cloudflare Dashboard 中：

1. 进入 **Workers & Pages** → **KV**
2. 点击 **"Create a namespace"**
3. 命名空间名称: `TEMP_MAILS`
4. 记录生成的命名空间 ID

#### 步骤 4：配置 Pages 环境变量

在 Pages 项目设置中添加：

**环境变量**:
- `AUTH_TOKEN`: `your-secret-token`（可选）
- `DOMAIN`: `your-domain.com`
- `EPIN`: `your-epin`（可选）

**KV 命名空间绑定**:
- 变量名: `TEMP_MAILS`
- KV 命名空间: 选择刚创建的 `TEMP_MAILS`

### 2. Email Worker 部署

#### 步骤 1：创建 Email Worker

1. 在 Cloudflare Dashboard 进入 **Workers & Pages**
2. 点击 **"Create application"** → **"Create Worker"**
3. 命名: `temp-mail-email-worker`
4. 点击 **"Deploy"**

#### 步骤 2：上传 Worker 代码

1. 在 Worker 编辑器中，复制 `email-worker.js` 的内容
2. 粘贴到编辑器中
3. 点击 **"Save and Deploy"**

#### 步骤 3：配置 Worker 环境

在 Worker 设置中：

**环境变量**:
- `DOMAIN`: `your-domain.com`

**KV 命名空间绑定**:
- 变量名: `TEMP_MAILS`
- KV 命名空间: 选择之前创建的 `TEMP_MAILS`

### 3. 配置域名邮件路由

1. 在 Cloudflare Dashboard 进入你的域名
2. 点击 **"Email"** 选项卡
3. 点击 **"Email Routing"** → **"Enable"**
4. 添加路由规则：
   - **匹配表达式**: `*@your-domain.com`
   - **操作**: **Send to Worker**
   - **Worker**: `temp-mail-email-worker`

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
