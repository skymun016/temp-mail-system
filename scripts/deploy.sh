#!/bin/bash

# 临时邮箱系统部署脚本
# 使用方法: ./scripts/deploy.sh [environment]
# environment: development | production (默认: development)

set -e

ENVIRONMENT=${1:-development}
echo "🚀 开始部署临时邮箱系统到 $ENVIRONMENT 环境..."

# 检查必要的工具
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI 未安装，请先安装: npm install -g wrangler"
    exit 1
fi

# 检查登录状态
if ! wrangler whoami &> /dev/null; then
    echo "❌ 请先登录 Cloudflare: wrangler login"
    exit 1
fi

echo "📋 当前 Cloudflare 账户信息:"
wrangler whoami

# 1. 创建 KV 命名空间（如果不存在）
echo "📦 检查 KV 命名空间..."

if [ "$ENVIRONMENT" = "production" ]; then
    echo "创建生产环境 KV 命名空间..."
    wrangler kv:namespace create "TEMP_MAILS" || echo "KV 命名空间可能已存在"
else
    echo "创建开发环境 KV 命名空间..."
    wrangler kv:namespace create "TEMP_MAILS" --preview || echo "预览 KV 命名空间可能已存在"
fi

# 2. 部署 Email Worker
echo "📧 部署 Email Worker..."
wrangler deploy email-worker.js \
    --name temp-mail-email-worker \
    --env $ENVIRONMENT \
    --config email-worker.toml

echo "✅ Email Worker 部署完成"

# 3. 部署 Pages 项目
echo "🌐 部署 Pages 项目..."
wrangler pages deploy public \
    --project-name temp-mail-system \
    --env $ENVIRONMENT

echo "✅ Pages 项目部署完成"

# 4. 显示部署信息
echo ""
echo "🎉 部署完成！"
echo ""
echo "📋 部署信息:"
echo "  环境: $ENVIRONMENT"
echo "  Email Worker: temp-mail-email-worker"
echo "  Pages 项目: temp-mail-system"
echo ""
echo "🔧 下一步配置:"
echo "  1. 在 Cloudflare Dashboard 中配置域名邮件路由"
echo "  2. 将邮件路由指向 Email Worker: temp-mail-email-worker"
echo "  3. 在 Pages 设置中绑定 KV 命名空间"
echo "  4. 配置环境变量"
echo ""
echo "📖 详细配置说明请参考 README.md"
