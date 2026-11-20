// Reddit 去广告 - 调试版 v6 (临时)
// v6 修复：只处理根路径（feed），不碰 /v2p；只发边（edges）的字段名和作者/subreddit，不发 body；POST 体积极小，不拖响应。
let HOOK = 'https://webhook.site/78d33f1c-0955-46ab-93d6-1e84bc4cc867';
let url = $request.url || '';
// 只处理根路径
if (url === 'https://gql-fed.reddit.com/' || url === 'https://cf.gql-fed.reddit.com/' || url === 'https://gql-fed.reddit.com' || url === 'https://cf.gql-fed.reddit.com') {
  let body = $response.body || '';
  let parsed = null;
  try { parsed = JSON.parse(body); } catch (e) {}
  let edgesOut = [];
  try {
    (function walk(v) {
      if (Array.isArray(v)) { for (let i of v) walk(i); return; }
      if (v && typeof v === 'object') {
        if (Array.isArray(v.edges)) {
          for (let e of v.edges.slice(0, 8)) {
            let n = (e && e.node) || {};
            let keys = [];
            try { keys = Object.keys(n); } catch (e2) {}
            let sub = null;
            try { sub = n.subreddit ? (n.subreddit.name || n.subreddit.prefixedName || true) : null; } catch (e3) {}
            let author = null;
            try { author = n.author ? (n.author.name || n.author) : null; } catch (e4) {}
            let adFlags = {};
            try {
              adFlags = {
                adPayload: n.adPayload ? 1 : 0,
                isAdPost: n.isAdPost ? 1 : 0,
                isPromoted: n.isPromoted ? 1 : 0,
                promoted: n.promoted ? 1 : 0,
                isSponsored: n.isSponsored ? 1 : 0,
                isAd: n.isAd ? 1 : 0,
                hasAdMetadataCell: 0
              };
              if (Array.isArray(n.cells)) {
                for (let c of n.cells) { if (c && c.__typename === 'AdMetadataCell') { adFlags.hasAdMetadataCell = 1; break; } }
              }
            } catch (e5) {}
            edgesOut.push({ keys: keys, sub: sub, author: author, adFlags: adFlags });
          }
          return;
        }
        for (let k of Object.keys(v)) walk(v[k]);
      }
    })(parsed);
  } catch (e) {}
  if (edgesOut.length > 0) {
    let report = '';
    try { report = JSON.stringify({ url: url, edges: edgesOut }); } catch (e) { report = JSON.stringify({ url: url, edges: [] }); }
    try {
      $httpClient.post({ url: HOOK, headers: { 'Content-Type': 'application/json' }, body: report }, function (err, resp, data) { $done({}); });
    } catch (e) { $done({}); }
  } else {
    $done({});
  }
} else {
  $done({});
}
