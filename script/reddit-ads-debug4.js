// Reddit 去广告 - 调试版 v4 (临时)
// v4 不再跳过 /v2p: feed 很可能走 /v2p, 之前跳过所以只抓到 experimentVariants。
// 对每个响应发 URL、是否 JSON、顶层键名、data 下一层键名、body 前 500 字。
let HOOK = 'https://webhook.site/78d33f1c-0955-46ab-93d6-1e84bc4cc867';
let body = $response.body;
let url = $request.url || '';
let parsed = null;
let isJson = false;
try { parsed = JSON.parse(body); isJson = true; } catch (e) {}
let topKeys = [];
let dataKeys = [];
let edgeCount = -1;
if (parsed && typeof parsed === 'object') {
  topKeys = Object.keys(parsed);
  let d = parsed.data;
  if (d && typeof d === 'object') {
    dataKeys = Object.keys(d);
    // 找 edges 数量
    (function findEdges(v) {
      if (Array.isArray(v)) { for (let i of v) findEdges(i); return; }
      if (v && typeof v === 'object') {
        if (Array.isArray(v.edges)) { edgeCount = v.edges.length; return; }
        for (let k of Object.keys(v)) findEdges(v[k]);
      }
    })(parsed);
  }
}
let report = JSON.stringify({
  url: url,
  isJson: isJson,
  topKeys: topKeys,
  dataKeys: dataKeys,
  edgeCount: edgeCount,
  bodyHead: body.slice(0, 500)
});
$httpClient.post({ url: HOOK, headers: { 'Content-Type': 'application/json' }, body: report }, function (err, resp, data) {
  $done({});
});
