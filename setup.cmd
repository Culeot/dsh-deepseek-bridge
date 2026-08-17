@echo off
REM DeepSeek Bridge - Windows 首次配置脚本
REM 打开浏览器登录 DeepSeek,自动保存登录态

echo === DeepSeek Bridge 首次配置 ===
echo.
echo 即将打开浏览器窗口,请登录 DeepSeek 网页端。
echo 登录完成后,脚本会自动保存登录态并关闭浏览器。
echo.
pause

node scripts\setup.js

echo.
echo === 配置完成 ===
echo.
echo 现在可以使用:
echo   node src\index.js "你的问题"
