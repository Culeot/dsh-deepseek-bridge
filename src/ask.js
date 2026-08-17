const { chromium } = require('playwright');
const { applyAuth, loadAuth } = require('./auth');
const { XHR_INTERCEPTOR_SCRIPT } = require('./interceptor');
const { SessionManager, detectProjectName } = require('./session');
const { buildPrompt, parseResponse, validateResponse } = require('./prompt');
const fs = require('fs');
const path = require('path');

const DS_URL = 'https://chat.deepseek.com/';
const DEFAULT_TIMEOUT = 120000;
const AUTH_FILE = path.join(__dirname, '..', 'data', 'auth.json');

// 全局会话管理器
const sessionManager = new SessionManager();

/**
 * 向 DeepSeek 网页端提问并获取回答
 * 
 * @param {string} question - 要提问的内容
 * @param {object} options - 配置选项
 * @param {string} options.project - 项目名称(用于会话复用)
 * @param {boolean} options.headless - 是否隐藏浏览器窗口
 * @param {number} options.timeout - 超时时间(毫秒)
 * @param {boolean} options.expertMode - 是否使用专家模式(默认 true)
 * @param {boolean} options.deepThink - 是否开启深度思考(默认 true)
 * @param {function} options.onChunk - 正文内容回调
 * @param {function} options.onThinking - 思考过程回调
 * @returns {{ answer: string, thinking: string, duration: number, error?: string, sessionUrl?: string }}
 */
