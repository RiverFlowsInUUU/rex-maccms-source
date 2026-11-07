/**
 * 全景聚合影视源 —— Rex 模块(自带列表 + 多站多线路播放) v1.0
 *
 * 把多个苹果CMS采集站整合进【一个模块】：
 *   - "最新更新"：模块自带列表（可在首页配置里加一行，浏览即采集站内容）
 *   - 搜索：多站合并，标 [站名] 区分来源
 *   - 播放：同一部剧同一集，聚合多个采集站，给多条线路
 *
 * ★ 必须用「网址」导入。Rex 官方 TMDB 首页只给元数据、不能挂第三方源，
 *   所以请用【本模块自己的列表/搜索】来浏览和播放。
 */

var WidgetMetadata = {
  id: "yg.maccms.panorama",
  title: "全景影视源(多站)",
  description: "多采集站整合：自带列表浏览 + 搜索 + 多线路播放",
  author: "YG",
  site: "",
  version: "1.0.0",
  requiredVersion: "0.0.1",
  globalParams: [],
  modules: [
    { id: "loadResource", title: "加载资源", functionName: "loadResource", type: "stream", params: [] },
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
        playUrl: String(v.vod_play_url || ""),
        time: String(v.vod_time || v.vod_time_add || "")
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
      playFrom: flagM ? flagM[1] : "", playUrl: dl ? cdata(dl[1]) : "", time: tag(b, "last")
    });
  }
  return items;
}

function isTv(item) {
  var ty = item.typeName || "";
  if (/剧|动漫|综艺|纪录|动画/.test(ty)) return true;
  return parsePlayUrl(item.playUrl, item.playFrom).length > 1;
}

function toVideoItem(item, siteIdx, siteName) {
  var eps = parsePlayUrl(item.playUrl, item.playFrom);
  var tv = isTv(item);
  var firstUrl = eps.length ? eps[0].url : "";
  var vi = {
    id: firstUrl || String(item.id || item.name || ""),
    type: "url",
    title: siteName ? ("[" + siteName + "] " + item.name) : item.name,
    description: item.content,
    coverUrl: item.pic,
    posterPath: item.pic,
    mediaType: tv ? "tv" : "movie",
    link: siteIdx + "|" + String(item.id || "")
  };
  if (firstUrl) vi.videoUrl = firstUrl;
  if (tv && eps.length > 0) {
    vi.episodeItems = eps.map(function (e, i) {
      return { id: e.url, type: "url", title: e.name || ("第" + (i + 1) + "集"), episode: i + 1, videoUrl: e.url, mediaType: "tv", link: siteIdx + "|" + String(item.id || "") };
    });
  }
  return vi;
}

async function searchSite(site, kw) {
  var url = buildUrl(site.api, { ac: "videolist", wd: kw });
  return normalizeList(await fetchData(url));
}
async function listSite(site, page) {
  var url = buildUrl(site.api, { ac: "videolist", pg: page });
  return normalizeList(await fetchData(url));
}
async function detailSite(site, id) {
  var url = buildUrl(site.api, { ac: "detail", ids: id });
  var list = normalizeList(await fetchData(url));
  return list.length ? list[0] : null;
}

