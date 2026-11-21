// Reddit 去广告 - script 版 v17
// v17: 在 v16 基础上，补 multipart/mixed（GraphQL @defer 流式响应）与无空行分隔的 SSE 流。
// 2026-11-21 v16 真机验证：帖子内广告没了、主题加载正常，但主页广告回来了。
// 根因已用合成体实证：旧版（v14 及以前）把 multipart 两段 JSON 拼成裸 JSON 数组回写，
// 恰好把广告滤掉了；v16 认不出 multipart，原样放行，广告全回来。
// v17 按 boundary 分段、每段 JSON 体单独过滤、原样回写分段结构；SSE 整块拼不回单个 JSON 时回退逐行过滤。
let body = $response.body;

function tryParse(s) {
  try { return JSON.parse(s); } catch (e) { return null; }
}

function isNonEmptyObj(x) {
  return x && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).length > 0;
}

function hasCTA(n) {
  if (!n || typeof n !== 'object') return false;
  if (n.callToAction != null) return true;
  if (n.cta != null) return true;
  if (n.call_to_action != null) return true;
  if (n.actionButton != null) return true;
  return false;
}

function isAdNode(node) {
  if (!node || typeof node !== 'object') return false;
  if (node.__typename === 'AdPost') return true;
  if (isNonEmptyObj(node.adPayload)) return true;
  if (node.isPromoted === true || node.promoted === true || node.isSponsored === true) return true;
  if (node.isAd === true || node.isAdvertisement === true) return true;
  if (node.is_promoted === true || node.sponsored === true || node.is_sponsored === true) return true;
  if (hasCTA(node)) return true;
  return false;
}

function cellLooksLikeAd(c) {
  if (!c || typeof c !== 'object') return false;
  if (c.__typename === 'AdMetadataCell') return true;
  if (c.isAdPost === true) return true;
  return false;
}

function walk(v) {
  if (Array.isArray(v)) {
    let out = [];
    for (let item of v) {
      let w = walk(item);
      if (w !== null && w !== undefined) out.push(w);
    }
    return out;
  }
  if (v && typeof v === 'object') {
    // v14 新增：任意位置的 AdPost 对象直接删（对齐上游 jq 版）。
    if (v.__typename === 'AdPost') return null;
    if (v.isNsfw === true) v.isNsfw = false;
    if (v.isNsfwMediaBlocked === true) v.isNsfwMediaBlocked = false;
    if (v.isNsfwContentShown === false) v.isNsfwContentShown = true;
    if (Array.isArray(v.commentsPageAds)) v.commentsPageAds = [];
    // 只在边的 node 层判定，不对任意嵌套对象跑 isAdNode。
    if (v.node && typeof v.node === 'object') {
      let n = v.node;
      if (isAdNode(n)) return null;
      if (Array.isArray(n.cells) && n.cells.some(cellLooksLikeAd)) return null;
    }
    for (let k of Object.keys(v)) {
      v[k] = walk(v[k]);
    }
    return v;
  }
  return v;
}

function splitMultipart(lines, bnd) {
  let open = '--' + bnd, close = '--' + bnd + '--';
  let first = -1;
  for (let i = 0; i < lines.length; i++) {
    let t = lines[i].trim();
    if (t === open || t === close) { first = i; break; }
  }
  if (first < 0) return null;
  let preamble = lines.slice(0, first);
  let parts = [];
  let epilogue = [];
  let i = first;
  while (i < lines.length) {
    let t = lines[i].trim();
    if (t === close) { parts.push({ closing: true, delim: lines[i] }); epilogue = lines.slice(i + 1); break; }
    if (t !== open) { epilogue = lines.slice(i); break; }
    let delim = lines[i]; i++;
    let headers = [];
    while (i < lines.length && lines[i].trim() !== '') { headers.push(lines[i]); i++; }
    let blank = [];
    while (i < lines.length && lines[i].trim() === '') { blank.push(lines[i]); i++; }
    let blines = [];
    while (i < lines.length) {
      let t2 = lines[i].trim();
      if (t2 === open || t2 === close) break;
      blines.push(lines[i]); i++;
    }
    parts.push({ closing: false, delim, headers, blank, body: blines });
    if (i >= lines.length) break;
  }
  return { preamble, parts, epilogue };
}

// ---- 格式识别：只处理能原格式回写的体，无法识别的原样放行 ----
let fmt = null; // 'json' | 'b64' | 'sse' | 'slice'
let obj = null;
let sliceStart = -1, sliceEnd = -1;
let b64UrlSafe = false;

// 1. 纯 JSON
obj = tryParse(body);
if (obj !== null) fmt = 'json';

// 2. 整段 base64 编码的 JSON
if (!fmt) {
  try {
    let t = body.trim().replace(/\s+/g, '');
    if (/^[A-Za-z0-9+/=_-]+$/.test(t) && t.length > 20) {
      b64UrlSafe = /[-_]/.test(t);
      let norm = t.replace(/-/g, '+').replace(/_/g, '/');
      let bin = '';
      try { bin = atob(norm); } catch (e) { bin = ''; }
      if (bin) {
        let p = tryParse(bin);
        if (p !== null) { obj = p; fmt = 'b64'; }
      }
    }
  } catch (e) {}
}

