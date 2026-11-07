/**
 * 通用苹果CMS(MacCMS v10)采集 —— Rex 完整版(列表浏览 + 片源播放) v2.1
 *
 * 包含：
 *   - 最新更新(catalog 列表)：可在「首页配置」里加一行浏览
 *   - 搜索
 *   - 详情/分集 + 线路解析(stream loadResource)
 *
 * ★ 必须用「网址」导入（本地文件导入没有脚本来源，播放会报“缺少脚本来源信息”）。
 * ★ 采集站接口在国内可能直连不畅，浏览空白/黑屏时先挂代理或换接口。
 *
 * 采集接口（模块设置可改）：http://cj.lziapi.com/api.php/provide/vod/from/lzm3u8/
 */

var WidgetMetadata = {
  id: "yg.maccms.full",
  title: "苹果CMS采集源",
  description: "苹果CMS采集：最新更新浏览 + 搜索 + 线路播放(m3u8)",
  author: "YG",
  site: "",
  version: "2.1.0",
  requiredVersion: "0.0.1",
  globalParams: [
    { name: "api", title: "采集接口地址", type: "input", value: "http://cj.lziapi.com/api.php/provide/vod/from/lzm3u8/" }
  ],
  modules: [
    { id: "loadResource", title: "加载资源", functionName: "loadResource", type: "stream", params: [] },
    {
      id: "loadList",
      title: "最新更新",
      functionName: "loadList",
      params: [
        { name: "page", title: "页码", type: "page" },
        { name: "count", title: "数量", type: "count", value: "24" }
      ]
    }
  ],
  search: {
    title: "搜索",
    functionName: "search",
    params: [{ name: "keyword", title: "关键词", type: "input" }]
  }
};

var DEFAULT_API = "http://cj.lziapi.com/api.php/provide/vod/from/lzm3u8/";
var UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
var CUR_BASE = DEFAULT_API;

function rememberBase(base) {
  CUR_BASE = base || DEFAULT_API;
  try { if (Widget.storage && typeof Widget.storage.set === "function") Widget.storage.set("yg_base", CUR_BASE); } catch (e) {}
}
function getStoredBase() {
  var b = CUR_BASE || DEFAULT_API;
  try { if (Widget.storage && typeof Widget.storage.get === "function") { var s = Widget.storage.get("yg_base"); if (typeof s === "string" && s) b = s; } } catch (e) {}
  return b || DEFAULT_API;
}
function getApi(params) {
  var api = "";
  if (params) api = params.api || params["采集接口"] || params["采集接口地址"] || "";
  if (api) { api = String(api).trim(); rememberBase(api); return api; }
  return getStoredBase();
}
function buildUrl(base, query) {
  var qs = [];
  for (var k in query) {
    if (query.hasOwnProperty(k) && query[k] !== undefined && query[k] !== null && query[k] !== "") qs.push(encodeURIComponent(k) + "=" + encodeURIComponent(query[k]));
  }
  var q = qs.join("&");
  if (!q) return base;
  return base + (base.indexOf("?") >= 0 ? "&" : "?") + q;
}
async function fetchText(url) {
  var resp = await Widget.http.get(url, { headers: { "User-Agent": UA, "Accept": "*/*" } });
  return resp && resp.data != null ? String(resp.data) : "";
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

function normalizeList(text) {
  var items = [];
  var t = String(text || "").trim();
  if (!t) return items;
  if (t.charAt(0) === "{" || t.charAt(0) === "[") {
    var obj = null;
    try { obj = JSON.parse(t); } catch (e) { obj = null; }
    var arr = obj ? (obj.list || (Array.isArray(obj) ? obj : [])) : [];
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
  while ((m = re.exec(t)) !== null) {
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

function toVideoItem(item) {
  var eps = parsePlayUrl(item.playUrl, item.playFrom);
  var tv = isTv(item);
  var firstUrl = eps.length ? eps[0].url : "";
  var vi = {
    id: firstUrl || String(item.id || item.name || ""),
    type: "url",
    title: item.name,
    description: item.content,
    coverUrl: item.pic,
    posterPath: item.pic,
    mediaType: tv ? "tv" : "movie",
    link: String(item.id || "")
  };
  if (firstUrl) vi.videoUrl = firstUrl;
  if (tv && eps.length > 0) {
    vi.episodeItems = eps.map(function (e, i) {
      return { id: e.url, type: "url", title: e.name || ("第" + (i + 1) + "集"), episode: i + 1, videoUrl: e.url, mediaType: "tv", link: String(item.id || "") };
    });
  }
  return vi;
}

async function loadList(params) {
  params = params || {};
  var base = getApi(params);
  var page = Number(params.page || 1);
  var url = buildUrl(base, { ac: "videolist", pg: page });
  var text = await fetchText(url);
  return normalizeList(text).map(toVideoItem);
}

async function search(params) {
  params = params || {};
  var base = getApi(params);
  var kw = params.keyword || params.wd || params.query || "";
  if (!kw) return [];
  var url = buildUrl(base, { ac: "videolist", wd: kw });
  var text = await fetchText(url);
  return normalizeList(text).map(toVideoItem);
}

async function loadDetail(link) {
  var id = String(link || "").trim();
  if (/^https?:\/\//i.test(id)) return { id: id, type: "url", title: "", mediaType: "movie", videoUrl: id, link: "" };
  if (!id) return null;
  var base = getStoredBase();
  var url = buildUrl(base, { ac: "detail", ids: id });
  var text = await fetchText(url);
  var list = normalizeList(text);
  return list.length ? toVideoItem(list[0]) : null;
}

function pickEpisodeIndex(eps, params) {
  var want = Number(params.episode || 0);
  if (!want) {
    var en = String(params.episodeName || "");
    var m = en.match(/E(\d+)/i) || en.match(/第\s*(\d+)\s*集/);
    if (m) want = Number(m[1]);
  }
  if (want > 0 && eps[want - 1]) return want - 1;
  return -1;
}

async function loadResource(params) {
  params = params || {};
  if (params.videoUrl) return [{ name: "线路1", description: "", url: params.videoUrl }];
  var eps = null, title = params.title || params.seriesName || "";
  try {
    var l = String(params.link || "").trim();
    if (/^\d+$/.test(l)) {
      var d = await loadDetail(l);
      if (d) { eps = d.episodeItems || null; title = d.title || title; if (!eps && d.videoUrl) return [{ name: "线路1", description: "", url: d.videoUrl }]; }
    }
  } catch (e) {}
  if ((!eps || !eps.length) && title) {
    try {
      var arr = await search({ keyword: title });
      if (arr && arr.length) {
        var it = arr[0];
        for (var i = 0; i < arr.length; i++) { if (arr[i].title && arr[i].title.indexOf(title) >= 0) { it = arr[i]; break; } }
        eps = it.episodeItems || null;
        if (!eps && it.videoUrl) return [{ name: "线路1", description: it.title || "", url: it.videoUrl }];
      }
    } catch (e) {}
  }
  if (eps && eps.length) {
    var idx = pickEpisodeIndex(eps, params);
    if (idx >= 0) return [{ name: eps[idx].title || ("第" + (idx + 1) + "集"), description: "", url: eps[idx].videoUrl }];
    return eps.map(function (e, i) { return { name: e.title || ("第" + (i + 1) + "集"), description: "", url: e.videoUrl }; });
  }
  return [];
}