function pickMatch(list, want) {
  if (!list || !list.length) return null;
  var w = String(want || "").replace(/\s+/g, "");
  var best = null, bestScore = -1;
  for (var i = 0; i < list.length; i++) {
    var n = String(list[i].name || "").replace(/\s+/g, "");
    if (!n) continue;
    var score = 0;
    if (n === w) score = 100;
    else if (n.indexOf(w) >= 0) score = 80 - (n.length - w.length);
    else if (w.indexOf(n) >= 0) score = 60 - (w.length - n.length);
    else continue;
    if (score > bestScore) { bestScore = score; best = list[i]; }
  }
  return best;
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

// 列表：多站聚合（每站取前 count，按片名去重，优先保留有分集的）
async function loadList(params) {
  params = params || {};
  var page = Number(params.page || 1);
  var perSite = Number(params.count || 24);
  var groups = await Promise.all(SITES.map(function (site, idx) {
    return listSite(site, page).then(function (list) {
      return { idx: idx, site: site, list: list.slice(0, perSite) };
    }).catch(function () { return { idx: idx, site: site, list: [] }; });
  }));
  var out = [], seen = {};
  for (var g = 0; g < groups.length; g++) {
    var grp = groups[g];
    for (var i = 0; i < grp.list.length; i++) {
      var it = grp.list[i];
      var key = String(it.name || "").replace(/\s+/g, "");
      if (!key || seen[key]) continue;
      var eps = parsePlayUrl(it.playUrl, it.playFrom);
      if (!eps.length) continue; // 没播放地址的跳过
      seen[key] = 1;
      out.push(toVideoItem(it, grp.idx, null));
    }
  }
  return out;
}

// 搜索：多站合并，标站名（同名片多站都会出现，等于多源）
async function search(params) {
  params = params || {};
  var kw = params.keyword || params.wd || params.query || "";
  if (!kw) return [];
  var groups = await Promise.all(SITES.map(function (site, idx) {
    return searchSite(site, kw).then(function (list) {
      return { idx: idx, site: site, list: list.slice(0, 10) };
    }).catch(function () { return { idx: idx, site: site, list: [] }; });
  }));
  var out = [];
  for (var g = 0; g < groups.length; g++) {
    var grp = groups[g];
    for (var i = 0; i < grp.list.length; i++) {
      var it = grp.list[i];
      if (!parsePlayUrl(it.playUrl, it.playFrom).length) continue;
      out.push(toVideoItem(it, grp.idx, grp.site.name));
    }
  }
  return out;
}

async function loadDetail(link) {
  var s = String(link || "");
  var p = s.split("|");
  if (p.length < 2) return null;
  var idx = Number(p[0]);
  var id = p[1];
  var site = SITES[idx];
  if (!site || !id) return null;
  var it = await detailSite(site, id);
  return it ? toVideoItem(it, idx, null) : null;
}

// 起播/换源：多站聚合，返回多条线路
async function loadResource(params) {
  params = params || {};
  var title = params.seriesName || params.title || "";
  var lines = [], seen = {};
  function add(name, desc, url) { if (url && !seen[url]) { seen[url] = 1; lines.push({ name: name, description: desc || "", url: url }); } }

  // 若条目自带直链，先放一条
  if (params.videoUrl) add("本条目", "", params.videoUrl);

  // 若 link 是 idx|id，先取该站该集
  var s = String(params.link || "");
  if (/^\d+\|/.test(s)) {
    try {
      var p = s.split("|");
      var site0 = SITES[Number(p[0])];
      if (site0) {
        var it = await detailSite(site0, p[1]);
        if (it) {
          var eps0 = parsePlayUrl(it.playUrl, it.playFrom);
          var i0 = pickEpisodeIndex(eps0, params);
          if (i0 < 0) i0 = 0;
          if (eps0[i0]) add(site0.name, eps0[i0].name, eps0[i0].url);
          if (!title) title = it.name;
        }
      }
    } catch (e) {}
  }

  // 多站聚合同名剧当前集
  if (title) {
    var results = await Promise.all(SITES.map(function (site) {
      return searchSite(site, title).then(function (list) {
        var it = pickMatch(list, title);
        if (!it) return null;
        var eps = parsePlayUrl(it.playUrl, it.playFrom);
        if (!eps.length) return null;
        var idx = pickEpisodeIndex(eps, params);
        if (idx < 0) idx = 0;
        return { name: site.name, desc: eps[idx].name, url: eps[idx].url };
      }).catch(function () { return null; });
    }));
    for (var i = 0; i < results.length; i++) { if (results[i]) add(results[i].name, results[i].desc, results[i].url); }
  }
  return lines;
}
