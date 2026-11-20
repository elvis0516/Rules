// Reddit 去广告 - script 版 v7
// v7 改认结构: 推广帖不是来自 subreddit, 其 node 没有 subreddit 对象
// (首页正常帖子一定带 subreddit)。同时保留 v4/v5/v6 全部旧判定。
// 广告每次换广告主, 按名字拦没用, 必须按结构拦。
let body = $response.body;
let obj = null;
let parsed = false;
let isV2p = ($request.url || '').indexOf('/v2p') !== -1;

// /v2p 无法解析且是滚动加载广告的来源, 直接返回空对象
if (isV2p) {
  $done({ body: '{}' });
}

function tryParse(s) {
  try { return JSON.parse(s); } catch (e) { return null; }
}

obj = tryParse(body);
if (obj !== null) parsed = true;

if (!parsed) {
  try {
    let t = body.trim().replace(/\s+/g, '');
    if (/^[A-Za-z0-9+/=_-]+$/.test(t) && t.length > 20) {
      let bin = '';
      try { bin = atob(t); } catch (e) { bin = ''; }
      if (bin) {
        let p = tryParse(bin);
        if (p !== null) { obj = p; parsed = true; }
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
  if (parts.length > 0) { obj = parts.length === 1 ? parts[0] : parts; parsed = true; }
}

if (!parsed) {
  let s = body.indexOf('{');
  let e = body.lastIndexOf('}');
  if (s >= 0 && e > s) {
    let p = tryParse(body.slice(s, e + 1));
    if (p !== null) { obj = p; parsed = true; }
  }
  if (!parsed) {
    let s2 = body.indexOf('[');
    let e2 = body.lastIndexOf(']');
    if (s2 >= 0 && e2 > s2) {
      let p = tryParse(body.slice(s2, e2 + 1));
      if (p !== null) { obj = p; parsed = true; }
    }
  }
}

if (!parsed) $done({});

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
  if (node.adPayload && typeof node.adPayload === 'object') return true;
  if (node.isPromoted === true || node.promoted === true || node.isSponsored === true) return true;
  if (node.isAd === true || node.isAdvertisement === true) return true;
  if (node.is_promoted === true || node.sponsored === true || node.is_sponsored === true) return true;
  if (hasCTA(node)) return true;
  // v7: 首页帖子一定带 subreddit; 没有 subreddit 又有作者的, 是推广帖
  if ((node.subreddit == null) && node.author != null && (node.title != null || node.id != null)) return true;
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
    if (v.isNsfw === true) v.isNsfw = false;
    if (v.isNsfwMediaBlocked === true) v.isNsfwMediaBlocked = false;
    if (v.isNsfwContentShown === false) v.isNsfwContentShown = true;
    if (Array.isArray(v.commentsPageAds)) v.commentsPageAds = [];
    if (v.node && typeof v.node === 'object') {
      let n = v.node;
      if (isAdNode(n)) return null;
      if (Array.isArray(n.cells) && n.cells.some(cellLooksLikeAd)) return null;
      if (n.isPromoted === true || n.promoted === true || n.isSponsored === true) return null;
      if (hasCTA(n)) return null;
      if ((n.subreddit == null) && n.author != null && (n.title != null || n.id != null)) return null;
    }
    if (isAdNode(v)) return null;
    for (let k of Object.keys(v)) {
      v[k] = walk(v[k]);
    }
    return v;
  }
  return v;
}

let out = walk(obj);
$done({ body: JSON.stringify(out) });
