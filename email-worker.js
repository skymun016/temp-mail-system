/**
 * Cloudflare Email Worker
 * 独立的邮件接收处理器
 * 
 * 部署说明：
 * 1. 这个文件需要单独部署为 Email Worker
 * 2. 在 Cloudflare Dashboard 中创建 Email Worker
 * 3. 配置域名的 MX 记录指向 Cloudflare
 * 4. 绑定 KV 命名空间 TEMP_MAILS
 */

export default {
    async fetch(request, env, ctx) {
        return new Response('Email Worker is running! This worker only processes emails.', {
            headers: { 'Content-Type': 'text/plain' }
        });
    },

    async email(message, env, ctx) {
        try {
            console.log('📧 收到新邮件:', {
                from: message.from,
                to: message.to,
                subject: message.headers.get('subject')
            });
            
            // 解析邮件内容
            const emailData = await parseEmail(message);
            
            // 提取验证码
            const verificationCode = extractVerificationCode(emailData.text, emailData.html);
            
            // 构建邮件记录
            const mailRecord = {
                id: generateMailId(),
                to: message.to,
                from: message.from,
                subject: emailData.subject,
                text: emailData.text,
                html: emailData.html,
                verificationCode: verificationCode,
                timestamp: Date.now(),
                read: false
            };
            
            // 存储到 KV
            await storeEmail(env, mailRecord);
            
            console.log('✅ 邮件处理完成:', {
                id: mailRecord.id,
                to: mailRecord.to,
                verificationCode: verificationCode
            });
            
        } catch (error) {
            console.error('❌ 邮件处理失败:', error);
        }
    }
};

/**
 * 解析邮件内容
 */
async function parseEmail(message) {
    try {
        // 获取邮件主题
        const subject = message.headers.get('subject') || '';
        
        // 读取邮件原始内容
        const rawEmail = await streamToString(message.raw);
        
        // 解析邮件正文
        const emailParts = parseRawEmail(rawEmail);
        
        return {
            subject: subject,
            text: emailParts.text || '',
            html: emailParts.html || ''
        };
    } catch (error) {
        console.error('解析邮件失败:', error);
        return {
            subject: message.headers.get('subject') || '',
            text: '',
            html: ''
        };
    }
}

/**
 * 将流转换为字符串
 */
async function streamToString(stream) {
    const chunks = [];
    const reader = stream.getReader();
    
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
        }
    } finally {
        reader.releaseLock();
    }
    
    // 合并所有块
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const uint8Array = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
        uint8Array.set(chunk, offset);
        offset += chunk.length;
    }
    
    return new TextDecoder('utf-8').decode(uint8Array);
}

/**
 * 解析原始邮件内容
 */
