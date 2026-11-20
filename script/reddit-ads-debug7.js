// Reddit 去广告 - 可视化调试 v7 (临时)
// 不删帖, 只在疑似广告的标题前加 [AD?] 标记, 用户截图我就能看到脚本认不认得出广告。
// 判定：无 subreddit 且有 author, 或带任一广告标记字段。
function isAdNode(n) {
  if (!n || typeof n !== 'object') return false;
  if (n.adPayload) return true;
  if (n.isAdPost === true) return true;
  if (n.isPromoted === true || n.promoted === true) return true;
  if (n.isSponsored === true || n.isAd === true) return true;
  if (Array.isArray(n.cells)) {
    for (let c of n.cells) { if (c && c.__typename === 'AdMetadataCell') return true; }
  }
  if (!n.subreddit && n.author) return true;
  return false;
}
function walk(v) {
  if (Array.isArray(v)) { for (let i of v) walk(i); return; }
  if (v && typeof v === 'object') {
    if (Array.isArray(v.edges)) {
      for (let e of v.edges) {
        let n = e && e.node;
        if (n && isAdNode(n)) {
          if (typeof n.title === 'string' && n.title.indexOf('[AD?]') !== 0) {
            n.title = '[AD?] ' + n.title;
          }
        }
      }
      return;
    }
    for (let k of Object.keys(v)) walk(v[k]);
  }
}
let body = $response.body;
let parsed = null;
try { parsed = JSON.parse(body); } catch (e) {}
if (parsed) {
  try { walk(parsed); } catch (e) {}
  $done({ body: JSON.stringify(parsed) });
} else {
  $done({});
}
