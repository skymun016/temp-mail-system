/**
 * 油猴脚本配置示例
 * 用于替换现有脚本中的 tempmail.plus 配置
 */

// ===== 新的临时邮箱配置 =====
const TEMP_MAIL_CONFIG = {
    username: "testuser",                           // 邮箱用户名（可自定义）
    emailExtension: "@your-domain.com",             // 替换为你的域名
    epin: "your-auth-token"                         // 可选的认证token（如果配置了的话）
};

// API 基础 URL - 替换为你部署的 Pages 地址
const API_BASE_URL = "https://your-temp-mail-system.pages.dev";

// ===== API 调用示例 =====

/**
 * 获取最新邮件中的验证码（替换现有的 getLatestMailCode 函数）
 */
async function getLatestMailCode() {
    return new Promise((resolve, reject) => {
        const mailListUrl = `${API_BASE_URL}/api/mails?email=${TEMP_MAIL_CONFIG.username}${TEMP_MAIL_CONFIG.emailExtension}&limit=20&epin=${TEMP_MAIL_CONFIG.epin}`;

        GM_xmlhttpRequest({
            method: "GET",
            url: mailListUrl,
            onload: async function(mailListResponse) {
                try {
                    const mailListData = JSON.parse(mailListResponse.responseText);
                    if (!mailListData.result || !mailListData.first_id) {
                        resolve(null);
                        return;
                    }

                    const firstId = mailListData.first_id;
                    const mailDetailUrl = `${API_BASE_URL}/api/mails/${firstId}?email=${TEMP_MAIL_CONFIG.username}${TEMP_MAIL_CONFIG.emailExtension}&epin=${TEMP_MAIL_CONFIG.epin}`;

                    GM_xmlhttpRequest({
                        method: "GET",
                        url: mailDetailUrl,
                        onload: async function(mailDetailResponse) {
                            try {
                                const mailDetailData = JSON.parse(mailDetailResponse.responseText);
                                if (!mailDetailData.result) {
                                    resolve(null);
                                    return;
                                }

                                const mailText = mailDetailData.text || "";
                                const mailSubject = mailDetailData.subject || "";
                                console.log("找到邮件主题: " + mailSubject);

                                // 使用现有的验证码提取函数
                                const code = extractVerificationCode(mailText);

                                // 获取到验证码后，尝试删除邮件
                                if (code) {
                                    await deleteEmail(firstId);
                                }

                                resolve(code);
                            } catch (error) {
                                console.log("解析邮件详情失败: " + error);
                                resolve(null);
                            }
                        },
                        onerror: function(error) {
                            console.log("获取邮件详情失败: " + error);
                            resolve(null);
                        }
                    });
                } catch (error) {
                    console.log("解析邮件列表失败: " + error);
                    resolve(null);
                }
            },
            onerror: function(error) {
                console.log("获取邮件列表失败: " + error);
                resolve(null);
            }
        });
    });
}

/**
 * 删除邮件（替换现有的 deleteEmail 函数）
 */
async function deleteEmail(firstId) {
    return new Promise((resolve, reject) => {
        const deleteUrl = `${API_BASE_URL}/api/mails`;
        const maxRetries = 5;
        let retryCount = 0;

        function tryDelete() {
            GM_xmlhttpRequest({
                method: "DELETE",
                url: deleteUrl,
                data: `email=${TEMP_MAIL_CONFIG.username}${TEMP_MAIL_CONFIG.emailExtension}&first_id=${firstId}&epin=${TEMP_MAIL_CONFIG.epin}`,
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                onload: function(response) {
                    try {
                        const result = JSON.parse(response.responseText).result;
                        if (result === true) {
                            console.log("邮件删除成功");
                            resolve(true);
                            return;
                        }
                    } catch (error) {
                        console.log("解析删除响应失败: " + error);
                    }

                    // 如果还有重试次数，继续尝试
                    if (retryCount < maxRetries - 1) {
                        retryCount++;
                        console.log(`删除邮件失败，正在重试 (${retryCount}/${maxRetries})...`);
                        setTimeout(tryDelete, 500);
                    } else {
                        console.log("删除邮件失败，已达到最大重试次数");
                        resolve(false);
                    }
                },
                onerror: function(error) {
                    if (retryCount < maxRetries - 1) {
                        retryCount++;
                        console.log(`删除邮件出错，正在重试 (${retryCount}/${maxRetries})...`);
                        setTimeout(tryDelete, 500);
                    } else {
                        console.log("删除邮件失败: " + error);
                        resolve(false);
                    }
                }
            });
        }

        tryDelete();
    });
}

// ===== 邮箱生成函数（需要修改域名部分）=====

/**
 * 生成随机邮箱（替换现有的 generateEmail 函数）
 */
function generateEmail() {
    const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    const timestamp = Date.now().toString(36); // 转换为36进制以缩短长度
    const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0'); // 生成4位随机数
    const username = `${firstName}${lastName}${timestamp}${randomNum}`;
    
    // 使用新的域名
    return `${username}${TEMP_MAIL_CONFIG.emailExtension}`;
}

// ===== 油猴脚本头部配置修改 =====

/*
// ==UserScript==
// @name         AugmentCode自动注册
// @namespace    http://tampermonkey.net/
// @version      0.4.0
// @description  自动完成AugmentCode的注册流程，使用自建临时邮箱系统
// @author       Your name
// @match        https://*.augmentcode.com/*
// @match        https://app.augmentcode.com/account/subscription
// @icon         https://www.google.com/s2/favicons?sz=64&domain=augmentcode.com
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_log
// @connect      your-temp-mail-system.pages.dev  // 替换为你的域名
// ==/UserScript==
*/

// ===== 配置检查函数 =====

/**
 * 检查配置是否正确
 */
function checkConfiguration() {
    console.log("=== 临时邮箱系统配置检查 ===");
    console.log("API 基础 URL:", API_BASE_URL);
    console.log("邮箱域名:", TEMP_MAIL_CONFIG.emailExtension);
    console.log("用户名:", TEMP_MAIL_CONFIG.username);
    console.log("认证Token:", TEMP_MAIL_CONFIG.epin ? "已配置" : "未配置");
    
    // 测试 API 连接
    testAPIConnection();
}

/**
 * 测试 API 连接
 */
function testAPIConnection() {
    const testEmail = `test${TEMP_MAIL_CONFIG.emailExtension}`;
    const testUrl = `${API_BASE_URL}/api/mails?email=${testEmail}&limit=1`;
    
    GM_xmlhttpRequest({
        method: "GET",
        url: testUrl,
        onload: function(response) {
            if (response.status === 200) {
                console.log("✅ API 连接测试成功");
            } else {
                console.log("❌ API 连接测试失败，状态码:", response.status);
            }
        },
        onerror: function(error) {
            console.log("❌ API 连接测试失败:", error);
        }
    });
}

// 在脚本启动时检查配置
checkConfiguration();

// ===== 使用说明 =====

/*
使用步骤：

1. 部署临时邮箱系统到 Cloudflare Pages
2. 替换上面的配置项：
   - API_BASE_URL: 你的 Pages 部署地址
   - emailExtension: 你的域名
   - epin: 你的认证token（如果配置了）

3. 在油猴脚本头部添加 @connect 权限：
   @connect your-temp-mail-system.pages.dev

4. 替换现有脚本中的相关函数：
   - getLatestMailCode()
   - deleteEmail()
   - generateEmail()

5. 测试脚本功能是否正常
*/