function parseRawEmail(rawEmail) {
    const lines = rawEmail.split('\n');
    let inHeaders = true;
    let currentPart = 'text';
    let text = '';
    let html = '';
    let boundary = '';
    
    // 查找边界标识
    const boundaryMatch = rawEmail.match(/boundary[=:][\s]*["']?([^"'\s;]+)/i);
    if (boundaryMatch) {
        boundary = boundaryMatch[1];
    }
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (inHeaders) {
            if (line.trim() === '') {
                inHeaders = false;
                continue;
            }
            // 检查内容类型
            if (line.toLowerCase().includes('content-type: text/html')) {
                currentPart = 'html';
            } else if (line.toLowerCase().includes('content-type: text/plain')) {
                currentPart = 'text';
            }
        } else {
            // 处理多部分邮件
            if (boundary && line.includes(boundary)) {
                continue;
            }
            
            // 检查内容类型切换
            if (line.toLowerCase().includes('content-type: text/html')) {
                currentPart = 'html';
                continue;
            } else if (line.toLowerCase().includes('content-type: text/plain')) {
                currentPart = 'text';
                continue;
            }
            
            // 跳过其他头部信息
            if (line.toLowerCase().startsWith('content-')) {
                continue;
            }
            
            // 添加到相应部分
            if (currentPart === 'html') {
                html += line + '\n';
            } else {
                text += line + '\n';
            }
        }
    }
    
    return { 
        text: text.trim(), 
        html: html.trim() 
    };
}

/**
 * 提取验证码 - 兼容现有油猴脚本的格式
 */
function extractVerificationCode(text, html) {
    const content = (text + ' ' + html).replace(/<[^>]*>/g, ' '); // 移除HTML标签
    
    // 验证码模式匹配（按优先级排序）
    const patterns = [
        // 6位数字验证码（最常见的格式）
        /(?:验证码|verification code|verify code|code)[：:\s]*(\d{6})/i,
        /(\d{6})(?:\s*(?:is|为|是)?\s*(?:your|您的)?\s*(?:verification|verify)?\s*(?:code|码))/i,
        
        // 独立的6位数字（与现有脚本兼容）
        /(?<![a-zA-Z@.])\b(\d{6})\b/,
        
        // 4位数字验证码
        /(?:验证码|verification code|verify code|code)[：:\s]*(\d{4})/i,
        /(\d{4})(?:\s*(?:is|为|是)?\s*(?:your|您的)?\s*(?:verification|verify)?\s*(?:code|码))/i,
        /(?<![a-zA-Z@.])\b(\d{4})\b/,
        
        // 8位数字验证码
        /(?:验证码|verification code|verify code|code)[：:\s]*(\d{8})/i,
        /(\d{8})(?:\s*(?:is|为|是)?\s*(?:your|您的)?\s*(?:verification|verify)?\s*(?:code|码))/i,
        /(?<![a-zA-Z@.])\b(\d{8})\b/,
        
        // 字母数字混合验证码
        /(?:验证码|verification code|verify code|code)[：:\s]*([A-Z0-9]{6,8})/i,
        /([A-Z0-9]{6,8})(?:\s*(?:is|为|是)?\s*(?:your|您的)?\s*(?:verification|verify)?\s*(?:code|码))/i
    ];
    
    for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) {
            const code = match[1];
            // 验证码合理性检查
            if (isValidVerificationCode(code)) {
                console.log('✅ 提取到验证码:', code);
                return code;
            }
        }
    }
    
    console.log('⚠️ 未找到验证码');
    return null;
}

/**
 * 验证码合理性检查
 */
function isValidVerificationCode(code) {
    // 排除明显不是验证码的数字
    const excludePatterns = [
        /^0+$/, // 全零
        /^1+$/, // 全一
        /^(19|20)\d{2}$/, // 年份
        /^(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/, // 日期格式MMDD
        /^[0-9]{10,}$/, // 超长数字（可能是时间戳等）
    ];
    
    for (const pattern of excludePatterns) {
        if (pattern.test(code)) {
            return false;
        }
    }
    
    return true;
}

/**
 * 生成邮件ID
 */
function generateMailId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * 存储邮件到 KV
 */
async function storeEmail(env, mailRecord) {
    try {
        const mailKey = `mail:${mailRecord.id}`;
        const indexKey = `inbox:${mailRecord.to}`;
        
        // 存储邮件详情
        await env.TEMP_MAILS.put(mailKey, JSON.stringify(mailRecord));
        
        // 更新收件箱索引
        const existingInbox = await env.TEMP_MAILS.get(indexKey);
        let inbox = existingInbox ? JSON.parse(existingInbox) : [];
        
        // 添加新邮件到收件箱顶部
        inbox.unshift({
            id: mailRecord.id,
            from: mailRecord.from,
            subject: mailRecord.subject,
            timestamp: mailRecord.timestamp,
            read: mailRecord.read,
            hasVerificationCode: !!mailRecord.verificationCode
        });
        
        // 只保留最近50封邮件
        inbox = inbox.slice(0, 50);
        
        await env.TEMP_MAILS.put(indexKey, JSON.stringify(inbox));
        
        // 如果有验证码，创建快速访问索引
        if (mailRecord.verificationCode) {
            const codeKey = `code:${mailRecord.to}:latest`;
            await env.TEMP_MAILS.put(codeKey, JSON.stringify({
                code: mailRecord.verificationCode,
                mailId: mailRecord.id,
                timestamp: mailRecord.timestamp
            }), { expirationTtl: 600 }); // 10分钟过期
        }
        
        console.log('✅ 邮件存储完成');
        
    } catch (error) {
        console.error('❌ 邮件存储失败:', error);
        throw error;
    }
}
