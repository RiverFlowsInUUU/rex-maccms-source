/**
 * 通用苹果CMS(MacCMS v10)采集 —— Rex 纯片源(线路)模块  v2.0
 *
 * 定位：这是"片源/线路"模块，不是"首页浏览"模块。
 *   - 不给首页加"列表行"（避免进模块黑屏）
 *   - 用法一：在 App 自带(TMDB)剧集/电影详情页，点播放 → 在"资源/线路"里选「苹果CMS采集源」
 *   - 用法二：用 Rex 顶部搜索，选择本模块搜索片名，点结果进详情 → 选线路播放
 *
 * ★ 必须用「网址导入」，不要用本地文件导入：
 *   本地文件导入的模块没有公网脚本来源，播放会报"缺少脚本来源信息"。
 *
 * 采集接口（模块设置里可改）：
 *   http://cj.lziapi.com/api.php/provide/vod/from/lzm3u8/
 *   http://slapibf.com/api.php/provide/vod
 */

var WidgetMetadata = {
  id: "yg.maccms.vod",
  title: "苹果CMS采集源",
  description: "苹果CMS片源(线路)模块：给自带剧集配源 / 搜索播放（m3u8）",
  author: "YG",
  site: "",
  version: "2.0.0",
  requiredVersion: "0.0.1",
  globalParams: [
    {
      name: "api",
      title: "采集接口地址",
      type: "input",
      value: "http://cj.lziapi.com/api.php/provide/vod/from/lzm3u8/"
    }
  ],
  modules: [
    {
      id: "loadResource",
      title: "加载资源",
      functionName: "loadResource",
      type: "stream",
      params: []
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
  try {
    if (Widget.storage && typeof Widget.storage.set === "function") {
      Widget.storage.set("yg_base", CUR_BASE);
    }
  } catch (e) {}
}

function getStoredBase() {
  var b = CUR_BASE || DEFAULT_API;
  try {
    if (Widget.storage && typeof Widget.storage.get === "function") {
      var s = Widget.storage.get("yg_base");
      if (typeof s === "string" && s) b = s;
    }
  } catch (e) {}
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
    if (query.hasOwnProperty(k) && query[k] !== undefined && query[k] !== null && query[k] !== "") {
      qs.push(encodeURIComponent(k) + "=" + encodeURIComponent(query[k]));
    }
  }
  var q = qs.join("&");
  if (!q) return base;
  return base + (base.indexOf("?") >= 0 ? "&" : "?") + q;
}

async function fetchText(url) {
  var resp = await Widget.http.get(url, { headers: { "User-Agent": UA, "Accept": "*/*" } });
  return resp && resp.data != null ? String(resp.data) : "";
}

function stripTags(s) {
  return String(s == null ? "" : s).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}
function cdata(s) {
  return String(s == null ? "" : s).replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "").trim();
}
function tag(block, name) {
  var m = block.match(new RegExp("<" + name + ">([\\s\\S]*?)<\\/" + name + ">"));
  return m ? cdata(m[1]) : "";
}

