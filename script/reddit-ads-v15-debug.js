// Reddit 去广告 - 调试 v15 (临时，未推送)
// 用途：若回滚 v13 后版块列表恢复满帖，说明 v14 的删除逻辑有问题，
// 用此版定位到底删了什么。只在标题前缀写计数，不改任何过滤逻辑（与正式 v14 完全一致）。
// 标记格式：[DBG15 fmt e:A->B p:C->D ap:E->F cpa:G->H]
//   fmt=解析方式(json/b64/sse/slice/none)
//   e=所有 edges 数组的元素总数（过滤前->过滤后）
//   p=__typename 为 Post 的对象数（过滤前->过滤后）
//   ap=__typename 为 AdPost 的对象数（过滤前->过滤后）
//   cpa=commentsPageAds 总条数（过滤前->过滤后）
// 判读：e 掉得多、p 也跟着掉 = 脚本误删了正常帖；
//       e/p 几乎不动、ap 归零 = 脚本只删了广告，列表只剩一条与脚本无关。
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

// 过滤前后计数：edges 总数 / Post 数 / AdPost 数 / commentsPageAds 总数
function countMetrics(root) {
  let m = { edges: 0, posts: 0, adPost: 0, cpa: 0 };
  (function rec(v) {
    if (Array.isArray(v)) { for (let x of v) rec(x); return; }
    if (v && typeof v === 'object') {
      if (v.__typename === 'Post') m.posts++;
      if (v.__typename === 'AdPost') m.adPost++;
      if (Array.isArray(v.commentsPageAds)) m.cpa += v.commentsPageAds.length;
      for (let k of Object.keys(v)) {
        if (k === 'edges' && Array.isArray(v[k])) m.edges += v[k].length;
        rec(v[k]);
      }
    }
  })(root);
  return m;
}

let before = { edges: 0, posts: 0, adPost: 0, cpa: 0 };
try { before = countMetrics(obj); } catch (e) {}

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

// 与正式 v14 完全相同的过滤逻辑
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
    if (v.__typename === 'AdPost') return null;
    if (v.isNsfw === true) v.isNsfw = false;
    if (v.isNsfwMediaBlocked === true) v.isNsfwMediaBlocked = false;
    if (v.isNsfwContentShown === false) v.isNsfwContentShown = true;
    if (Array.isArray(v.commentsPageAds)) v.commentsPageAds = [];
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

let after = { edges: 0, posts: 0, adPost: 0, cpa: 0 };
try { after = countMetrics(out); } catch (e) {}

// 诊断标记：写进第一个帖子标题前缀
let prefix = '[DBG15 ' + fmt + ' e:' + before.edges + '->' + after.edges
  + ' p:' + before.posts + '->' + after.posts
  + ' ap:' + before.adPost + '->' + after.adPost
  + ' cpa:' + before.cpa + '->' + after.cpa + '] ';
let tagged = false;
function tagTitle(v) {
  if (tagged) return;
  if (Array.isArray(v)) { for (let x of v) { tagTitle(x); if (tagged) return; } return; }
  if (v && typeof v === 'object') {
    if (typeof v.title === 'string' && v.title && v.title.indexOf('[DBG15') !== 0) {
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
