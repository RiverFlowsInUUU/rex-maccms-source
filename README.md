# rex-maccms-source

Rex（聚合媒体播放器）用的**苹果CMS（MacCMS v10）采集模块**。填入任意苹果CMS采集接口，即可在 Rex 里浏览/搜索/按集解析出 m3u8 播放线路。

## 文件

| 文件 | 类型 | 用途 |
| --- | --- | --- |
| `rex-maccms-source.js` | 完整版（列表+片源） | 在「首页配置」里加「最新更新」行浏览；也可搜索、播放 |
| `rex-maccms-stream.js` | 纯片源（线路） | 只给 App 自带剧集/电影配源、或搜索后播放，不进入浏览列表 |

**想在资源库/首页里浏览 → 用 `rex-maccms-source.js`（完整版）。**

## 用法（必须用「网址」导入，不要用本地文件导入）

> 本地文件导入的模块没有公网脚本来源，播放会报「当前条目缺少脚本来源信息」。

在 Rex「模块」页「输入模块源地址」粘贴下面的地址：

- 完整版（推荐）Raw：`https://raw.githubusercontent.com/RiverFlowsInUUU/rex-maccms-source/main/rex-maccms-source.js`
- 完整版 jsDelivr（国内快）：`https://cdn.jsdelivr.net/gh/RiverFlowsInUUU/rex-maccms-source@main/rex-maccms-source.js`
- 纯片源版 jsDelivr：`https://cdn.jsdelivr.net/gh/RiverFlowsInUUU/rex-maccms-source@main/rex-maccms-stream.js`

也可在 Safari 打开 `rex://widget?url=<上面的地址>` 一键添加。

导入完整版后：Rex 首页/发现页 → 首页配置（＋添加模块）→ 选「苹果CMS采集源」→ 加「最新更新」行 → 选海报/列表模板即可浏览。

## 采集接口（会失效，可自行在模块设置里更换）

```
量子  http://cj.lziapi.com/api.php/provide/vod/from/lzm3u8
红牛  http://hongniuzy2.com/api.php/provide/vod/from/hnm3u8
闪电  http://sdzyapi.com/api.php/provide/vod/from/sdm3u8
快车  http://caiji.kczyapi.com/api.php/provide/vod/from/kcm3u8
森林  http://slapibf.com/api.php/provide/vod
39影视 http://39kan.com/api.php/provide/vod
天堂  http://vipmv.cc/api.php/provide/vod
影库  http://api.ykapi.net/api.php/provide/vod
```

> 采集站多在境外，国内浏览空白/黑屏多为接口直连不畅，先挂代理或换接口。

仅供个人学习与自用，片源来自第三方采集站，与本源无关。
