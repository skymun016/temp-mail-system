#!/bin/bash

# 临时邮箱系统快速设置脚本
# 用于初始化项目配置

set -e

echo "🛠️  临时邮箱系统快速设置"
echo "================================"

# 检查必要的工具
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI 未安装"
    echo "请运行: npm install -g wrangler"
    exit 1
fi

# 检查是否已登录
if ! wrangler whoami &> /dev/null; then
    echo "🔐 请先登录 Cloudflare..."
    wrangler login
fi

echo "✅ Cloudflare 登录状态正常"
echo ""

# 获取账户信息
ACCOUNT_ID=$(wrangler whoami | grep "Account ID" | awk '{print $3}' || echo "")

if [ -z "$ACCOUNT_ID" ]; then
    echo "⚠️  无法自动获取 Account ID，请手动配置"
    echo "请访问 Cloudflare Dashboard 获取 Account ID"
else
    echo "📋 检测到 Account ID: $ACCOUNT_ID"
fi

echo ""
echo "🔧 开始配置项目..."

# 创建 KV 命名空间
echo "📦 创建 KV 命名空间..."

echo "创建生产环境 KV 命名空间..."
PROD_KV_OUTPUT=$(wrangler kv:namespace create "TEMP_MAILS" 2>/dev/null || echo "")
PROD_KV_ID=""

if [[ $PROD_KV_OUTPUT == *"id ="* ]]; then
    PROD_KV_ID=$(echo "$PROD_KV_OUTPUT" | grep "id =" | awk -F'"' '{print $2}')
    echo "✅ 生产环境 KV ID: $PROD_KV_ID"
else
    echo "⚠️  生产环境 KV 命名空间可能已存在或创建失败"
fi

echo "创建预览环境 KV 命名空间..."
PREVIEW_KV_OUTPUT=$(wrangler kv:namespace create "TEMP_MAILS" --preview 2>/dev/null || echo "")
PREVIEW_KV_ID=""

if [[ $PREVIEW_KV_OUTPUT == *"id ="* ]]; then
    PREVIEW_KV_ID=$(echo "$PREVIEW_KV_OUTPUT" | grep "id =" | awk -F'"' '{print $2}')
    echo "✅ 预览环境 KV ID: $PREVIEW_KV_ID"
else
    echo "⚠️  预览环境 KV 命名空间可能已存在或创建失败"
fi

echo ""
echo "📝 配置文件更新建议:"
echo "================================"

if [ ! -z "$ACCOUNT_ID" ]; then
    echo "Account ID: $ACCOUNT_ID"
fi

if [ ! -z "$PROD_KV_ID" ]; then
    echo "生产环境 KV ID: $PROD_KV_ID"
fi

if [ ! -z "$PREVIEW_KV_ID" ]; then
    echo "预览环境 KV ID: $PREVIEW_KV_ID"
fi

echo ""
echo "请手动更新以下配置文件:"
echo ""
echo "1. wrangler.toml - Pages 配置"
echo "   - 替换 'your-kv-namespace-id' 为: $PROD_KV_ID"
echo "   - 替换 'your-preview-kv-namespace-id' 为: $PREVIEW_KV_ID"
echo ""
echo "2. email-worker.toml - Email Worker 配置"
echo "   - 替换 'your-kv-namespace-id' 为: $PROD_KV_ID"
echo "   - 替换 'your-preview-kv-namespace-id' 为: $PREVIEW_KV_ID"
echo ""
echo "3. 环境变量配置"
echo "   - AUTH_TOKEN: 设置 API 认证令牌"
echo "   - DOMAIN: 设置你的域名"
echo "   - EPIN: 设置可选的访问密码"
echo ""
echo "🚀 配置完成后，运行以下命令部署:"
echo "   ./scripts/deploy.sh development  # 部署到开发环境"
echo "   ./scripts/deploy.sh production   # 部署到生产环境"
echo ""
echo "📖 详细说明请参考 README.md"
