/**
 * XHR 拦截脚本 - 注入到 DeepSeek 页面中
 * 
 * 参考 deepseek-bridge (kusoidev/deepseek-bridge) 的 XhrPatch.ts
 * 拦截 /api/v0/chat/completion 的流式响应,提取 RESPONSE 和 THINK 片段
 * 
 * 此脚本作为字符串被 page.evaluate() 注入,运行在页面上下文中
 * 通过 window.__dsBridge 回调函数将数据传回 Playwright
 */

const XHR_INTERCEPTOR_SCRIPT = `
(function() {
  // 防止重复注入
  if (window.__dsBridge) return;
  
  // 回调函数(由 Playwright 通过 exposeFunction 注入)
  const onChunk = window.__dsOnChunk || (() => {});
  const onThinking = window.__dsOnThinking || (() => {});
  const onDone = window.__dsOnDone || (() => {});
  const onError = window.__dsOnError || (() => {});
  
  const OrigXHR = window.XMLHttpRequest;
  
  window.XMLHttpRequest = function() {
    const xhr = new OrigXHR();
    let isChat = false;
    let lastOffset = 0;
    let activeFragmentType = 'RESPONSE';
    let currentEvent = '';
    let listenerAdded = false;
    
    const origOpen = xhr.open.bind(xhr);
    const origSend = xhr.send.bind(xhr);
    
    xhr.open = function(method, url, async, username, password) {
      isChat = typeof url === 'string' && url.includes('/api/v0/chat/completion');
      return origOpen(method, url, async ?? true, username ?? null, password ?? null);
    };
    
    xhr.send = function(body) {
      if (!isChat) { origSend(body); return; }
      if (listenerAdded) { origSend(body); return; }
      listenerAdded = true;
      lastOffset = 0;
      activeFragmentType = 'RESPONSE';
      currentEvent = '';
      
      xhr.addEventListener('progress', () => {
        try {
          const raw = xhr.responseText || '';
          const chunk = raw.slice(lastOffset);
          lastOffset = raw.length;
          if (!chunk) return;
          
          const lines = chunk.split('\\n');
          for (const line of lines) {
            const t = line.trim();
            if (!t) { currentEvent = ''; continue; }
            if (t.startsWith('event: ')) { currentEvent = t.slice(7).trim(); continue; }
            if (!t.startsWith('data: ')) continue;
            const payload = t.slice(6);
            if (payload.trim() === '[DONE]' || payload.trim() === 'FINISHED' || currentEvent === 'message_stop') continue;
            
            try {
              const parsed = JSON.parse(payload);
              let content = '';
              let thinking = '';
              
              // 格式1: OpenAI 兼容格式 choices[0].delta
              const delta = parsed?.choices?.[0]?.delta;
              if (delta) {
                if (typeof delta.reasoning_content === 'string') thinking += delta.reasoning_content;
                if (typeof delta.content === 'string') content += delta.content;
              }
              // 格式2: fragments 数组
              else if ('p' in parsed && typeof parsed.p === 'string' && parsed.p.includes('fragments')) {
                if (parsed.o === 'APPEND' && Array.isArray(parsed.v)) {
                  for (const frag of parsed.v) {
                    if (frag.type === 'THINK' || frag.type === 'THINKING') activeFragmentType = 'THINK';
                    else if (frag.type === 'RESPONSE') activeFragmentType = 'RESPONSE';
                    if (typeof frag.content === 'string' && frag.content) {
                      if (activeFragmentType === 'THINK') thinking += frag.content;
                      else content += frag.content;
                    }
                  }
                } else if (typeof parsed.v === 'string' && parsed.v) {
                  if (activeFragmentType === 'THINK') thinking += parsed.v;
                  else content += parsed.v;
                }
              }
              // 格式3: 直接字符串
              else if ('v' in parsed && typeof parsed.v === 'string' && parsed.v && parsed.v !== 'FINISHED') {
                const unescaped = parsed.v.replace(/\\\\n/g, '\\n').replace(/\\\\t/g, '\\t').replace(/\\\\r/g, '\\r');
                if (currentEvent === 'thinking' || activeFragmentType === 'THINK') thinking += unescaped;
                else content += unescaped;
              }
              // 格式4: 嵌套 response 对象
              else if ('v' in parsed && typeof parsed.v === 'object' && parsed.v !== null && !Array.isArray(parsed.v)) {
                const resp = parsed.v?.response;
                if (resp && !resp.has_pending_fragment && Array.isArray(resp.fragments)) {
                  for (const frag of resp.fragments) {
                    if (frag.type === 'THINK' || frag.type === 'THINKING') activeFragmentType = 'THINK';
                    else if (frag.type === 'RESPONSE') activeFragmentType = 'RESPONSE';
                    if (typeof frag.content === 'string') {
                      if (activeFragmentType === 'THINK') thinking += frag.content;
                      else content += frag.content;
                    }
                  }
                }
              }
              // 格式5: BATCH 操作数组
              else if ('v' in parsed && Array.isArray(parsed.v)) {
                for (const op of parsed.v) {
                  if (op.p !== 'fragments' || op.o !== 'BATCH') continue;
                  const nestedOps = op.v;
                  if (!Array.isArray(nestedOps)) continue;
                  for (const bop of nestedOps) {
                    if (bop.o !== 'APPEND' || !Array.isArray(bop.v)) continue;
                    for (const frag of bop.v) {
                      if (frag.type === 'THINK' || frag.type === 'THINKING') activeFragmentType = 'THINK';
                      else if (frag.type === 'RESPONSE') activeFragmentType = 'RESPONSE';
                      if (typeof frag.content === 'string') {
                        if (activeFragmentType === 'THINK') thinking += frag.content;
                        else content += frag.content;
                      }
                    }
                  }
                }
              }
              
              if (thinking) onThinking(thinking);
              if (content) onChunk(content);
            } catch (e) {}
          }
        } catch (e) {}
      });
      
      xhr.addEventListener('load', () => onDone());
      xhr.addEventListener('error', () => onError(xhr.statusText || 'network error'));
      
      origSend(body);
    };
    
    return xhr;
  };
  
  // 保留原型链和常量
  window.XMLHttpRequest.prototype = OrigXHR.prototype;
  ['UNSENT','OPENED','HEADERS_RECEIVED','LOADING','DONE'].forEach(s => {
    try { window.XMLHttpRequest[s] = OrigXHR[s]; } catch(e) {}
  });
  
  window.__dsBridge = true;
})();
`;

module.exports = { XHR_INTERCEPTOR_SCRIPT };
