// Reddit 去广告 - 直通测试 (临时，未推送到正式版)
// 用途：区分“脚本改内容”与“模块改传输”。
// 此脚本对响应不做任何修改，直接原样放行；模块的 MITM、force-http-engine-hosts、
// Header Rewrite 全部保留，与正式版一致。
// 判读：装上它后版块列表恢复满帖、冷启动一次加载成功 → 问题在脚本改内容（解析/重组/过滤）；
//       仍只剩一条、冷启动仍空白 → 问题在传输层（MITM / force-http-engine-hosts / Header Rewrite），
//       与脚本内容无关。
$done({});
