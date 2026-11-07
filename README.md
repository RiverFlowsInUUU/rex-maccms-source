# rex-maccms-source

Rex（聚合媒体播放器）用的**苹果CMS（MacCMS v10）采集片源模块**。填入任意苹果CMS采集接口，即可在 Rex 里搜索、按剧名/集数解析出 m3u8 播放线路。

## 文件

- `rex-maccms-stream.js` —— 纯片源（线路）模块，v2.0

## 用法（必须用「网址」导入，不要用本地文件导入）

> 本地文件导入的模块没有公网脚本来源，播放时会报「当前条目缺少脚本来源信息」。

1. 复制本仓库里 `rex-maccms-stream.js` 的 Raw 地址，或在 Rex 模块页「输入模块源地址」粘贴：
   - raw：`https://raw.githubusercontent.com/RiverFlowsInUUU/rex-maccms-source/main/rex-maccms-stream.js`
   - 国内加速（jsDelivr）：`https://cdn.jsdelivr.net/gh/RiverFlowsInUUU/rex-maccms-source@main/rex-maccms-stream.js`
2. 也可在 Safari 打开 `rex://widget?url=<上面的地址>` 一键跳转添加。
3. 模块设置里确认「采集接口地址」（默认量子源）。

## 使用

- 在 App 自带（TMDB）的剧集/电影详情页点播放 → 在「资源 / 线路」里选「苹果CMS采集源」；
- 或在 Rex 搜索里选本模块，搜片名后进详情选线路。

## 采集接口（会失效，可自行更换）

```
量子  http://cj.lziapi.com/api.php/provide/vod/from/lzm3u8
红牛  http://hongniuzy2.com/api.php/provide/vod/from/hnm3u8
闪电  http://sdzyapi.com/api.php/provide/vod/from/sdm3u8
快车  http://caiji.kczyapi.com/api.php/provide/vod/from/kcm3u8
森林  http://slapibf.com/api.php/provide/vod
39影视 http://39kan.com/api.php/provide/vod
天堂  http://vipmv.cc/api.php/provide/vod
影库  http://api.ykapi.net/api.php/provide/vod
酷点  http://api.kuapi.cc/api/provide/vod
```

仅供个人学习与自用，片源来自第三方采集站，与本源无关。
