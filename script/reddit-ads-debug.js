// Reddit 去广告 - 调试版 (临时)
// 只发结构(字段名), 不发标题/正文, 用于定位推广帖的真实标记字段。
// 收到数据后即删除, 调试完换回正式版。
let HOOK = 'https://webhook.site/869bd56c-d90a-4b0e-916f-9e36382aeca6';
let body = $response.body;
let isV2p = ($request.url || '').indexOf('/v2p') !== -1;
if (isV2p) { $done({}); }

let obj = null;
try { obj = JSON.parse(body); } catch (e) {}
if (!obj) $done({});

let edges = [];
function findEdges(v) {
  if (Array.isArray(v)) { for (let i of v) findEdges(i); return; }
  if (v && typeof v === 'object') {
    if (Array.isArray(v.edges)) { edges = v.edges; return; }
    for (let k of Object.keys(v)) findEdges(v[k]);
  }
}
findEdges(obj);

let report = [];
for (let e of edges.slice(0, 12)) {
  let n = e && e.node ? e.node : null;
  if (!n || typeof n !== 'object') continue;
  let keys = Object.keys(n);
  let author = '';
  try { author = (n.author && n.author.name) || (n.author && n.author.displayName) || ''; } catch (ex) {}
  let sub = '';
  try { sub = n.subreddit ? (n.subreddit.name || 'has-subreddit') : 'NULL'; } catch (ex) { sub = 'ERR'; }
  report.push({
    typename: n.__typename || '',
    author: author,
    subreddit: sub,
    keys: keys,
    hasAdPayload: !!n.adPayload,
    hasCTA: (n.callToAction != null) || (n.cta != null),
    hasPromoted: (n.isPromoted === true) || (n.promoted === true),
    hasCells: Array.isArray(n.cells) ? n.cells.length : -1
  });
}

$httpClient.post({ url: HOOK, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: $request.url, count: edges.length, nodes: report }) }, function (err, resp, data) {
  $done({});
});
