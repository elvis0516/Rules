# Rules

个人代理规则整理：从旧仓库（QuantumultX、Loon）迁移、分类后的规则集合。

## 目录

- `config/`：现行配置脱敏版（2026-11-05 同步，只保留最后一版）
  - `QX`：2026-11-04 19:40 现行版 + 11-05 两处改动（彩云改走 Rules CYTQVIP、filter_local 加 gather 拦截）；[mitm] passphrase / p12 已脱敏；节点定义在本地 server_remote snippet 文件里，未同步
  - `Uee`：Loon 现行版（2026-10-26 建，含 10-27 微信/有道修正）；节点 IP/端口/密码/UUID/指纹/SNI 已脱敏；Mitm 证书留空
  - `Surge`：2026-11-04 现行版（13 组）；[Proxy] 节点 IP/端口/密码/UUID/指纹/SNI 已脱敏；[MITM] ca-passphrase / ca-p12 已脱敏
- `rewrite/`：重写规则，按 App 类型分类
  - `adblock/`：ADchongxie（fmz200 奶思去广告重写合集，2025-03-21 版）
  - `video/`：MGTV（芒果 TV）、YoutubeBlockAD
  - `music/`：NetEmusic（网易云）、SpotifyPremium、SpotifyVip、SpotifyLRC（百度翻译密钥已替换为占位）
  - `tools/`：CamScanner（扫描全能王）、WPSVIP、WXGZH（微信公众号）、keep
  - `weather/`：CYTQSVIP、CYTQVIP（彩云天气）
  - `news/`：JXVIP（简讯）
  - `tv/`：APTVunlock、AptvVIP
  - `podcast/`：XMLYJSVIP（喜马拉雅极速版）
- `filter/`：分流规则
  - `rejectAd-dedup.list`：fmz200 rejectAd 去重表（QX 格式，见下）

## 去重表 rejectAd-dedup.list

- 来源：fmz200/wool_scripts `Loon/rule/rejectAd.list`（2748 条），减去 blackmatrix7/ios_rule_script QX `Advertising.list` 与 `Hijacking.list` 已覆盖的部分。
- 覆盖判定：精确命中 + 后缀包含（黑矩阵已有某后缀则其下子域名不再收）+ IP 网段包含；关键词仅精确命中才算覆盖（保守口径）。
- 结果：保留 287 条，去掉 2461 条（2026-11-04 生成）。
- 另有 2 条（1 条 USER-AGENT、1 条 AND）无法写进 QX 分流格式，已排除在外。
- QX 订阅（filter_remote）：
  `https://raw.githubusercontent.com/elvis0516/Rules/main/filter/rejectAd-dedup.list, tag=奶思去广告去重, force-policy=🛑 广告拦截, update-interval=172800, enabled=true`
  已是 QX 格式，无需 opt-parser。

## 说明

- `config/` 现为现行配置脱敏版（2026-11-05 同步）；`rewrite/` 与 `filter/` 仍为 2025 年旧存档的整理迁移；2026-11-04 已刷新 MGTV、NetEmusic、XMLYJSVIP、keep、SpotifyVip、YoutubeBlockAD 至上游最新版；2026-11-07 刷新 APTVunlock、CamScanner、WXGZH 至上游最新版（作者原文件，含 [rewrite_local]/[mitm]，规则与旧 snippet 一致）；WPSVIP 上游为裸脚本、无重写段，仍保留本地 snippet；AptvVIP 仅末尾空行差异、未动；其余文件仍为 2025 年旧存档；SpotifyPremium、YoutubeBlockAD 的 Maasea JS、CYTQVIP 的 wf 线走上游 master 实时引用，无需抄。2026-11-05 彩云天气死链替换：CYTQSVIP 的 WeiRen0 cytq.js 地址改用 wf021325 caiyun.js，CYTQVIP 的 chxm 两行改用 wf 规则组（去重后 14 行）。2026-11-05 config/QX、config/Uee、config/Surge 已更新为现行配置脱敏版（替换 2025 年旧存档；旧版原文仍在旧仓库 QuantumultX、Loon 及本地克隆里）。
- 迁移时已处理两处明文凭据（Uee 的 ca-passphrase 行删除、SpotifyLRC 的密钥替换为占位），其余文件原文照搬。2026-11-05 同步现行配置时另做脱敏：QX 的 [mitm] passphrase/p12、Loon 的节点信息、Surge 的 [Proxy] 节点信息与 [MITM] 证书均已替换为占位。
