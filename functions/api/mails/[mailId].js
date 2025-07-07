/**
 * 邮件详情 API - 动态路由
 * 处理 GET /api/mails/{mailId}?email=xxx
 */

// CORS 头设置
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Auth-Token',
    'Access-Control-Max-Age': '86400',
};

export async function onRequestOptions() {
    return new Response(null, { headers: corsHeaders });
}

export async function onRequestGet(context) {
    const { request, env, params } = context;
    const url = new URL(request.url);
    const mailId = params.mailId;
    const email = url.searchParams.get('email');
    
    console.log('📄 邮件详情请求:', { mailId, email });
    
    if (!email) {
        console.log('❌ 缺少 email 参数');
        return jsonResponse({ 
            result: false, 
            error: 'Email parameter required' 
        }, 400);
    }
    
    try {
        // 验证授权（可选）
        const authResult = await validateAuth(request, env);
        if (!authResult.valid) {
            console.log('Auth validation failed:', authResult.error);
        }
        
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
            console.log('❌ 邮件不属于请求的邮箱:', { mailTo: mail.to, requestEmail: email });
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
        
        console.log('✅ 邮件详情返回成功');
        
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
        console.error('❌ 获取邮件详情失败:', error);
        return jsonResponse({
            result: false,
            error: 'Failed to get mail'
        }, 500);
    }
}

/**
 * 验证授权（可选功能）
 */
async function validateAuth(request, env) {
    const url = new URL(request.url);
    const epin = url.searchParams.get('epin');
    const authToken = request.headers.get('X-Auth-Token') || 
                     request.headers.get('Authorization')?.replace('Bearer ', '');
    
    if (!env.AUTH_TOKEN && !env.EPIN) {
        return { valid: true };
    }
    
    if (env.EPIN && epin !== env.EPIN) {
        return { valid: false, error: 'Invalid epin' };
    }
    
    if (env.AUTH_TOKEN && authToken !== env.AUTH_TOKEN) {
        return { valid: false, error: 'Invalid auth token' };
    }
    
    return { valid: true };
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
