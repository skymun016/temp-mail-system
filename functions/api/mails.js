/**
 * 临时邮箱 API - 邮件列表和详情
 * 兼容现有油猴脚本的 tempmail.plus API 格式
 * 
 * API 路径：
 * GET /api/mails?email=xxx&limit=20&epin=xxx
 * GET /api/mails/{mailId}?email=xxx&epin=xxx
 * DELETE /api/mails (form data: email, first_id, epin)
 */

// CORS 头设置
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Auth-Token',
    'Access-Control-Max-Age': '86400',
};

export async function onRequestOptions() {
    return new Response(null, { headers: corsHeaders });
}

export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    try {
        // 验证授权（可选，为了安全性）
        const authResult = await validateAuth(request, env);
        if (!authResult.valid) {
            console.log('Auth validation failed:', authResult.error);
            // 注意：为了兼容性，这里可以选择不强制验证
            // return jsonResponse({ error: 'Unauthorized' }, 401);
        }
        
        // 路由处理 - 添加调试信息
        const pathParts = pathname.split('/');
        const mailId = pathParts[pathParts.length - 1];

        console.log('🔍 路由调试:', {
            pathname,
            pathParts,
            mailId,
            isMailsList: pathname.endsWith('/mails') || mailId === 'mails',
            isMailDetail: mailId && mailId !== 'mails'
        });

        if (pathname.endsWith('/mails') || mailId === 'mails') {
            // 获取邮件列表
            console.log('📋 处理邮件列表请求');
            return await handleGetMails(url, env);
        } else if (mailId && mailId !== 'mails') {
            // 获取单封邮件详情
            console.log('📄 处理邮件详情请求, mailId:', mailId);
            return await handleGetMail(mailId, url, env);
        }
        
        return jsonResponse({ error: 'Not found' }, 404);
        
    } catch (error) {
        console.error('API Error:', error);
        return jsonResponse({ error: 'Internal server error' }, 500);
    }
}

export async function onRequestDelete(context) {
    const { request, env } = context;
    
    try {
        // 验证授权（可选）
        const authResult = await validateAuth(request, env);
        if (!authResult.valid) {
            console.log('Auth validation failed:', authResult.error);
            // 为了兼容性，可以选择不强制验证
        }
        
        return await handleDeleteMails(request, env);
        
    } catch (error) {
        console.error('Delete Error:', error);
        return jsonResponse({ error: 'Internal server error' }, 500);
    }
}

/**
 * 验证授权（可选功能）
 */
async function validateAuth(request, env) {
    // 从查询参数或头部获取认证信息
    const url = new URL(request.url);
    const epin = url.searchParams.get('epin');
    const authToken = request.headers.get('X-Auth-Token') || 
                     request.headers.get('Authorization')?.replace('Bearer ', '');
    
    // 如果没有配置认证，则跳过验证
    if (!env.AUTH_TOKEN && !env.EPIN) {
        return { valid: true };
    }
    
    // 验证 epin（兼容 tempmail.plus 格式）
    if (env.EPIN && epin !== env.EPIN) {
        return { valid: false, error: 'Invalid epin' };
    }
    
    // 验证 auth token
    if (env.AUTH_TOKEN && authToken !== env.AUTH_TOKEN) {
        return { valid: false, error: 'Invalid auth token' };
    }
    
    return { valid: true };
}

/**
 * 获取邮件列表
 * GET /api/mails?email=xxx&limit=20&epin=xxx
 * 
 * 兼容 tempmail.plus API 格式：
 * {
 *   "result": true,
 *   "first_id": "mail_id",
 *   "mails": [...]
 * }
 */
async function handleGetMails(url, env) {
    const email = url.searchParams.get('email');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    
    if (!email) {
        return jsonResponse({ 
            result: false, 
            error: 'Email parameter required' 
        }, 400);
    }
    
    try {
        const indexKey = `inbox:${email}`;
        const inboxData = await env.TEMP_MAILS.get(indexKey);
        
        if (!inboxData) {
            return jsonResponse({
                result: true,
                first_id: null,
                mails: []
            });
        }
        
        const inbox = JSON.parse(inboxData);
        const limitedMails = inbox.slice(0, limit);
        
        // 转换为 tempmail.plus 兼容格式
        const formattedMails = limitedMails.map(mail => ({
            id: mail.id,
            from: mail.from,
            subject: mail.subject,
            timestamp: mail.timestamp,
            read: mail.read
        }));
        
        return jsonResponse({
            result: true,
            first_id: limitedMails.length > 0 ? limitedMails[0].id : null,
            mails: formattedMails
        });
        
    } catch (error) {
        console.error('Get mails error:', error);
        return jsonResponse({
            result: false,
            error: 'Failed to get mails'
        }, 500);
    }
}

