/**
 * 聚合影视源（多采集站）—— Rex 纯片源(stream)模块  v1.0
 *
 * 定位：配合 Rex 自带首页（TMDB 元数据/追剧）使用。
 *   - 不做自己的首页列表
 *   - 在你点某部剧/某集播放时，同时去多个苹果CMS采集站找"同名剧+同一集"，
 *     把多个线路一次性列出来，你挑一条播（哪个站有、哪个快就用哪个）
 *
 * ★ 必须用「网址」导入（本地文件导入无脚本来源，播放报“缺少脚本来源信息”）。
 *
 * 想加/减采集站：改下面 SITES 数组即可（name 随便起，api 是苹果CMS采集接口）。
 */

var WidgetMetadata = {
  id: "yg.maccms.aggregate",
  title: "聚合影视源(多站)",
  description: "多采集站聚合：给自带首页的剧集/电影自动配多条线路",
  author: "YG",
  site: "",
  version: "1.0.0",
  requiredVersion: "0.0.1",
  globalParams: [],
  modules: [
    { id: "loadResource", title: "加载资源", functionName: "loadResource", type: "stream", params: [] }
  ],
  search: {
    title: "搜索(多站)",
    functionName: "search",
    params: [{ name: "keyword", title: "关键词", type: "input" }]
  }
};

// ======== 采集站清单（可自行增删；api = 苹果CMS采集接口根地址）========
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

// 搜索单个站
async function searchSite(site, kw) {
  var url = buildUrl(site.api, { ac: "videolist", wd: kw });
  var data = await fetchData(url);
  return normalizeList(data);
}

// 在结果里挑标题最接近的
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

// 从单个站拿到"当前集"的线路（1条，写站名）
async function siteLines(site, title, params) {
  var list = await searchSite(site, title);
  var it = pickMatch(list, title);
  if (!it) return [];
  var eps = parsePlayUrl(it.playUrl, it.playFrom);
  if (eps.length) {
    var idx = pickEpisodeIndex(eps, params);
    if (idx < 0) idx = 0; // 拿不到集号就取第一集
    var e = eps[idx];
    if (e && e.url) return [{ name: site.name, description: e.name || ("第" + (idx + 1) + "集"), url: e.url }];
  }
  return [];
}

// 多站聚合：并发查询，合并所有可用线路
async function aggregate(title, params) {
  if (!title) return [];
  var tasks = SITES.map(function (site) {
    return siteLines(site, title, params).catch(function () { return []; });
  });
  var results = await Promise.all(tasks);
  var out = [], seen = {};
  for (var i = 0; i < results.length; i++) {
    var arr = results[i] || [];
    for (var j = 0; j < arr.length; j++) {
      if (!arr[j].url || seen[arr[j].url]) continue;
      seen[arr[j].url] = 1;
      out.push(arr[j]);
    }
  }
  return out;
}

// ---- 搜索模块：多站合并（供 Rex 搜索里用）----
async function search(params) {
  params = params || {};
  var kw = params.keyword || params.wd || params.query || "";
  if (!kw) return [];
  var out = [];
  var tasks = SITES.map(function (site) {
    return searchSite(site, kw).then(function (list) {
      return list.slice(0, 12).map(function (it) { return { site: site, it: it }; });
    }).catch(function () { return []; });
  });
  var groups = await Promise.all(tasks);
  var seen = {};
  for (var i = 0; i < groups.length; i++) {
    for (var j = 0; j < groups[i].length; j++) {
      var g = groups[i][j];
      var key = g.it.name;
      if (seen[key]) continue;
      seen[key] = 1;
      var eps = parsePlayUrl(g.it.playUrl, g.it.playFrom);
      out.push({
        id: eps.length ? eps[0].url : String(g.it.id),
        type: "url",
        title: g.it.name,
        description: g.it.content,
        coverUrl: g.it.pic,
        posterPath: g.it.pic,
        mediaType: eps.length > 1 ? "tv" : "movie",
        videoUrl: eps.length ? eps[0].url : undefined,
        link: g.site.name + "||" + g.it.id + "||" + g.it.name
      });
    }
  }
  return out;
}

// 点播：多站聚合
async function loadResource(params) {
  params = params || {};
  if (params.videoUrl) {
    // 搜索条目自带的直链：也顺带聚合其它站，作为多线路
    var base = [{ name: "本条目", description: "", url: params.videoUrl }];
    return base;
  }
  var title = params.seriesName || params.title || "";
  var lines = await aggregate(title, params);
  if (lines.length) return lines;
  return [];
}