async function askDeepSeek(question, options = {}) {
  const {
    project = detectProjectName(),
    headless = false,
    timeout = DEFAULT_TIMEOUT,
    expertMode = true,
    deepThink = true,
    keepOpen = false,
    forceNew = false,
    requireJson = true,
    onChunk = null,
    onThinking = null
  } = options;

  const startTime = Date.now();
  let answerText = '';
  let thinkingText = '';
  let done = false;
  let error = null;
  let sessionUrl = null;

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  try {
    // 1. 导入登录态
    await applyAuth(page);

    // 2. 注册回调函数
    await page.exposeFunction('__dsOnChunk', (text) => {
      answerText += text;
      if (onChunk) onChunk(text);
    });
    await page.exposeFunction('__dsOnThinking', (text) => {
      thinkingText += text;
      if (onThinking) onThinking(text);
    });
    await page.exposeFunction('__dsOnDone', () => { done = true; });
    await page.exposeFunction('__dsOnError', (err) => { error = err; done = true; });

    // 3. 注入 XHR 拦截脚本
    await page.addInitScript(XHR_INTERCEPTOR_SCRIPT);

    // 4. 导航到已有对话(同项目复用)或首页(新项目/强制新建)
    const savedUrl = forceNew ? null : sessionManager.get(project);
    if (savedUrl) {
      try {
        await page.goto(savedUrl, { waitUntil: 'networkidle', timeout: 30000 });
        // 检查是否真的复用了对话(页面中应有历史消息)
        const hasHistory = await page.locator('[data-message-role="assistant"], .ds-markdown').count() > 0;
        if (!hasHistory) {
          // URL 已失效,回退到首页
          await page.goto(DS_URL, { waitUntil: 'networkidle', timeout: 30000 });
        }
      } catch (e) {
        await page.goto(DS_URL, { waitUntil: 'networkidle', timeout: 30000 });
      }
    } else {
      await page.goto(DS_URL, { waitUntil: 'networkidle', timeout: 30000 });
    }

    // 5. 等待输入框出现(确认已登录)
    try {
      await page.waitForSelector('textarea', { timeout: 15000 });
    } catch (e) {
      const url = page.url();
      if (url.includes('/sign_in') || url.includes('/login')) {
        throw new Error('登录态已过期,请重新登录 DeepSeek 并保存登录态');
      }
      throw e;
    }

    // 6. 判断是否为新对话(有模式选择器)还是已有对话(无模式选择器)
    const expertRadio = page.locator('div[data-model-type="expert"]');
    const isNewConversation = await expertRadio.isVisible({ timeout: 3000 }).catch(() => false);

    // 7. 新对话:切换到专家模式 + 开启深度思考
    //    已有对话:只开启深度思考(模式选择器不存在)
    if (isNewConversation && expertMode) {
      const isExpert = await expertRadio.getAttribute('aria-checked');
      if (isExpert !== 'true') {
        await expertRadio.click();
        await page.waitForTimeout(1000);
      }
    }

    // 8. 开启深度思考(如果按钮可见且未开启)
    if (deepThink) {
      const deepThinkBtn = page.locator('div.ds-toggle-button').first();
      try {
        if (await deepThinkBtn.isVisible({ timeout: 3000 })) {
          const isDeepThink = await deepThinkBtn.getAttribute('aria-pressed');
          if (isDeepThink !== 'true') {
            await deepThinkBtn.click();
            await page.waitForTimeout(1000);
          }
        }
      } catch (e) {
        // 忽略
      }
    }

    // 8. 输入问题(使用提示词模板包装)
    const textarea = page.locator('textarea').first();
    await textarea.click();
    const promptText = buildPrompt(question, { requireJson: requireJson, fewShot: requireJson });
    await textarea.fill(promptText);
    await page.waitForTimeout(500);

    // 9. 发送(点击发送按钮或按回车)
    try {
      const sendBtn = page.locator('button').filter({
        has: page.locator('svg'),
        hasNot: page.locator('text=/.*/')
      }).last();
      if (await sendBtn.isVisible({ timeout: 3000 })) {
        await sendBtn.click();
      } else {
        await textarea.press('Enter');
      }
    } catch (e) {
      await textarea.press('Enter');
    }

    // 10. 等待回答完成(DOM 检测方案)
    const startWait = Date.now();
    let lastText = '';
    let stableCount = 0;
    const maxStable = 3;
    
    while (true) {
      if (Date.now() - startWait > timeout) {
        error = `超时(${timeout}ms)`;
        break;
      }
      
      // 检测"正在思考"是否消失
      const isThinking = await page.evaluate(() => document.body.innerText.includes('正在思考'));
      if (isThinking) {
        stableCount = 0;
        await page.waitForTimeout(1000);
        continue;
      }
      
      // 获取最后一个 AI 回答的文本
      const currentText = await page.evaluate(() => {
        const msgs = document.querySelectorAll('[class*="markdown"], [class*="message-content"]');
        const last = msgs[msgs.length - 1];
        return last ? last.innerText : '';
      });
      
      // 检测文本是否稳定
      if (currentText && currentText === lastText) {
        stableCount++;
        if (stableCount >= maxStable) {
          answerText = currentText;
          break;
        }
      } else {
        stableCount = 0;
        lastText = currentText;
      }
      
      await page.waitForTimeout(1000);
    }

    // 11. 保存当前对话 URL(用于下次复用)
    sessionUrl = page.url();
    if (sessionUrl && sessionUrl.includes('/a/chat/s/')) {
      sessionManager.set(project, sessionUrl);
    }

    const duration = Date.now() - startTime;

    return {
      answer: answerText.trim(),
      thinking: thinkingText.trim(),
      duration,
      error,
      sessionUrl,
      project
    };

  } finally {
    if (!keepOpen) {
      await browser.close();
    } else {
      console.error('[DS-Bridge] 浏览器保持打开,请手动关闭');
    }
  }
}

/**
 * 检查登录态是否有效
 * @returns {boolean}
 */
async function checkAuthValid() {
  if (!fs.existsSync(AUTH_FILE)) return false;
  try {
    const auth = loadAuth();
    const savedAt = new Date(auth.savedAt);
    const hoursSince = (Date.now() - savedAt.getTime()) / (1000 * 60 * 60);
    return hoursSince < 24;
  } catch (e) {
    return false;
  }
}

/**
 * 列出所有会话
 */
function listSessions() {
  return sessionManager.list();
}

/**
 * 删除项目会话
 * @param {string} projectName 
 */
function deleteSession(projectName) {
  sessionManager.delete(projectName);
}

module.exports = {
  askDeepSeek,
  checkAuthValid,
  listSessions,
  deleteSession,
  detectProjectName,
  DEFAULT_TIMEOUT
};
