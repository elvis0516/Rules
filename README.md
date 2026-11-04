# Rules

个人代理规则整理：从旧仓库（QuantumultX、Loon）迁移、分类后的规则集合。

## 目录

- `config/`：旧配置原文存档（2025 年快照，不是现行运行配置）
  - `QX`：2025-04 老版 QuantumultX 配置
  - `Uee`：2025-11 Loon V2.1 配置（Mitm 的 ca-passphrase 行已删除）
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

- 本仓库内容为 2025 年旧存档的整理迁移，不等于现行运行配置；各文件上游新版核对见后续刷新清单。
- 迁移时已处理两处明文凭据（Uee 的 ca-passphrase 行删除、SpotifyLRC 的密钥替换为占位），其余文件原文照搬。
