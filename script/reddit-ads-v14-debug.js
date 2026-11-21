// Reddit 去广告 - 调试 v14 (临时)
// 在 v13 基础上：
// 1) 增加上游 jq 版已有的“任意位置 __typename==='AdPost' 直接删”
//    （v13 只在边的 .node 层判断，裸 AdPost 对象漏网）；
// 2) 把诊断计数写进帖子标题前缀，用户截图后可见：
//    [DBG fmt cpa:N adE:M bare:K]
//    fmt=解析方式(json/b64/sse/slice/none)，cpa=commentsPageAds 原始条数，
//    adE=边节点是广告的条数，bare=不在 .node 下的裸 AdPost 对象数。
//    标题没有前缀 = 脚本没跑起来，或响应不是 JSON（解析失败）。
let body = $response.body;
let obj = null;
let parsed = false;
let fmt = 'none';

function tryParse(s) {
  try { return JSON.parse(s); } catch (e) { return null; }
}

obj = tryParse(body);
if (obj !== null) { parsed = true; fmt = 'json'; }

if (!parsed) {
  try {
    let t = body.trim().replace(/\s+/g, '');
    if (/^[A-Za-z0-9+/=_-]+$/.test(t) && t.length > 20) {
      let bin = '';
      try { bin = atob(t); } catch (e) { bin = ''; }
      if (bin) {
        let p = tryParse(bin);
        if (p !== null) { obj = p; parsed = true; fmt = 'b64'; }
      }
    }
  } catch (e) {}
}

if (!parsed) {
  let lines = body.split(/\r?\n/);
  let parts = [];
  for (let ln of lines) {
    let t = ln.trim();
    if (!t) continue;
    if (t.startsWith('data:')) t = t.slice(5).trim();
    let p = tryParse(t);
    if (p !== null) parts.push(p);
  }
  if (parts.length > 0) { obj = parts.length === 1 ? parts[0] : parts; parsed = true; fmt = 'sse'; }
}

if (!parsed) {
  let s = body.indexOf('{');
  let e = body.lastIndexOf('}');
  if (s >= 0 && e > s) {
    let p = tryParse(body.slice(s, e + 1));
    if (p !== null) { obj = p; parsed = true; fmt = 'slice'; }
  }
  if (!parsed) {
    let s2 = body.indexOf('[');
    let e2 = body.lastIndexOf(']');
    if (s2 >= 0 && e2 > s2) {
      let p = tryParse(body.slice(s2, e2 + 1));
      if (p !== null) { obj = p; parsed = true; fmt = 'slice'; }
    }
  }
}

if (!parsed) $done({});

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

// 诊断计数（过滤前）：cpa / adE / bare
let cpa = 0;
let adE = 0;
let bare = 0;
function count(v, isNode) {
  if (Array.isArray(v)) { for (let x of v) count(x, false); return; }
  if (v && typeof v === 'object') {
    if (v.__typename === 'AdPost' && !isNode) bare++;
    if (Array.isArray(v.commentsPageAds)) cpa += v.commentsPageAds.length;
    if (v.node && typeof v.node === 'object' && isAdNode(v.node)) adE++;
    for (let k of Object.keys(v)) count(v[k], k === 'node');
  }
}
try { count(obj, false); } catch (e) {}

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

let out = walk(obj);

// 诊断标记：写进帖子标题前缀
let prefix = '[DBG ' + fmt + ' cpa:' + cpa + ' adE:' + adE + ' bare:' + bare + '] ';
let tagged = false;
function tagTitle(v) {
  if (tagged) return;
  if (Array.isArray(v)) { for (let x of v) { tagTitle(x); if (tagged) return; } return; }
  if (v && typeof v === 'object') {
    if (typeof v.title === 'string' && v.title && v.title.indexOf('[DBG') !== 0) {
      v.title = prefix + v.title;
      tagged = true;
      return;
    }
    for (let k of Object.keys(v)) { tagTitle(v[k]); if (tagged) return; }
  }
}
try {
  if (out && out.data && out.data.post && typeof out.data.post.title === 'string' && out.data.post.title) {
    out.data.post.title = prefix + out.data.post.title;
    tagged = true;
  } else {
    tagTitle(out);
  }
} catch (e) {}

$done({ body: JSON.stringify(out) });
