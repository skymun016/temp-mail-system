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

            // 构建邮件记录
            const mailRecord = {
                id: generateMailId(),
                to: message.to,
                from: message.from,
                subject: emailData.subject,
                text: emailData.text,
                html: emailData.html,
                timestamp: Date.now(),
                read: false
            };
            
            // 存储到 KV
            await storeEmail(env, mailRecord);
            
            console.log('✅ 邮件处理完成:', {
                id: mailRecord.id,
                to: mailRecord.to,
                subject: mailRecord.subject
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
    
    // 尝试不同的编码方式
    try {
        return new TextDecoder('utf-8').decode(uint8Array);
    } catch (e) {
        try {
            return new TextDecoder('utf-8', { fatal: false }).decode(uint8Array);
        } catch (e2) {
            return new TextDecoder('latin1').decode(uint8Array);
        }
    }
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
    let currentEncoding = '';

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
            // 检查内容类型和编码
            if (line.toLowerCase().includes('content-type: text/html')) {
                currentPart = 'html';
            } else if (line.toLowerCase().includes('content-type: text/plain')) {
                currentPart = 'text';
            } else if (line.toLowerCase().includes('content-transfer-encoding:')) {
                currentEncoding = line.split(':')[1].trim().toLowerCase();
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
            } else if (line.toLowerCase().includes('content-transfer-encoding:')) {
                currentEncoding = line.split(':')[1].trim().toLowerCase();
                continue;
            }

            // 跳过其他头部信息
            if (line.toLowerCase().startsWith('content-')) {
                continue;
            }
            
            // 跳过 charset 等头部信息行
            if (line.toLowerCase().startsWith('charset=') ||
                line.trim() === '' && (text === '' && html === '')) {
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
    
    // 根据编码方式解码内容
    let decodedText = text.trim();
    let decodedHtml = html.trim();

    if (currentEncoding === 'base64') {
        try {
            if (decodedText) decodedText = atob(decodedText);
            if (decodedHtml) decodedHtml = atob(decodedHtml);
        } catch (e) {
            console.log('Base64 解码失败:', e);
        }
    } else if (currentEncoding === 'quoted-printable') {
        // 处理 Quoted-Printable 编码
        decodedText = decodeQuotedPrintable(decodedText);
        decodedHtml = decodeQuotedPrintable(decodedHtml);
    }

    // 通用清理：移除开头的编码信息和多余的换行
    decodedText = decodedText
        .replace(/^charset=[^\r\n]*\r?\n\r?\n/i, '')
        .replace(/=\r?\n/g, '')
        .replace(/=$/gm, '')
        .trim();

    decodedHtml = decodedHtml
        .replace(/^charset=[^\r\n]*\r?\n\r?\n/i, '')
        .replace(/=\r?\n/g, '')
        .replace(/=$/gm, '')
        .trim();

    return {
        text: decodedText,
        html: decodedHtml
    };
}

// 验证码提取逻辑已移至油猴脚本中处理

/**
 * 解码 Quoted-Printable 编码
 */
function decodeQuotedPrintable(str) {
    if (!str) return str;

    return str
        .replace(/=\r?\n/g, '') // 移除软换行
        .replace(/=([0-9A-F]{2})/gi, (_, hex) => {
            return String.fromCharCode(parseInt(hex, 16));
        })
        .replace(/^charset=[^\r\n]*\r?\n\r?\n/i, '') // 移除开头的 charset 信息
        .replace(/=$/gm, '') // 移除行尾的 = 号
        .trim();
}

// Base64 检测函数已移除，不再需要

/**
 * 生成邮件ID
 */
function generateMailId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 11);
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
            read: mailRecord.read
        });
        
        // 只保留最近50封邮件
        inbox = inbox.slice(0, 50);
        
        await env.TEMP_MAILS.put(indexKey, JSON.stringify(inbox));

        console.log('✅ 邮件存储完成');
        
    } catch (error) {
        console.error('❌ 邮件存储失败:', error);
        throw error;
    }
}
