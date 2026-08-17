const { chromium } = require('playwright');
const { saveAuth } = require('../src/auth');

(async () => {
  console.log('正在打开浏览器,请在窗口中登录 DeepSeek...');
  console.log('登录完成后,脚本会自动检测并保存登录态。\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  await page.goto('https://chat.deepseek.com/');

  // 等待用户登录(检测 URL 是否包含 /a/chat/ 或 textarea 出现)
  console.log('等待登录...');
  await page.waitForFunction(() => {
    const url = window.location.href;
    const hasTextarea = !!document.querySelector('textarea');
    return (url.includes('/a/chat/') || hasTextarea) && !url.includes('/sign_in');
  }, { timeout: 120000 });

  // 额外等待确保登录态稳定
  await page.waitForTimeout(3000);

  // 保存登录态
  console.log('登录成功! 正在保存登录态...');
  const auth = await saveAuth(page);
  console.log(`登录态已保存到: data/auth.json`);
  console.log(`保存时间: ${auth.savedAt}`);

  await browser.close();
  console.log('\n配置完成! 现在可以使用: node src/index.js "你的问题"');
})().catch(e => {
  console.error('配置失败:', e.message);
  process.exit(1);
});