/**
 * 获取单封邮件详情
 * GET /api/mails/{mailId}?email=xxx&epin=xxx
 * 
 * 兼容 tempmail.plus API 格式：
 * {
 *   "result": true,
 *   "id": "mail_id",
 *   "from": "sender@example.com",
 *   "subject": "Subject",
 *   "text": "Plain text content",
 *   "html": "HTML content"
 * }
 */
async function handleGetMail(mailId, url, env) {
    const email = url.searchParams.get('email');

    console.log('📄 获取邮件详情:', { mailId, email });

    if (!email) {
        console.log('❌ 缺少 email 参数');
        return jsonResponse({
            result: false,
            error: 'Email parameter required'
        }, 400);
    }

    try {
        const mailKey = `mail:${mailId}`;
        console.log('🔑 查找邮件 key:', mailKey);
        const mailData = await env.TEMP_MAILS.get(mailKey);
        console.log('📦 KV 返回数据:', mailData ? '有数据' : '无数据');
        
        if (!mailData) {
            return jsonResponse({ 
                result: false, 
                error: 'Mail not found' 
            }, 404);
        }
        
        const mail = JSON.parse(mailData);
        
        // 验证邮件是否属于请求的邮箱
        if (mail.to !== email) {
            return jsonResponse({ 
                result: false, 
                error: 'Mail not found' 
            }, 404);
        }
        
        // 标记为已读
        mail.read = true;
        await env.TEMP_MAILS.put(mailKey, JSON.stringify(mail));
        
        // 更新收件箱索引中的已读状态
        await updateInboxReadStatus(env, email, mailId);
        
        // 返回 tempmail.plus 兼容格式
        return jsonResponse({
            result: true,
            id: mail.id,
            from: mail.from,
            to: mail.to,
            subject: mail.subject,
            text: mail.text,
            html: mail.html,
            timestamp: mail.timestamp
        });
        
    } catch (error) {
        console.error('Get mail error:', error);
        return jsonResponse({
            result: false,
            error: 'Failed to get mail'
        }, 500);
    }
}

/**
 * 删除邮件
 * DELETE /api/mails
 * Form data: email, first_id, epin
 * 
 * 兼容 tempmail.plus API 格式：
 * {
 *   "result": true
 * }
 */
async function handleDeleteMails(request, env) {
    try {
        const formData = await request.formData();
        const email = formData.get('email');
        const firstId = formData.get('first_id');
        
        if (!email || !firstId) {
            return jsonResponse({ 
                result: false, 
                error: 'Email and first_id required' 
            }, 400);
        }
        
        // 删除指定邮件
        const mailKey = `mail:${firstId}`;
        await env.TEMP_MAILS.delete(mailKey);
        
        // 更新收件箱索引
        const indexKey = `inbox:${email}`;
        const inboxData = await env.TEMP_MAILS.get(indexKey);
        
        if (inboxData) {
            const inbox = JSON.parse(inboxData);
            const updatedInbox = inbox.filter(mail => mail.id !== firstId);
            await env.TEMP_MAILS.put(indexKey, JSON.stringify(updatedInbox));
        }
        
        return jsonResponse({ result: true });
        
    } catch (error) {
        console.error('Delete mail error:', error);
        return jsonResponse({ 
            result: false, 
            error: 'Delete failed' 
        }, 500);
    }
}

/**
 * 更新收件箱中邮件的已读状态
 */
async function updateInboxReadStatus(env, email, mailId) {
    try {
        const indexKey = `inbox:${email}`;
        const inboxData = await env.TEMP_MAILS.get(indexKey);
        
        if (inboxData) {
            const inbox = JSON.parse(inboxData);
            const updatedInbox = inbox.map(mail => 
                mail.id === mailId ? { ...mail, read: true } : mail
            );
            await env.TEMP_MAILS.put(indexKey, JSON.stringify(updatedInbox));
        }
    } catch (error) {
        console.error('Update inbox read status error:', error);
    }
}

/**
 * 返回 JSON 响应
 */
function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
        }
    });
}
