// Reddit 去广告 - script 版 v11（诊断版：不删任何帖子，只做解析再原样返回）
// 目的：确认图片/视频不显示是不是脚本删帖造成的。
// 如果这版图片视频恢复了，说明是删除逻辑误伤；如果还是不行，
// 说明问题在脚本解析/回写或 MITM 本身，与删帖无关。
let body = $response.body;
let obj = null;
try { obj = JSON.parse(body); } catch (e) { $done({}); }
$done({ body: JSON.stringify(obj) });
