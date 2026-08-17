/**
 * CompletionDetector - 回答完成检测状态机
 * 
 * 参考 DeepSeek V4 Pro 方案:
 * - 组合 XHR 事件 + DOM 状态 + 超时兜底
 * - 区分"深度思考"和"正文"两个阶段
 * - 不依赖单一信号,多源融合判断
 * 
 * 使用方式:
 *   在 Playwright 中注入,通过 page.evaluate() 运行
 *   通过 window.__dsBridge 回调传回状态变化
 */

const CompletionDetectorScript = `
(function() {
  if (window.__dsDetector) return;
  
  // 状态定义
  const STATE = {
    IDLE: 'idle',
    WAITING: 'waiting',
    STREAMING: 'streaming',
    MAYBE_DONE: 'maybe_done',
    DONE: 'done',
    ERROR: 'error',
    TIMEOUT: 'timeout'
  };

  // 配置
  const config = {
    idleTimeout: 12,        // 正文阶段:12秒无新chunk判定可能完成
    thinkingIdleTimeout: 25, // 深度思考阶段:25秒无新chunk继续等待
    maxTimeout: 300,        // 总超时5分钟
    checkInterval: 1000     // 检测间隔1秒
  };

  let state = STATE.IDLE;
  let lastChunkTs = null;
  let startTs = null;
  let thinkingPhase = false;
  let fullText = '';
  let sessionId = null;
  let pollTimer = null;

  // 回调函数(由外部注入)
  const onStateChange = window.__dsOnState || (() => {});
  const onComplete = window.__dsOnComplete || (() => {});
  const onError = window.__dsOnError || (() => {});

  // DOM 检测:停止按钮是否消失
  function isStopButtonGone() {
    const btns = document.querySelectorAll('button');
    for (const b of btns) {
      if (b.textContent.includes('停止') && b.offsetParent !== null) {
        return false; // 停止按钮还在显示
      }
    }
    return true;
  }

  // DOM 检测:发送按钮是否可用
  function isSendReady() {
    const textareas = document.querySelectorAll('textarea');
    for (const ta of textareas) {
      if (ta.offsetParent !== null && !ta.disabled) {
        return true;
      }
    }
    return false;
  }

  // DOM 检测:是否有"思考中"标识
  function isThinking() {
    return document.body.innerText.includes('正在思考') || 
           document.body.innerText.includes('思考中') ||
           !!document.querySelector('[class*="thinking"]');
  }

  // DOM 检测:是否有错误信息
  function hasError() {
    const text = document.body.innerText;
    return text.includes('登录过期') || 
           text.includes('验证码') || 
           text.includes('生成失败') ||
           text.includes('网络错误');
  }

  // DOM 检测:是否出现验证码
  function hasCaptcha() {
    return !!document.querySelector('iframe[src*="captcha"]') ||
           document.body.innerText.includes('安全验证');
  }

  // 状态机轮询
  function poll() {
    if (state === STATE.IDLE || state === STATE.WAITING) return;

    const now = Date.now();

    // 检测错误
    if (hasError()) {
      state = STATE.ERROR;
      onError({ type: 'error', message: '检测到错误', sessionId });
      return;
    }

    // 检测验证码
    if (hasCaptcha()) {
      state = STATE.ERROR;
      onError({ type: 'captcha', message: '检测到验证码', sessionId });
      return;
    }

    // 总超时检测
    if (startTs && (now - startTs > config.maxTimeout * 1000)) {
      state = STATE.TIMEOUT;
      onError({ type: 'timeout', message: '总超时', sessionId });
      return;
    }

    // 只在 STREAMING 或 MAYBE_DONE 状态检测
    if (state === STATE.STREAMING || state === STATE.MAYBE_DONE) {
      const idleTimeout = thinkingPhase ? config.thinkingIdleTimeout : config.idleTimeout;
      
      if (lastChunkTs && (now - lastChunkTs > idleTimeout * 1000)) {
        // 超过空闲超时,辅助判断 DOM 状态
        if (isStopButtonGone() && isSendReady()) {
          state = STATE.DONE;
          onComplete({ text: fullText, sessionId, duration: now - startTs });
          return;
        }
        // 如果还在思考中,继续等待
        if (thinkingPhase && isThinking()) {
          // 继续等待,不切换状态
        }
      }
    }
  }

  // XHR 事件处理
  function onXhrStart(ctx) {
    if (state === STATE.IDLE) {
      state = STATE.WAITING;
      startTs = Date.now();
      sessionId = ctx.sessionId || 'unknown';
      onStateChange({ state, sessionId });
    }
  }

  function onChunk(text) {
    if (state === STATE.WAITING || state === STATE.STREAMING) {
      state = STATE.STREAMING;
      lastChunkTs = Date.now();
      fullText += text;
      onStateChange({ state, textLength: fullText.length, sessionId });
    }
  }

  function onThinkingStart() {
    thinkingPhase = true;
    onStateChange({ state, thinking: true, sessionId });
  }

  function onThinkingEnd() {
    thinkingPhase = false;
    lastChunkTs = Date.now(); // 重置时间,给正文阶段更多时间
    onStateChange({ state, thinking: false, sessionId });
  }

  function onStreamEnd() {
    if (state === STATE.STREAMING) {
      state = STATE.MAYBE_DONE;
      onStateChange({ state, sessionId });
    }
  }

  // 启动轮询
  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(poll, config.checkInterval);
  }

  // 停止轮询
  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  // 公开 API
  window.__dsDetector = {
    STATE,
    start: () => {
      state = STATE.IDLE;
      startTs = null;
      lastChunkTs = null;
      thinkingPhase = false;
      fullText = '';
      startPolling();
    },
    stop: () => {
      stopPolling();
      state = STATE.IDLE;
    },
    getState: () => ({ state, sessionId, textLength: fullText.length, thinkingPhase }),
    onXhrStart,
    onChunk,
    onThinkingStart,
    onThinkingEnd,
    onStreamEnd
  };

  console.log('[DS-Detector] 状态机已启动');
})();
`;

module.exports = { CompletionDetectorScript };
