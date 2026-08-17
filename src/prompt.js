/**
 * 提示词模板 + 辩证思维引导
 * 
 * 参考 DeepSeek V4 Pro 方案:
 * - 结构化模板:背景/目标/约束/输出格式
 * - 辩证思维引导:正-反-合分析
 * - few-shot 示例
 * - JSON 解析器容错
 */

// 项目上下文(自动注入)
const PROJECT_CONTEXT = `你是 dsh-deepseek-bridge 的架构师。

当前环境:
- 龙猫 LongCat-2.0 agent,运行在 DSH (DeepSeek Harness)
- 无 DeepSeek 官方 API key,只能通过网页端免费使用
- 已开发:浏览器自动化操控、专家模式+深度思考、登录态保存、会话管理
- 待开发:回答完成检测 v2、提示词模板、辩证思维引导、自动推进执行`;

// 辩证思维引导
const DIALECTICAL_GUIDANCE = `请用辩证思维框架分析问题:

1. 【条件】实际条件是什么?(资源/约束/时机)
2. 【主要矛盾】哪个问题牵一发动全身?
3. 【规律】客观规律是什么?
4. 【一分为二】方案的收益和代价?
5. 【盲区】可能忽略的变量?

Jack 审查关:拆前提、核来源、敢反对、点盲区`;

// 提示词模板
function buildPrompt(question, options = {}) {
  const { 
    requireJson = true, 
    fewShot = true,
    context = PROJECT_CONTEXT 
  } = options;

  let prompt = `${context}

${DIALECTICAL_GUIDANCE}

---
问题: ${question}
---`;

  if (requireJson) {
    prompt += `

请严格输出 JSON,不要输出 Markdown 代码块,不要输出任何额外解释。
JSON 结构:
{
  "alternatives": [
    {
      "name": "方案名称",
      "pros": ["优点1", "优点2"],
      "cons": ["缺点1", "缺点2"],
      "cost": "成本说明",
      "risk": "风险说明"
    }
  ],
  "comparison": "方案对比总结",
  "recommendation": "推荐方案名称",
  "reasoning": "推荐理由",
  "execution_plan": [
    {
      "step": 1,
      "action": "执行动作",
      "command": "具体命令或伪代码",
      "verify": "如何验证该步骤成功"
    }
  ],
  "rollback": "如果推荐方案失败,如何回滚",
  "risks": ["整体风险1", "整体风险2"]
}

辩证思维要求:
1. 必须给出至少两个可选方案
2. 对每个方案必须进行正反论证
3. 必须说明推荐方案在什么条件下会失败
4. 如果推荐方案失败,必须给出备选方案或回滚方案
5. 在输出前,请自我检查:我的推荐是否真的适合当前无 API key、网页端免费的条件?`;
  }

  if (fewShot && requireJson) {
    prompt += `

示例(好输出):
{
  "alternatives": [
    {"name": "方案A", "pros": ["简单"], "cons": ["功能有限"], "cost": "低", "risk": "低"},
    {"name": "方案B", "pros": ["功能强"], "cons": ["复杂"], "cost": "高", "risk": "中"}
  ],
  "comparison": "方案A适合快速验证,方案B适合生产",
  "recommendation": "方案A",
  "reasoning": "当前阶段应以快速验证为主",
  "execution_plan": [
    {"step": 1, "action": "创建目录", "command": "mkdir -p output", "verify": "ls output"}
  ],
  "rollback": "删除 output 目录",
  "risks": ["方案可能不满足未来需求"]
}`;
  }

  return prompt;
}

// JSON 解析器(容错)
function parseResponse(text) {
  if (!text) return { error: '空响应' };

  // 1. 尝试直接解析
  try {
    return JSON.parse(text);
  } catch (e) {}

  // 2. 剥离 Markdown 代码块
  let clean = text;
  const codeBlockMatch = clean.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i);
  if (codeBlockMatch) {
    clean = codeBlockMatch[1].trim();
  }

  // 3. 查找 JSON 对象
  const jsonMatch = clean.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {}
  }

  // 4. 尝试修复常见 JSON 错误
  let fixed = clean
    .replace(/,\s*}/g, '}')       // 删除尾随逗号
    .replace(/,\s*]/g, ']')       // 删除尾随逗号
    .replace(/'/g, '"')           // 单引号转双引号
    .replace(/(\w+):/g, '"$1":'); // 无引号键添加引号

  try {
    return JSON.parse(fixed);
  } catch (e) {
    return { 
      error: 'JSON 解析失败', 
      raw: text.substring(0, 500),
      parseError: e.message 
    };
  }
}

// 验证 JSON 结构
function validateResponse(obj) {
  const required = ['alternatives', 'recommendation', 'execution_plan'];
  const missing = required.filter(k => !(k in obj));
  
  if (missing.length > 0) {
    return { valid: false, missing };
  }

  if (!Array.isArray(obj.alternatives) || obj.alternatives.length < 2) {
    return { valid: false, error: '至少需要两个可选方案' };
  }

  if (!Array.isArray(obj.execution_plan) || obj.execution_plan.length === 0) {
    return { valid: false, error: '执行计划不能为空' };
  }

  return { valid: true };
}

module.exports = { buildPrompt, parseResponse, validateResponse, PROJECT_CONTEXT, DIALECTICAL_GUIDANCE };
