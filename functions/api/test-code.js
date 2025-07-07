/**
 * 测试验证码提取 API
 * GET /api/test-code?email=xxx
 */

// CORS 头设置
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
};

export async function onRequestOptions() {
    return new Response(null, { headers: corsHeaders });
}

export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const email = url.searchParams.get('email');
    
    if (!email) {
        return jsonResponse({ 
            error: 'Email parameter required' 
        }, 400);
    }
    
    try {
        // 获取最新验证码
        const codeKey = `code:${email}:latest`;
        const codeData = await env.TEMP_MAILS.get(codeKey);
        
        // 获取邮件列表
        const indexKey = `inbox:${email}`;
        const inboxData = await env.TEMP_MAILS.get(indexKey);
        
        let inbox = [];
        if (inboxData) {
            inbox = JSON.parse(inboxData);
        }
        
        // 获取最新邮件详情
        let latestMail = null;
        if (inbox.length > 0) {
            const mailKey = `mail:${inbox[0].id}`;
            const mailData = await env.TEMP_MAILS.get(mailKey);
            if (mailData) {
                latestMail = JSON.parse(mailData);
            }
        }
        
        return jsonResponse({
            email: email,
            latestCode: codeData ? JSON.parse(codeData) : null,
            mailCount: inbox.length,
            latestMail: latestMail ? {
                id: latestMail.id,
                subject: latestMail.subject,
                text: latestMail.text,
                verificationCode: latestMail.verificationCode,
                timestamp: latestMail.timestamp
            } : null
        });
        
    } catch (error) {
        console.error('Test code API error:', error);
        return jsonResponse({
            error: 'Internal server error'
        }, 500);
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
