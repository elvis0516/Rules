// Reddit 去广告 - 调试版 v5 (临时)
// v5 修复: /v2p 可能是非 JSON/二进制, 发 bodyHead 会导致 POST 失败。
// 只发元数据: URL、是否 JSON、顶层键、edges 数、body 长度, 不发 body 内容。
let HOOK = 'https://webhook.site/78d33f1c-0955-46ab-93d6-1e84bc4cc867';
let body = $response.body || '';
let url = $request.url || '';
let parsed = null;
let isJson = false;
try { parsed = JSON.parse(body); isJson = true; } catch (e) {}
let topKeys = [];
let dataKeys = [];
let edgeCount = -1;
try {
  if (parsed && typeof parsed === 'object') {
    topKeys = Object.keys(parsed);
    let d = parsed.data;
    if (d && typeof d === 'object') {
      dataKeys = Object.keys(d);
      (function findEdges(v) {
        if (Array.isArray(v)) { for (let i of v) findEdges(i); return; }
        if (v && typeof v === 'object') {
          if (Array.isArray(v.edges)) { edgeCount = v.edges.length; return; }
          for (let k of Object.keys(v)) findEdges(v[k]);
        }
      })(parsed);
    }
  }
} catch (e) {}
let report = '';
try {
  report = JSON.stringify({ url: url, isJson: isJson, topKeys: topKeys, dataKeys: dataKeys, edgeCount: edgeCount, bodyLen: body.length });
} catch (e) {
  report = JSON.stringify({ url: url, isJson: false, topKeys: [], dataKeys: [], edgeCount: -2, bodyLen: body.length });
}
try {
  $httpClient.post({ url: HOOK, headers: { 'Content-Type': 'application/json' }, body: report }, function (err, resp, data) { $done({}); });
} catch (e) {
  $done({});
}
