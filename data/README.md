# 数据目录

此目录存储登录态和会话数据(已被 .gitignore 忽略)。

## 文件

- `auth.json` - DeepSeek 登录态(cookies + localStorage)
- `sessions.json` - 项目↔对话 URL 映射

## 生成方式

运行 `setup.sh` 或 `setup.cmd` 自动生成。

**禁止手动提交这些文件到 Git!**
