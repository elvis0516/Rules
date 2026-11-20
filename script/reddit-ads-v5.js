// Reddit 去广告 - script 版 v5
// 处理 gql 响应 (JSON / Base64 内嵌 JSON / NDJSON / 内嵌 JSON), 移除推广内容
// 覆盖 gql / gql-fed / cf.gql-fed 全部 host 与根路径、/v2p 等全部路径
// v5 新增: 推广帖 (Syfe/IBKR 这类 u/ 广告主账号的推广帖) 可能不带 adPayload,
// 改为同时认: isPromoted/promoted/isSponsored 字段, 以及含广告 CTA 的 cell
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

function isAdNode(node) {
  if (!node || typeof node !== 'object') return false;
  if (node.__typename === 'AdPost') return true;
  if (node.adPayload && typeof node.adPayload === 'object') return true;
  if (node.isPromoted === true || node.promoted === true || node.isSponsored === true) return true;
  if (node.isAd === true || node.isAdvertisement === true) return true;
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
      // 推广帖: node 本身带 promoted 标记
      if (n.isPromoted === true || n.promoted === true || n.isSponsored === true) return null;
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
