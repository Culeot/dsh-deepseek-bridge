# dsh-deepseek-bridge 开发全记录

> 2026-08-17 | 从需求到发布 v0.2.0 的完整历程

---

## 一、需求起源

### 原始需求
- 让龙猫(LongCat-2.0)能自动向 DeepSeek 网页端 V4 Pro 提问
- V4 Pro 充当"架构师"角色,负责出方案
- 龙猫充当"项目经理"角色,负责拆任务和执行
- 用户当"老板",负责辩证取舍

### 核心约束
- 无 DeepSeek 官方 API key,只能通过网页端免费使用
- 需要零成本利用 V4 Pro 的推理能力

---

## 二、技术路线探索

### 方案 A: 独立 Node.js 脚本(失败)
- **思路**:用 Playwright 写独立脚本,通过 stdio 输出结果
- **问题**:pwsh 有 120 秒超时,浏览器被强制关闭,回答丢失
- **教训**:DSH 环境中,长时间任务不要用独立脚本

### 方案 B: DSH Playwright MCP(成功)
- **思路**:直接用 DSH 内置的 Playwright MCP 工具操控浏览器
- **优势**:浏览器保持打开,不受超时限制
- **结论**:最终采用此方案作为主要操控方式

### 方案 C: DSH 工具插件(补充)
- **思路**:封装为 DSH 插件,注册 `ask_ds`/`list_ds_sessions`/`run_ds_plan` 工具
- **状态**:已打包发布,需 `dsh plugin add` + 重启后生效

---

## 三、架构演进

### v0.1.0: 基础功能
- 浏览器自动化(MCP 操控)
- 专家模式 + 深度思考自动开启
- XHR 拦截流式响应(多版本冲突,最终弃用)
- DOM 检测方案(替代 XHR)
- 登录态保存/导入
- 会话管理(sessions.json)

### v0.2.0: 通用适配
- 移除 LongCat-2.0 硬编码
- 模板变量 `<%= agentName %>` / `<%= runtimeEnv %>`
- 环境变量 `DS_AGENT_NAME` / `DS_RUNTIME_ENV`
- 支持任意 DSH agent

---

## 四、关键踩坑

### 1. XHR 拦截器版本冲突
- **现象**:注入 v1 后,v2/v3/v4 都无法覆盖
- **原因**:`addInitScript` 在页面加载时注入,后续注入无法覆盖已有拦截器
- **解决**:改用 DOM 检测方案

### 2. 回答完成检测不稳定
- **现象**:V4 还在思考时就被判定为完成
- **原因**:只检查"停止按钮消失",未检测文本是否稳定
- **解决**:循环检测文本长度,连续 3 次不变才算完成

### 3. Windows 命令不兼容
- **现象**:V4 生成的 `mkdir -p` 在 Windows 上失败
- **解决**:`translateCommand()` 函数自动翻译 Unix→Windows 命令

### 4. npm 发布声称"未发"
- **现象**:记忆写"npm 未发(本地安装用 git clone)"
- **原因**:实际是**没有执行 npm publish**,不是"选择不发"
- **教训**:不要将"未完成"包装为"主动选择"

### 5. GitHub About 中文乱码
- **原因**:PowerShell JSON 编码问题
- **解决**:暂时用纯英文描述

---

## 五、安全清场

### 清除内容
- `data/auth.json` - 真实 DeepSeek cookies
- `data/sessions.json` - 真实会话 URL
- `scripts/auto-detect.js` - 测试脚本
- `scripts/explore-*.js` - 探索脚本
- `scripts/record-state.js` - 记录脚本
- `test-response.json` - 测试响应(编码损坏)
- `install.sh` / `run.cmd` - 本地路径硬编码

---

## 六、发布清单

| 渠道 | 版本 | 状态 |
|---|---|---|
| npm | v0.2.0 | ✅ 已发布 |
| GitHub | main, tag v0.2.0 | ✅ 已推送 |
| GitHub Release | v0.2.0 | ✅ 已创建 |
| DSH 插件 | v0.2.0 | ✅ 已安装(需重启) |

---

## 七、三条审查

### Feynman(内容准确性) ✅
- 技术命令正确,JSON 结构有效

### Humanizer(去 AI 味) ✅
- 文档结构化合理,术语一致

### Jack(事实核验) ✅
- 无夸大声明,安全合规,MIT 许可证

---

## 八、未解决问题

1. **Windows 复杂 shell 语法**:heredoc 等仍需人工适配
2. **GitHub About 中文描述**:编码问题,暂时用英文
3. **DSH 插件工具**:需重启后才能验证是否注册
