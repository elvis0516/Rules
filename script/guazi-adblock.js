// 瓜子影视（茶器志套壳）去广告：拦截全部广告接口，返回空数据
// 目标：api.sef5w7.com 下的广告接口
//   /App/ad/config         广告总配置
//   /App/Ad/skitAdInfo    开屏广告
//   /App/Ad/bannerInfo    横幅广告
//   /App/Ad/barsIndexAdInfo  底部栏广告
//   /App/Ad/vajraInfo     金刚区（首页广告九宫格）
//   /App/Ad/activityInfo  活动广告
//   /App/Ad/noticeInfo    通知广告
//   /App/IndexList/homeFloatAd  首页悬浮广告
// 原理：广告内容由各接口分别返回，ad/config 只是总开关；全部返回空 data，让 App 认为无广告可展示
const url = $request.url;
if (/\/App\/(Ad\/|ad\/config|IndexList\/homeFloatAd)/.test(url)) {
  $done({response: {status: 200, headers: {'Content-Type': 'application/json; charset=utf-8'}, body: JSON.stringify({code: 200, msg: '请求成功', data: {}})}});
} else {
  $done({});
}
