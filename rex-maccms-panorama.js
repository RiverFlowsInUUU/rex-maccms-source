/**
 * 全景影视源(多站) —— Rex 模块 v2.0
 *
 * ★ 关键修正（对照真实能播模块 Jable/Javday 的结构）：
 *   - 只声明「列表」模块，不声明 loadResource / stream
 *   - 列表条目【不带 videoUrl】，只带 link（条目身份）
 *   - 顶层 loadDetail(link) 去采集接口取详情，直接返回 videoUrl(+分集)
 *   之前加了 loadResource(stream) 会触发 Rex 的“脚本解析”路径并报
 *   “当前条目缺少脚本来源信息，无法解析播放地址”。
 *
 * 用法：导入后，用本模块自己的「最新更新」列表 或 搜索 来浏览/播放。
 *       (Rex 官方 TMDB 首页只给元数据，不能挂第三方源)
 */

var WidgetMetadata = {
  id: "yg.maccms.panorama",
  title: "全景影视源(多站)",
  description: "多采集站整合：自带列表 + 搜索 + 直出播放地址",
  author: "YG",
  site: "",
  version: "2.0.0",
  requiredVersion: "0.0.1",
  globalParams: [],
  modules: [
    {
      id: "loadList",
      title: "最新更新(多站)",
      functionName: "loadList",
      params: [
        { name: "page", title: "页码", type: "page" },
        { name: "count", title: "数量", type: "count", value: "24" }
      ]
    }
  ],
  search: {
    title: "搜索(多站)",
    functionName: "search",
    params: [{ name: "keyword", title: "关键词", type: "input" }]
  }
};

// ======== 采集站清单（可自行增删；api=苹果CMS采集接口根）========
var SITES = [
  { name: "量子", api: "http://cj.lziapi.com/api.php/provide/vod/from/lzm3u8" },
  { name: "森林", api: "http://slapibf.com/api.php/provide/vod" },
  { name: "红牛", api: "http://hongniuzy2.com/api.php/provide/vod/from/hnm3u8" },
  { name: "闪电", api: "http://sdzyapi.com/api.php/provide/vod/from/sdm3u8" },
  { name: "快车", api: "http://caiji.kczyapi.com/api.php/provide/vod/from/kcm3u8" },
  { name: "39影视", api: "http://39kan.com/api.php/provide/vod" },
  { name: "天堂", api: "http://vipmv.cc/api.php/provide/vod" },
  { name: "影库", api: "http://api.ykapi.net/api.php/provide/vod" },
  { name: "酷点", api: "http://api.kuapi.cc/api.php/provide/vod" }
];

var UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
var REQ_TIMEOUT = 8000;

function buildUrl(base, query) {
  var qs = [];
  for (var k in query) {
    if (query.hasOwnProperty(k) && query[k] !== undefined && query[k] !== null && query[k] !== "") qs.push(encodeURIComponent(k) + "=" + encodeURIComponent(query[k]));
  }
  var q = qs.join("&");
  if (!q) return base;
  return base + (base.indexOf("?") >= 0 ? "&" : "?") + q;
}
async function fetchData(url) {
  var resp = await Widget.http.get(url, { headers: { "User-Agent": UA, "Accept": "*/*" }, allow_redirects: true, timeout: REQ_TIMEOUT });
  return resp && resp.data != null ? resp.data : "";
}
function stripTags(s) { return String(s == null ? "" : s).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(); }
function cdata(s) { return String(s == null ? "" : s).replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "").trim(); }
function tag(block, name) { var m = block.match(new RegExp("<" + name + ">([\\s\\S]*?)<\\/" + name + ">")); return m ? cdata(m[1]) : ""; }

function parsePlayUrl(playUrl, playFrom) {
  var out = [];
  var lines = String(playUrl || "").split("$$$");
  var froms = String(playFrom || "").split("$$$");
  for (var li = 0; li < lines.length; li++) {
    var segs = lines[li].split("#");
    for (var i = 0; i < segs.length; i++) {
      var seg = segs[i];
      if (!seg) continue;
      var p = seg.split("$");
      var name = p.length >= 2 ? p[0] : ("第" + (i + 1) + "集");
      var url = p.length >= 2 ? p[1] : p[0];
      url = String(url || "").trim();
      if (!/^https?:\/\//i.test(url)) continue;
      out.push({ name: stripTags(name), url: url });
    }
  }
  return out;
}

function normalizeList(data) {
  var items = [];
  var obj = null, xml = "";
  if (data && typeof data === "object") { obj = data; }
  else {
    var t = String(data == null ? "" : data).trim();
    if (!t) return items;
    if (t.charAt(0) === "{" || t.charAt(0) === "[") { try { obj = JSON.parse(t); } catch (e) { obj = null; } }
    if (!obj) xml = t;
  }
  if (obj) {
    var arr = obj.list || (Array.isArray(obj) ? obj : []);
    for (var i = 0; i < arr.length; i++) {
      var v = arr[i];
      items.push({
        id: String(v.vod_id || v.id || ""),
        name: cdata(v.vod_name || v.name || ""),
        pic: String(v.vod_pic || v.pic || ""),
        content: stripTags(v.vod_content || v.des || ""),
        typeName: String(v.type_name || v.type || ""),
        playFrom: String(v.vod_play_from || ""),
        playUrl: String(v.vod_play_url || "")
      });
    }
    return items;
  }
  var re = /<video>([\s\S]*?)<\/video>/g;
  var m;
  while ((m = re.exec(xml)) !== null) {
    var b = m[1];
    var dl = b.match(/<dd[^>]*>([\s\S]*?)<\/dd>/);
    var flagM = b.match(/<dd[^>]*flag="([^"]*)"/);
    items.push({
      id: tag(b, "id"), name: tag(b, "name"), pic: tag(b, "pic"),
      content: tag(b, "des"), typeName: tag(b, "type"),
      playFrom: flagM ? flagM[1] : "", playUrl: dl ? cdata(dl[1]) : ""
    });
  }
  return items;
}