function parsePlayUrl(playUrl, playFrom) {
  var out = [];
  var lines = String(playUrl || "").split("$$$");
  var froms = String(playFrom || "").split("$$$");
  for (var li = 0; li < lines.length; li++) {
    var lineName = froms[li] || ("线路" + (li + 1));
    var segs = lines[li].split("#");
    for (var i = 0; i < segs.length; i++) {
      var seg = segs[i];
      if (!seg) continue;
      var p = seg.split("$");
      var name = p.length >= 2 ? p[0] : ("第" + (i + 1) + "集");
      var url = p.length >= 2 ? p[1] : p[0];
      url = String(url || "").trim();
      if (!/^https?:\/\//i.test(url)) continue;
      out.push({ line: lineName, name: stripTags(name), url: url });
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

// type:"url" 时 id 必须是真实播放地址
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
    link: String(item.id || "")   // 纯 vod_id
  };
  if (firstUrl) vi.videoUrl = firstUrl;
  if (tv && eps.length > 0) {
    vi.episodeItems = eps.map(function (e, i) {
      return {
        id: e.url, type: "url", title: e.name || ("第" + (i + 1) + "集"),
        episode: i + 1, videoUrl: e.url, mediaType: "tv", link: String(item.id || "")
      };
    });
  }
  return vi;
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
  if (/^https?:\/\//i.test(id)) {
    return { id: id, type: "url", title: "", mediaType: "movie", videoUrl: id, link: "" };
  }
  if (!id) return null;
  var base = getStoredBase();
  var url = buildUrl(base, { ac: "detail", ids: id });
  var text = await fetchText(url);
  var list = normalizeList(text);
  return list.length ? toVideoItem(list[0]) : null;
}

// 从条目/剧名里找出"第几集"对应的集序号
function pickEpisodeIndex(eps, params) {
  var want = Number(params.episode || 0);
  if (!want) {
    // 尝试从 episodeName(如"第05集"/"S01E05")解析
    var en = String(params.episodeName || "");
    var m1 = en.match(/E(\d+)/i) || en.match(/第\s*(\d+)\s*集/);
    if (m1) want = Number(m1[1]);
  }
  if (want > 0 && eps[want - 1]) return want - 1;
  return -1;
}

async function loadResource(params) {
  params = params || {};
  // 1) 条目本身已带直链
  if (params.videoUrl) {
    return [{ name: "线路1", description: "", url: params.videoUrl }];
  }

  var eps = null;
  var title = params.title || params.seriesName || "";

  // 2) link 是纯 vod_id 时直接取详情
  try {
    var l = String(params.link || "").trim();
    if (/^\d+$/.test(l)) {
      var d = await loadDetail(l);
      if (d) { eps = d.episodeItems || null; title = d.title || title; if (!eps && d.videoUrl) return [{ name: "线路1", description: "", url: d.videoUrl }]; }
    }
  } catch (e) {}

  // 3) 用剧名去采集站搜索（给 App 自带 TMDB 条目配源时走这里）
  if ((!eps || !eps.length) && title) {
    try {
      var arr = await search({ keyword: title });
      if (arr && arr.length) {
        // 优先标题相近的
        var it = arr[0];
        for (var i = 0; i < arr.length; i++) {
          if (arr[i].title && arr[i].title.indexOf(title) >= 0) { it = arr[i]; break; }
        }
        eps = it.episodeItems || null;
        if (!eps && it.videoUrl) return [{ name: "线路1", description: it.title || "", url: it.videoUrl }];
      }
    } catch (e) {}
  }

  if (eps && eps.length) {
    var idx = pickEpisodeIndex(eps, params);
    if (idx >= 0) {
      return [{ name: eps[idx].title || ("第" + (idx + 1) + "集"), description: "", url: eps[idx].videoUrl }];
    }
    // 无法确定集数：全部列出，用户自选
    return eps.map(function (e, i) {
      return { name: e.title || ("第" + (i + 1) + "集"), description: "", url: e.videoUrl };
    });
  }

  return [];
}

/*
可用采集接口候选（会失效，逐个试）：
量子  http://cj.lziapi.com/api.php/provide/vod/from/lzm3u8
红牛  http://hongniuzy2.com/api.php/provide/vod/from/hnm3u8
闪电  http://sdzyapi.com/api.php/provide/vod/from/sdm3u8
快车  http://caiji.kczyapi.com/api.php/provide/vod/from/kcm3u8
森林  http://slapibf.com/api.php/provide/vod
39影视 http://39kan.com/api.php/provide/vod
天堂  http://vipmv.cc/api.php/provide/vod
影库  http://api.ykapi.net/api.php/provide/vod
酷点  http://api.kuapi.cc/api.php/provide/vod
*/
