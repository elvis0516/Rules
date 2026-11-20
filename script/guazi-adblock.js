// 瓜子影视（茶器志套壳）去广告：拦截广告配置接口，返回空数据
// 目标：api.sef5w7.com/App/ad/config
// 原理：该接口返回加密广告配置，无法改写；直接返回空 data，让 App 认为无广告可展示
const url = $request.url;
if (url.indexOf('/App/ad/config') !== -1) {
  $done({response: {status: 200, headers: {'Content-Type': 'application/json; charset=utf-8'}, body: JSON.stringify({code: 200, msg: '请求成功', data: {}})}});
} else {
  $done({});
}
