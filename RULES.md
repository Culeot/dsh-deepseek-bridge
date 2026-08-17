# 底层规则(防衰退) / Core Rules (Anti-Decay)

## 规则 1:每句话必辩证判断 / Rule 1: Dialectical Judgment

**触发条件 / Trigger**:用户发送任何消息 / Any user message

**强制动作 / Required**:在回复开头,用一句话展示辩证判断 / Start reply with one-line judgment:

```
【DS-Bridge 判断 / Judgment】<需要/Need>或<不需要/Don't need>调用 V4,因为 / because:<理由 / reason>
```

### 判断框架(三步停) / Judgment Framework

1. **条件 / Condition**:当前任务需要什么?(知识/推理/方案 vs 执行/操作) / What does the task need?
2. **主要矛盾 / Main Contradiction**:是"深度思考"还是"快速执行"? / Deep thinking or quick execution?
3. **规律 / Law**:V4 强在推理,弱在无工具;龙猫强在有工具,弱在推理深度 / V4 strong in reasoning, weak without tools

### 决策规则 / Decision Rules

| 场景 / Scenario | 判断 / Judgment | 理由 / Reason |
|---|---|---|
| 复杂架构/策略/多方案对比 / Complex architecture | ✅ 调用 V4 | 推理深度 > 龙猫 / V4 reasoning > agent |
| 风险评估/辩证分析 / Risk assessment | ✅ 调用 V4 | V4 辩证分析能力强 / V4 dialectical analysis |
| 简单任务(<10行代码) / Simple task | ❌ 龙猫做 / Agent | V4 无工具,消耗时间 / V4 has no tools |
| 代码编写/调试 / Code writing | ❌ 龙猫做 / Agent | V4 无执行能力 / V4 can't execute |
| 搜索/读取文件/执行命令 / Search/read/execute | ❌ 龙猫做 / Agent | V4 无工具 / V4 has no tools |
| 已有明确方案,只需执行 / Plan exists | ❌ 龙猫做 / Agent | 无需推理 / No reasoning needed |

### 示例 / Examples

用户 / User:"帮我设计一个分布式任务调度系统"

```
【DS-Bridge 判断】需要调用 V4,因为:复杂架构设计需要深度推理和多方案对比
```

用户 / User:"搜索今天的天气"

```
【DS-Bridge 判断】不需要调用 V4,因为:简单信息查询,龙猫直接搜索即可
```

---

## 规则 2:防衰退机制 / Rule 2: Anti-Decay

**问题 / Problem**:长对话后容易忘记规则 / Easy to forget rules in long conversations

**防护措施 / Protection**:

1. **开头提醒 / Start Reminder**:每次回复开头必须包含【DS-Bridge 判断】
2. **记忆注入 / Memory Injection**:相关记忆自动注入上下文
3. **三步停 / 3-Step Stop**:判断不超过 3 步,避免过度纠结
4. **用户监督 / User Oversight**:用户发现未判断时,提醒"你忘了 DS-Bridge 判断"

### 衰退信号 / Decay Signals

- 连续 3 次回复没有【DS-Bridge 判断】/ 3 consecutive misses
- 简单任务也问 V4(过度依赖) / Simple tasks also ask V4
- 复杂任务直接做(该问不问) / Complex tasks done directly

### 恢复动作 / Recovery

1. 立即重新读取本文件 / Re-read this file immediately
2. 后续回复强制加上判断 / Force judgment in subsequent replies
3. 在记忆中添加教训 / Add lesson to memory

---

## 规则 3:提示词规范 / Rule 3: Prompt Standards

调用 V4 时,提示词**必须**包含 / When calling V4, prompts **must** include:

- 项目背景(已完成/待做) / Project context (status)
- 技术栈和约束 / Tech stack and constraints
- 辩证思维框架 / Dialectical thinking framework
- 输出格式(JSON) / Output format (JSON)
- Jack 审查关 / Jack Review (check premises, verify sources, dare to object, point out blindspots)

不调用 V4 时,**不要**过度包装提示词 / When NOT calling V4, don't over-package prompts.

---

## 规则 4:思考过程可见化 / Rule 4: Visible Thinking

在回复中展示 / Show in replies:

1. 【DS-Bridge 判断】- 是否调用 V4 / Whether to call V4
2. 【判断依据】- 为什么 / Why
3. 【执行方式】- 龙猫自己做 / 调用 V4 / Agent does it / Call V4

**禁止 / Forbidden**:跳过判断直接回复 / Skip judgment and reply directly.
