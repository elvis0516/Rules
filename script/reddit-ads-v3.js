// Reddit 去广告 - script 版
// 处理 gql 响应 (JSON 与 text/plain 均按 JSON 解析), 移除推广内容
// 覆盖根路径与 /v2p 等全部路径
let body = $response.body;
let obj;
try {
  obj = JSON.parse(body);
} catch (e) {
  $done({});
}

function isAdNode(node) {
  if (!node || typeof node !== 'object') return false;
  if (node.__typename === 'AdPost') return true;
  if (node.adPayload && typeof node.adPayload === 'object') return true;
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
      if (Array.isArray(n.cells) && n.cells.some(function (c) { return c && (c.__typename === 'AdMetadataCell' || c.isAdPost === true); })) return null;
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
