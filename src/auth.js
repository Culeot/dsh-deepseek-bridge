const fs = require('fs');
const path = require('path');

const AUTH_FILE = path.join(__dirname, '..', 'data', 'auth.json');

/**
 * 读取保存的登录态
 * @returns {{ cookies: string, localStorage: object, savedAt: string }}
 */
function loadAuth() {
  if (!fs.existsSync(AUTH_FILE)) {
    throw new Error('登录态文件不存在,请先运行登录脚本或在浏览器中登录后保存');
  }
  const raw = fs.readFileSync(AUTH_FILE, 'utf8');
  const data = JSON.parse(raw);
  return data;
}

/**
 * 将登录态导入到 Playwright 浏览器上下文
 * @param {import('playwright').Page} page
 */
async function applyAuth(page) {
  const auth = loadAuth();
  const context = page.context();

  // 导入 cookie
  if (auth.cookies) {
    const cookiePairs = auth.cookies.split('; ').map(pair => {
      const [name, ...rest] = pair.split('=');
      return {
        name,
        value: rest.join('='),
        domain: '.deepseek.com',
        path: '/'
      };
    });
    await context.addCookies(cookiePairs);
  }

  // 导入 localStorage(需要在页面加载后)
  if (auth.localStorage) {
    await page.goto('https://chat.deepseek.com/');
    await page.evaluate((ls) => {
      Object.entries(ls).forEach(([key, value]) => {
        try { window.localStorage.setItem(key, value); } catch (e) {}
      });
    }, auth.localStorage);
    // 刷新使 localStorage 生效
    await page.reload();
  }

  return auth;
}

/**
 * 保存登录态(从当前页面导出)
 * @param {import('playwright').Page} page
 */
async function saveAuth(page) {
  const context = page.context();
  const cookies = await context.cookies();
  const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');

  const localStorage = await page.evaluate(() => {
    const data = {};
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      data[key] = window.localStorage.getItem(key);
    }
    return data;
  });

  const authData = {
    savedAt: new Date().toISOString(),
    cookies: cookieStr,
    localStorage
  };

  fs.writeFileSync(AUTH_FILE, JSON.stringify(authData, null, 2));
  return authData;
}

module.exports = { loadAuth, applyAuth, saveAuth, AUTH_FILE };