// 3. SSE 流：至少一行 data: 行能解析为 JSON
if (!fmt) {
  let lines = body.split(/\r?\n/);
  for (let ln of lines) {
    let t = ln.trim();
    if (t.startsWith('data:') && tryParse(t.slice(5).trim()) !== null) { fmt = 'sse'; break; }
  }
}

// 4. multipart/mixed（GraphQL @defer 流式响应）：按 boundary 分段，每段 JSON 体单独过滤
let mpEol = '\n';
let mpParts = null;
if (!fmt) {
  let eol = body.includes('\r\n') ? '\r\n' : '\n';
  let lines = body.split(/\r?\n/);
  let bnd = null;
  for (let ln of lines) {
    let m = /^--(\S+?)(--)?$/.exec(ln.trim());
    if (m) { bnd = m[1]; break; }
  }
  if (bnd) {
    let st = splitMultipart(lines, bnd);
    if (st) {
      let anyJson = false;
      for (let p of st.parts) {
        if (p.closing) continue;
        let txt = p.body.join(eol).trim();
        p.obj = txt ? tryParse(txt) : null;
        if (p.obj !== null) anyJson = true;
      }
      if (anyJson) { fmt = 'multipart'; mpEol = eol; mpParts = st; }
    }
  }
}

// 5. 切片：JSON 对象/数组嵌在前缀/后缀里（XSSI 前缀、回调包装等）
if (!fmt) {
  let s = body.indexOf('{');
  let e = body.lastIndexOf('}');
  if (s >= 0 && e > s) {
    let p = tryParse(body.slice(s, e + 1));
    if (p !== null) { obj = p; fmt = 'slice'; sliceStart = s; sliceEnd = e; }
  }
  if (!fmt) {
    let s2 = body.indexOf('[');
    let e2 = body.lastIndexOf(']');
    if (s2 >= 0 && e2 > s2) {
      let p = tryParse(body.slice(s2, e2 + 1));
      if (p !== null) { obj = p; fmt = 'slice'; sliceStart = s2; sliceEnd = e2; }
    }
  }
}

if (!fmt) $done({}); // 无法识别：原样放行，绝不改格式。

let out = walk(obj);

if (fmt === 'json') $done({ body: JSON.stringify(out) });

if (fmt === 'b64') {
  let enc = btoa(JSON.stringify(out));
  if (b64UrlSafe) enc = enc.replace(/\+/g, '-').replace(/\//g, '_');
  $done({ body: enc });
}

if (fmt === 'slice') {
  $done({ body: body.slice(0, sliceStart) + JSON.stringify(out) + body.slice(sliceEnd + 1) });
}

if (fmt === 'sse') {
  // 逐事件过滤，原样保留分帧：空行与非 data 行原样保留，data 行换成过滤后的 JSON；
  // 整个事件被删（walk 返回 null）时整块事件丢弃。
  let lines = body.split(/\r?\n/);
  let outLines = [];
  let i = 0;
  while (i < lines.length) {
    let block = [];
    while (i < lines.length && lines[i].trim() !== '') { block.push(lines[i]); i++; }
    let sep = [];
    while (i < lines.length && lines[i].trim() === '') { sep.push(lines[i]); i++; }
    let dataIdx = [];
    for (let j = 0; j < block.length; j++) {
      if (block[j].trim().startsWith('data:')) dataIdx.push(j);
    }
    if (dataIdx.length === 0) { outLines.push(...block, ...sep); continue; }
    let payload = dataIdx.map(j => block[j].trim().slice(5).trim()).join('\n');
    let parsed = tryParse(payload);
    if (parsed === null) {
      // 回退：逐行解析（无空行分隔的连续 data 流，整块拼不回单个 JSON 时）
      let kept = [];
      for (let j = 0; j < block.length; j++) {
        let t = block[j].trim();
        if (t.startsWith('data:')) {
          let p = tryParse(t.slice(5).trim());
          if (p === null) { kept.push(block[j]); continue; }
          let f = walk(p);
          if (f === null || f === undefined) { continue; }
          kept.push('data: ' + JSON.stringify(f));
        } else {
          kept.push(block[j]);
        }
      }
      outLines.push(...kept, ...sep);
      continue;
    }
    let filtered = walk(parsed);
    if (filtered === null || filtered === undefined) { continue; }
    let kept = [];
    let dataEmitted = false;
    for (let j = 0; j < block.length; j++) {
      if (block[j].trim().startsWith('data:')) {
        if (!dataEmitted) { kept.push('data: ' + JSON.stringify(filtered)); dataEmitted = true; }
      } else {
        kept.push(block[j]);
      }
    }
    outLines.push(...kept, ...sep);
  }
  $done({ body: outLines.join('\n') });
}

if (fmt === 'multipart') {
  // 按 boundary 分段回写：分隔符、段头、空行原样保留，每段 JSON 体换成过滤后的 JSON；
  // 整段是广告（walk 返回 null）时丢弃该段。
  let outLines = [...mpParts.preamble];
  for (let p of mpParts.parts) {
    if (p.closing) { outLines.push(p.delim); break; }
    if (p.obj !== null) {
      let f = walk(p.obj);
      if (f === null || f === undefined) { continue; }
      outLines.push(p.delim, ...p.headers, ...p.blank, JSON.stringify(f));
    } else {
      outLines.push(p.delim, ...p.headers, ...p.blank, ...p.body);
    }
  }
  outLines.push(...mpParts.epilogue);
  $done({ body: outLines.join(mpEol) });
}
