// Reddit 去广告 - 调试版 v3 (临时)
// 上一版在根路径上找到 0 条 edges, 说明结构假设错了。
// 这一版直接发响应体的顶层键名与前 800 字, 看清根路径到底返回什么。
let HOOK = 'https://webhook.site/78d33f1c-0955-46ab-93d6-1e84bc4cc867';
let body = $response.body;
let isV2p = ($request.url || '').indexOf('/v2p') !== -1;
if (isV2p) { $done({}); }

let topKeys = [];
let sample = '';
let parsed = null;
try { parsed = JSON.parse(body); } catch (e) {}
if (parsed && typeof parsed === 'object') {
  topKeys = Object.keys(parsed);
  // 顺着 data 往下一层
  let d = parsed.data;
  let dataKeys = (d && typeof d === 'object') ? Object.keys(d) : [];
  sample = JSON.stringify({ topKeys: topKeys, dataKeys: dataKeys, bodyHead: body.slice(0, 800) });
} else {
  sample = JSON.stringify({ topKeys: [], dataKeys: [], bodyHead: body.slice(0, 800), parseFailed: true });
}

$httpClient.post({ url: HOOK, headers: { 'Content-Type': 'application/json' }, body: sample }, function (err, resp, data) {
  $done({});
});
