// Reddit 去广告 - 可视化调试 v8 (临时)
// 给每条帖子标题前加 [r:xxx] 或 [r:NONE]，用户截图后我能看到广告到底有没有 subreddit。
function subName(n) {
  if (!n || typeof n !== 'object') return 'NONE';
  let s = n.subreddit;
  if (!s) return 'NONE';
  if (typeof s === 'string') return s;
  if (typeof s === 'object') {
    return s.name || s.prefixedName || s.displayName || 'OBJ';
  }
  return 'UNK';
}
function walk(v) {
  if (Array.isArray(v)) { for (let i of v) walk(i); return; }
  if (v && typeof v === 'object') {
    if (Array.isArray(v.edges)) {
      for (let e of v.edges) {
        let n = e && e.node;
        if (n && typeof n.title === 'string' && n.title.indexOf('[r:') !== 0) {
          n.title = '[r:' + subName(n) + '] ' + n.title;
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
