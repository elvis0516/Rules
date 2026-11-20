// Bing 信息流去广告：去掉 Microsoft Start 信息流里的原生广告卡片
// 目标接口：
//   assets.msn.com/service/news/feed/pages/startmhp（首屏）
//   api.msn.com/news/feed/pages/startmhp（翻页，nextPageUrl）
// 广告特征：卡片 {"type":"nativead","isLocalContent":false}，可能出现在 sections[].cards[] 或 infopane 的 subCards[] 里
// 做法：递归遍历，删掉所有 type 为 nativead 的卡片；新闻 article/slideshow/TopicFeed 原样保留
// 安全：解析失败时原样返回，不破坏信息流
function stripAds(node) {
  if (Array.isArray(node)) {
    var out = [];
    for (var i = 0; i < node.length; i++) {
      var item = node[i];
      if (item && typeof item === 'object' && item.type === 'nativead') continue;
      out.push(stripAds(item));
    }
    return out;
  }
  if (node && typeof node === 'object') {
    var keys = Object.keys(node);
    for (var j = 0; j < keys.length; j++) {
      node[keys[j]] = stripAds(node[keys[j]]);
    }
  }
  return node;
}
try {
  var body = $response.body;
  var obj = JSON.parse(body);
  if (obj && Array.isArray(obj.sections)) {
    obj = stripAds(obj);
    $done({ body: JSON.stringify(obj) });
  } else {
    $done({});
  }
} catch (e) {
  $done({});
}