function isTv(item) {
  var ty = item.typeName || "";
  if (/剧|动漫|综艺|纪录|动画/.test(ty)) return true;
  return parsePlayUrl(item.playUrl, item.playFrom).length > 1;
}

async function searchSite(site, kw) {
  return normalizeList(await fetchData(buildUrl(site.api, { ac: "videolist", wd: kw })));
}
async function listSite(site, page) {
  return normalizeList(await fetchData(buildUrl(site.api, { ac: "videolist", pg: page })));
}
async function detailSite(site, id) {
  var list = normalizeList(await fetchData(buildUrl(site.api, { ac: "detail", ids: id })));
  return list.length ? list[0] : null;
}

// 列表条目：不带 videoUrl，只带身份 link（type:"url" 才会触发 loadDetail）
function toListItem(item, idx, siteName) {
  var tv = isTv(item);
  var key = idx + "|" + String(item.id || "");
  return {
    id: key,
    type: "url",
    title: siteName ? ("[" + siteName + "] " + item.name) : item.name,
    description: item.content,
    coverUrl: item.pic,
    posterPath: item.pic,
    mediaType: tv ? "tv" : "movie",
    link: key
  };
}

// 「最新更新(多站)」
async function loadList(params) {
  params = params || {};
  var page = Number(params.page || 1);
  var perSite = Number(params.count || 24);
  var groups = await Promise.all(SITES.map(function (site, idx) {
    return listSite(site, page).then(function (list) { return { idx: idx, list: list.slice(0, perSite) }; }).catch(function () { return { idx: idx, list: [] }; });
  }));
  var out = [], seen = {};
  for (var g = 0; g < groups.length; g++) {
    var grp = groups[g];
    for (var i = 0; i < grp.list.length; i++) {
      var it = grp.list[i];
      var key = String(it.name || "").replace(/\s+/g, "");
      if (!key || seen[key]) continue;
      if (!parsePlayUrl(it.playUrl, it.playFrom).length) continue;
      seen[key] = 1;
      out.push(toListItem(it, grp.idx, null));
    }
  }
  return out;
}

// 搜索(多站)，标站名
async function search(params) {
  params = params || {};
  var kw = params.keyword || params.wd || params.query || "";
  if (!kw) return [];
  var groups = await Promise.all(SITES.map(function (site, idx) {
    return searchSite(site, kw).then(function (list) { return { idx: idx, site: site, list: list.slice(0, 10) }; }).catch(function () { return { idx: idx, site: site, list: [] }; });
  }));
  var out = [];
  for (var g = 0; g < groups.length; g++) {
    var grp = groups[g];
    for (var i = 0; i < grp.list.length; i++) {
      var it = grp.list[i];
      if (!parsePlayUrl(it.playUrl, it.playFrom).length) continue;
      out.push(toListItem(it, grp.idx, grp.site.name));
    }
  }
  return out;
}

// ★ 顶层详情：返回 videoUrl(+分集) —— 不经过 stream 模块
async function loadDetail(link) {
  var s = String(link || "");
  var p = s.split("|");
  if (p.length < 2) return null;
  var idx = Number(p[0]);
  var id = p[1];
  var site = SITES[idx];
  if (!site || !id) return null;
  var it = await detailSite(site, id);
  if (!it) return null;
  var eps = parsePlayUrl(it.playUrl, it.playFrom);
  var tv = isTv(it);
  var vi = {
    id: s,
    type: "url",
    title: it.name,
    description: it.content,
    coverUrl: it.pic,
    posterPath: it.pic,
    mediaType: tv ? "tv" : "movie"
  };
  if (eps.length) vi.videoUrl = eps[0].url;
  if (tv && eps.length > 1) {
    vi.episodeItems = eps.map(function (e, i) {
      return { id: e.url, type: "url", title: e.name || ("第" + (i + 1) + "集"), episode: i + 1, videoUrl: e.url, mediaType: "tv" };
    });
  }
  return vi;
}
