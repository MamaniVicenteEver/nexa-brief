// ../../../../../../../tmp/atlas-assets-vkl_0ak0/npm/node_modules/fflate/esm/browser.js
var u8 = Uint8Array;
var u16 = Uint16Array;
var i32 = Int32Array;
var fleb = new u8([
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  1,
  1,
  1,
  1,
  2,
  2,
  2,
  2,
  3,
  3,
  3,
  3,
  4,
  4,
  4,
  4,
  5,
  5,
  5,
  5,
  0,
  /* unused */
  0,
  0,
  /* impossible */
  0
]);
var fdeb = new u8([
  0,
  0,
  0,
  0,
  1,
  1,
  2,
  2,
  3,
  3,
  4,
  4,
  5,
  5,
  6,
  6,
  7,
  7,
  8,
  8,
  9,
  9,
  10,
  10,
  11,
  11,
  12,
  12,
  13,
  13,
  /* unused */
  0,
  0
]);
var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
var freb = function(eb, start) {
  var b2 = new u16(31);
  for (var i2 = 0; i2 < 31; ++i2) {
    b2[i2] = start += 1 << eb[i2 - 1];
  }
  var r = new i32(b2[30]);
  for (var i2 = 1; i2 < 30; ++i2) {
    for (var j2 = b2[i2]; j2 < b2[i2 + 1]; ++j2) {
      r[j2] = j2 - b2[i2] << 5 | i2;
    }
  }
  return { b: b2, r };
};
var _a = freb(fleb, 2);
var fl = _a.b;
var revfl = _a.r;
fl[28] = 258, revfl[258] = 28;
var _b = freb(fdeb, 0);
var fd = _b.b;
var revfd = _b.r;
var rev = new u16(32768);
for (i = 0; i < 32768; ++i) {
  x = (i & 43690) >> 1 | (i & 21845) << 1;
  x = (x & 52428) >> 2 | (x & 13107) << 2;
  x = (x & 61680) >> 4 | (x & 3855) << 4;
  rev[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
}
var x;
var i;
var hMap = (function(cd, mb, r) {
  var s = cd.length;
  var i2 = 0;
  var l = new u16(mb);
  for (; i2 < s; ++i2) {
    if (cd[i2])
      ++l[cd[i2] - 1];
  }
  var le = new u16(mb);
  for (i2 = 1; i2 < mb; ++i2) {
    le[i2] = le[i2 - 1] + l[i2 - 1] << 1;
  }
  var co;
  if (r) {
    co = new u16(1 << mb);
    var rvb = 15 - mb;
    for (i2 = 0; i2 < s; ++i2) {
      if (cd[i2]) {
        var sv = i2 << 4 | cd[i2];
        var r_1 = mb - cd[i2];
        var v2 = le[cd[i2] - 1]++ << r_1;
        for (var m = v2 | (1 << r_1) - 1; v2 <= m; ++v2) {
          co[rev[v2] >> rvb] = sv;
        }
      }
    }
  } else {
    co = new u16(s);
    for (i2 = 0; i2 < s; ++i2) {
      if (cd[i2]) {
        co[i2] = rev[le[cd[i2] - 1]++] >> 15 - cd[i2];
      }
    }
  }
  return co;
});
var flt = new u8(288);
for (i = 0; i < 144; ++i)
  flt[i] = 8;
var i;
for (i = 144; i < 256; ++i)
  flt[i] = 9;
var i;
for (i = 256; i < 280; ++i)
  flt[i] = 7;
var i;
for (i = 280; i < 288; ++i)
  flt[i] = 8;
var i;
var fdt = new u8(32);
for (i = 0; i < 32; ++i)
  fdt[i] = 5;
var i;
var flrm = /* @__PURE__ */ hMap(flt, 9, 1);
var fdrm = /* @__PURE__ */ hMap(fdt, 5, 1);
var max = function(a) {
  var m = a[0];
  for (var i2 = 1; i2 < a.length; ++i2) {
    if (a[i2] > m)
      m = a[i2];
  }
  return m;
};
var bits = function(d2, p, m) {
  var o = p / 8 | 0;
  return (d2[o] | d2[o + 1] << 8) >> (p & 7) & m;
};
var bits16 = function(d2, p) {
  var o = p / 8 | 0;
  return (d2[o] | d2[o + 1] << 8 | d2[o + 2] << 16) >> (p & 7);
};
var shft = function(p) {
  return (p + 7) / 8 | 0;
};
var slc = function(v2, s, e) {
  if (s == null || s < 0)
    s = 0;
  if (e == null || e > v2.length)
    e = v2.length;
  return new u8(v2.subarray(s, e));
};
var ec = [
  "unexpected EOF",
  "invalid block type",
  "invalid length/literal",
  "invalid distance",
  "stream finished",
  "no stream handler",
  ,
  // determined by compression function
  "no callback",
  "invalid UTF-8 data",
  "extra field too long",
  "date not in range 1980-2099",
  "filename too long",
  "stream finishing",
  "invalid zip data"
  // determined by unknown compression method
];
var err = function(ind, msg, nt) {
  var e = new Error(msg || ec[ind]);
  e.code = ind;
  if (Error.captureStackTrace)
    Error.captureStackTrace(e, err);
  if (!nt)
    throw e;
  return e;
};
var inflt = function(dat, st, buf, dict) {
  var sl = dat.length, dl = dict ? dict.length : 0;
  if (!sl || st.f && !st.l)
    return buf || new u8(0);
  var noBuf = !buf;
  var resize = noBuf || st.i != 2;
  var noSt = st.i;
  if (noBuf)
    buf = new u8(sl * 3);
  var cbuf = function(l2) {
    var bl = buf.length;
    if (l2 > bl) {
      var nbuf = new u8(Math.max(bl * 2, l2));
      nbuf.set(buf);
      buf = nbuf;
    }
  };
  var final = st.f || 0, pos = st.p || 0, bt = st.b || 0, lm = st.l, dm = st.d, lbt = st.m, dbt = st.n;
  var tbts = sl * 8;
  do {
    if (!lm) {
      final = bits(dat, pos, 1);
      var type = bits(dat, pos + 1, 3);
      pos += 3;
      if (!type) {
        var s = shft(pos) + 4, l = dat[s - 4] | dat[s - 3] << 8, t = s + l;
        if (t > sl) {
          if (noSt)
            err(0);
          break;
        }
        if (resize)
          cbuf(bt + l);
        buf.set(dat.subarray(s, t), bt);
        st.b = bt += l, st.p = pos = t * 8, st.f = final;
        continue;
      } else if (type == 1)
        lm = flrm, dm = fdrm, lbt = 9, dbt = 5;
      else if (type == 2) {
        var hLit = bits(dat, pos, 31) + 257, hcLen = bits(dat, pos + 10, 15) + 4;
        var tl = hLit + bits(dat, pos + 5, 31) + 1;
        pos += 14;
        var ldt = new u8(tl);
        var clt = new u8(19);
        for (var i2 = 0; i2 < hcLen; ++i2) {
          clt[clim[i2]] = bits(dat, pos + i2 * 3, 7);
        }
        pos += hcLen * 3;
        var clb = max(clt), clbmsk = (1 << clb) - 1;
        var clm = hMap(clt, clb, 1);
        for (var i2 = 0; i2 < tl; ) {
          var r = clm[bits(dat, pos, clbmsk)];
          pos += r & 15;
          var s = r >> 4;
          if (s < 16) {
            ldt[i2++] = s;
          } else {
            var c = 0, n = 0;
            if (s == 16)
              n = 3 + bits(dat, pos, 3), pos += 2, c = ldt[i2 - 1];
            else if (s == 17)
              n = 3 + bits(dat, pos, 7), pos += 3;
            else if (s == 18)
              n = 11 + bits(dat, pos, 127), pos += 7;
            while (n--)
              ldt[i2++] = c;
          }
        }
        var lt = ldt.subarray(0, hLit), dt = ldt.subarray(hLit);
        lbt = max(lt);
        dbt = max(dt);
        lm = hMap(lt, lbt, 1);
        dm = hMap(dt, dbt, 1);
      } else
        err(1);
      if (pos > tbts) {
        if (noSt)
          err(0);
        break;
      }
    }
    if (resize)
      cbuf(bt + 131072);
    var lms = (1 << lbt) - 1, dms = (1 << dbt) - 1;
    var lpos = pos;
    for (; ; lpos = pos) {
      var c = lm[bits16(dat, pos) & lms], sym = c >> 4;
      pos += c & 15;
      if (pos > tbts) {
        if (noSt)
          err(0);
        break;
      }
      if (!c)
        err(2);
      if (sym < 256)
        buf[bt++] = sym;
      else if (sym == 256) {
        lpos = pos, lm = null;
        break;
      } else {
        var add = sym - 254;
        if (sym > 264) {
          var i2 = sym - 257, b2 = fleb[i2];
          add = bits(dat, pos, (1 << b2) - 1) + fl[i2];
          pos += b2;
        }
        var d2 = dm[bits16(dat, pos) & dms], dsym = d2 >> 4;
        if (!d2)
          err(3);
        pos += d2 & 15;
        var dt = fd[dsym];
        if (dsym > 3) {
          var b2 = fdeb[dsym];
          dt += bits16(dat, pos) & (1 << b2) - 1, pos += b2;
        }
        if (pos > tbts) {
          if (noSt)
            err(0);
          break;
        }
        if (resize)
          cbuf(bt + 131072);
        var end = bt + add;
        if (bt < dt) {
          var shift = dl - dt, dend = Math.min(dt, end);
          if (shift + bt < 0)
            err(3);
          for (; bt < dend; ++bt)
            buf[bt] = dict[shift + bt];
        }
        for (; bt < end; ++bt)
          buf[bt] = buf[bt - dt];
      }
    }
    st.l = lm, st.p = lpos, st.b = bt, st.f = final;
    if (lm)
      final = 1, st.m = lbt, st.d = dm, st.n = dbt;
  } while (!final);
  return bt != buf.length && noBuf ? slc(buf, 0, bt) : buf.subarray(0, bt);
};
var et = /* @__PURE__ */ new u8(0);
var gzs = function(d2) {
  if (d2[0] != 31 || d2[1] != 139 || d2[2] != 8)
    err(6, "invalid gzip data");
  var flg = d2[3];
  var st = 10;
  if (flg & 4)
    st += (d2[10] | d2[11] << 8) + 2;
  for (var zs = (flg >> 3 & 1) + (flg >> 4 & 1); zs > 0; zs -= !d2[st++])
    ;
  return st + (flg & 2);
};
var gzl = function(d2) {
  var l = d2.length;
  return (d2[l - 4] | d2[l - 3] << 8 | d2[l - 2] << 16 | d2[l - 1] << 24) >>> 0;
};
var zls = function(d2, dict) {
  if ((d2[0] & 15) != 8 || d2[0] >> 4 > 7 || (d2[0] << 8 | d2[1]) % 31)
    err(6, "invalid zlib data");
  if ((d2[1] >> 5 & 1) == +!dict)
    err(6, "invalid zlib data: " + (d2[1] & 32 ? "need" : "unexpected") + " dictionary");
  return (d2[1] >> 3 & 4) + 2;
};
function inflateSync(data, opts) {
  return inflt(data, { i: 2 }, opts && opts.out, opts && opts.dictionary);
}
function gunzipSync(data, opts) {
  var st = gzs(data);
  if (st + 8 > data.length)
    err(6, "invalid gzip data");
  return inflt(data.subarray(st, -8), { i: 2 }, opts && opts.out || new u8(gzl(data)), opts && opts.dictionary);
}
function unzlibSync(data, opts) {
  return inflt(data.subarray(zls(data, opts && opts.dictionary), -4), { i: 2 }, opts && opts.out, opts && opts.dictionary);
}
function decompressSync(data, opts) {
  return data[0] == 31 && data[1] == 139 && data[2] == 8 ? gunzipSync(data, opts) : (data[0] & 15) != 8 || data[0] >> 4 > 7 || (data[0] << 8 | data[1]) % 31 ? inflateSync(data, opts) : unzlibSync(data, opts);
}
var td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder();
var tds = 0;
try {
  td.decode(et, { stream: true });
  tds = 1;
} catch (e) {
}

// ../../../../../../../tmp/atlas-assets-vkl_0ak0/npm/node_modules/pmtiles/dist/esm/index.js
var j = Object.defineProperty;
var S = Math.pow;
var d = (o, t) => j(o, "name", { value: t, configurable: true });
var h = (o, t, e) => new Promise((r, n) => {
  var s = (c) => {
    try {
      a(e.next(c));
    } catch (l) {
      n(l);
    }
  }, i2 = (c) => {
    try {
      a(e.throw(c));
    } catch (l) {
      n(l);
    }
  }, a = (c) => c.done ? r(c.value) : Promise.resolve(c.value).then(s, i2);
  a((e = e.apply(o, t)).next());
});
var re = d((o, t) => {
  let e = false, r = "", n = L.GridLayer.extend({ createTile: d((s, i2) => {
    let a = document.createElement("img"), c = new AbortController(), l = c.signal;
    return a.cancel = () => {
      c.abort();
    }, e || (o.getHeader().then((u) => {
      u.tileType === 1 || u.tileType === 6 ? console.error("Error: archive contains vector tiles, but leafletRasterLayer is for displaying raster tiles. See https://github.com/protomaps/PMTiles/tree/main/js for details.") : u.tileType === 2 ? r = "image/png" : u.tileType === 3 ? r = "image/jpeg" : u.tileType === 4 ? r = "image/webp" : u.tileType === 5 && (r = "image/avif");
    }), e = true), o.getZxy(s.z, s.x, s.y, l).then((u) => {
      if (u) {
        let m = new Blob([u.data], { type: r }), g = window.URL.createObjectURL(m);
        a.src = g;
      } else a.style.display = "none";
      a.cancel = void 0, i2(void 0, a);
    }).catch((u) => {
      if (u.name !== "AbortError") throw u;
    }), a;
  }, "createTile"), _removeTile: d(function(s) {
    let i2 = this._tiles[s];
    i2 && (i2.el.cancel && i2.el.cancel(), i2.el.src && window.URL.revokeObjectURL(i2.el.src), i2.el.width = 0, i2.el.height = 0, i2.el.deleted = true, L.DomUtil.remove(i2.el), delete this._tiles[s], this.fire("tileunload", { tile: i2.el, coords: this._keyToTileCoords(s) }));
  }, "_removeTile") });
  return new n(t);
}, "leafletRasterLayer");
var z = d((o) => (t, e) => {
  if (e instanceof AbortController) return o(t, e);
  let r = new AbortController();
  return o(t, r).then((n) => e(void 0, n.data, n.cacheControl || "", n.expires || ""), (n) => e(n)).catch((n) => e(n)), { cancel: d(() => r.abort(), "cancel") };
}, "v3compat");
var A = class A2 {
  constructor(t) {
    this.tilev4 = d((t2, e) => h(this, null, function* () {
      if (t2.type === "json") {
        let g = t2.url.substr(10), p = this.tiles.get(g);
        if (p || (p = new w(g), this.tiles.set(g, p)), this.metadata) {
          let K = yield p.getTileJson(t2.url);
          return e.signal.throwIfAborted(), { data: K };
        }
        let f = yield p.getHeader();
        return e.signal.throwIfAborted(), (f.minLon >= f.maxLon || f.minLat >= f.maxLat) && console.error(`Bounds of PMTiles archive ${f.minLon},${f.minLat},${f.maxLon},${f.maxLat} are not valid.`), { data: { tiles: [`${t2.url}/{z}/{x}/{y}`], minzoom: f.minZoom, maxzoom: f.maxZoom, bounds: [f.minLon, f.minLat, f.maxLon, f.maxLat] } };
      }
      let r = new RegExp(/pmtiles:\/\/(.+)\/(\d+)\/(\d+)\/(\d+)/), n = t2.url.match(r);
      if (!n) throw new Error("Invalid PMTiles protocol URL");
      let s = n[1], i2 = this.tiles.get(s);
      i2 || (i2 = new w(s), this.tiles.set(s, i2));
      let a = n[2], c = n[3], l = n[4], u = yield i2 == null ? void 0 : i2.getZxy(+a, +c, +l, e.signal);
      if (e.signal.throwIfAborted(), u) return { data: new Uint8Array(u.data), cacheControl: u.cacheControl, expires: u.expires };
      let m = yield i2.getHeader();
      if (m.tileType === 1 || m.tileType === 6) {
        if (this.errorOnMissingTile) throw new Error("Tile not found.");
        return { data: new Uint8Array() };
      }
      return { data: null };
    }), "tilev4");
    this.tile = z(this.tilev4);
    this.tiles = /* @__PURE__ */ new Map(), this.metadata = (t == null ? void 0 : t.metadata) || false, this.errorOnMissingTile = (t == null ? void 0 : t.errorOnMissingTile) || false;
  }
  add(t) {
    this.tiles.set(t.source.getKey(), t);
  }
  get(t) {
    return this.tiles.get(t);
  }
};
d(A, "Protocol");
var B = A;
function b(o, t) {
  return (t >>> 0) * 4294967296 + (o >>> 0);
}
d(b, "toNum");
function N(o, t) {
  let e = t.buf, r = e[t.pos++], n = (r & 112) >> 4;
  if (r < 128 || (r = e[t.pos++], n |= (r & 127) << 3, r < 128) || (r = e[t.pos++], n |= (r & 127) << 10, r < 128) || (r = e[t.pos++], n |= (r & 127) << 17, r < 128) || (r = e[t.pos++], n |= (r & 127) << 24, r < 128) || (r = e[t.pos++], n |= (r & 1) << 31, r < 128)) return b(o, n);
  throw new Error("Expected varint not more than 10 bytes");
}
d(N, "readVarintRemainder");
function x2(o) {
  let t = o.buf, e = t[o.pos++], r = e & 127;
  return e < 128 || (e = t[o.pos++], r |= (e & 127) << 7, e < 128) || (e = t[o.pos++], r |= (e & 127) << 14, e < 128) || (e = t[o.pos++], r |= (e & 127) << 21, e < 128) ? r : (e = t[o.pos], r |= (e & 15) << 28, N(r, o));
}
d(x2, "readVarint");
function I(o, t, e, r, n) {
  return n === 0 ? r !== 0 ? [o - 1 - e, o - 1 - t] : [e, t] : [t, e];
}
d(I, "rotate");
function q(o, t, e) {
  if (o > 26) throw new Error("Tile zoom level exceeds max safe number limit (26)");
  if (t >= 1 << o || e >= 1 << o) throw new Error("tile x/y outside zoom level bounds");
  let r = ((1 << o) * (1 << o) - 1) / 3, n = o - 1, [s, i2] = [t, e];
  for (let a = 1 << n; a > 0; a >>= 1) {
    let c = s & a, l = i2 & a;
    r += (3 * c ^ l) * (1 << n), [s, i2] = I(a, s, i2, c, l), n--;
  }
  return r;
}
d(q, "zxyToTileId");
function G(o) {
  let t = 3 * o + 1;
  return t < 4294967296 ? 31 - Math.clz32(t) : 63 - Math.clz32(t / 4294967296);
}
d(G, "tileIdToZ");
function ie(o) {
  let t = G(o) >> 1;
  if (t > 26) throw new Error("Tile zoom level exceeds max safe number limit (26)");
  let e = ((1 << t) * (1 << t) - 1) / 3, r = o - e, n = 0, s = 0, i2 = 1 << t;
  for (let a = 1; a < i2; a <<= 1) {
    let c = a & r / 2, l = a & (r ^ c);
    [n, s] = I(a, n, s, c, l), r = r / 2, n += c, s += l;
  }
  return [t, n, s];
}
d(ie, "tileIdToZxy");
var J = ((s) => (s[s.Unknown = 0] = "Unknown", s[s.None = 1] = "None", s[s.Gzip = 2] = "Gzip", s[s.Brotli = 3] = "Brotli", s[s.Zstd = 4] = "Zstd", s))(J || {});
function P(o, t) {
  return h(this, null, function* () {
    if (t === 1 || t === 0) return o;
    if (t === 2) {
      if (typeof globalThis.DecompressionStream == "undefined") return decompressSync(new Uint8Array(o));
      let e = new Response(o).body;
      if (!e) throw new Error("Failed to read response stream");
      let r = e.pipeThrough(new globalThis.DecompressionStream("gzip"));
      return new Response(r).arrayBuffer();
    }
    throw new Error("Compression method not supported");
  });
}
d(P, "defaultDecompress");
var O = ((a) => (a[a.Unknown = 0] = "Unknown", a[a.Mvt = 1] = "Mvt", a[a.Png = 2] = "Png", a[a.Jpeg = 3] = "Jpeg", a[a.Webp = 4] = "Webp", a[a.Avif = 5] = "Avif", a[a.Mlt = 6] = "Mlt", a))(O || {});
function _(o) {
  return o === 1 ? ".mvt" : o === 2 ? ".png" : o === 3 ? ".jpg" : o === 4 ? ".webp" : o === 5 ? ".avif" : o === 6 ? ".mlt" : "";
}
d(_, "tileTypeExt");
var Y = 127;
function Q(o, t) {
  let e = 0, r = o.length - 1;
  for (; e <= r; ) {
    let n = r + e >> 1, s = t - o[n].tileId;
    if (s > 0) e = n + 1;
    else if (s < 0) r = n - 1;
    else return o[n];
  }
  return r >= 0 && (o[r].runLength === 0 || t - o[r].tileId < o[r].runLength) ? o[r] : null;
}
d(Q, "findTile");
var T = class T2 {
  constructor(t) {
    this.file = t;
  }
  getKey() {
    return this.file.name;
  }
  getBytes(t, e) {
    return h(this, null, function* () {
      return { data: yield this.file.slice(t, t + e).arrayBuffer() };
    });
  }
};
d(T, "FileSource");
var k = T;
var D = class D2 {
  constructor(t, e = new Headers(), r = void 0) {
    var a, c;
    this.url = t, this.customHeaders = e, this.credentials = r, this.mustReload = false;
    let n = "";
    "navigator" in globalThis && (n = (c = (a = globalThis.navigator) == null ? void 0 : a.userAgent) != null ? c : "");
    let s = n.indexOf("Windows") > -1, i2 = /Chrome|Chromium|Edg|OPR|Brave/.test(n);
    this.chromeWindowsNoCache = false, s && i2 && (this.chromeWindowsNoCache = true);
  }
  getKey() {
    return this.url;
  }
  setHeaders(t) {
    this.customHeaders = t;
  }
  getBytes(t, e, r, n) {
    return h(this, null, function* () {
      let s, i2;
      r ? i2 = r : (s = new AbortController(), i2 = s.signal);
      let a = new Headers(this.customHeaders);
      a.set("range", `bytes=${t}-${t + e - 1}`);
      let c;
      this.mustReload ? c = "reload" : this.chromeWindowsNoCache && (c = "no-store");
      let l = yield fetch(this.url, { signal: i2, cache: c, headers: a, credentials: this.credentials });
      if (t === 0 && l.status === 416) {
        let p = l.headers.get("Content-Range");
        if (!p || !p.startsWith("bytes */")) throw new Error("Missing content-length on 416 response");
        let f = +p.substr(8);
        a.set("range", `bytes=0-${f - 1}`), l = yield fetch(this.url, { signal: i2, cache: "reload", headers: a, credentials: this.credentials });
      }
      let u = l.headers.get("Etag");
      if (u != null && u.startsWith("W/") && (u = null), l.status === 416 || n && u && u !== n) throw this.mustReload = true, new v(`Server returned non-matching ETag ${n} after one retry. Check browser extensions and servers for issues that may affect correct ETag headers.`);
      if (l.status >= 300) throw new Error(`Bad response code: ${l.status}`);
      let m = l.headers.get("Content-Length");
      if (l.status === 200 && (!m || +m > e)) throw s && s.abort(), new Error("Server returned no content-length header or content-length exceeding request. Check that your storage backend supports HTTP Byte Serving.");
      return { data: yield l.arrayBuffer(), etag: u || void 0, cacheControl: l.headers.get("Cache-Control") || void 0, expires: l.headers.get("Expires") || void 0 };
    });
  }
};
d(D, "FetchSource");
var E = D;
function y(o, t) {
  let e = o.getUint32(t + 4, true), r = o.getUint32(t + 0, true);
  return e * S(2, 32) + r;
}
d(y, "getUint64");
function X(o, t) {
  let e = new DataView(o), r = e.getUint8(7);
  if (r > 3) throw new Error(`Archive is spec version ${r} but this library supports up to spec version 3`);
  return { specVersion: r, rootDirectoryOffset: y(e, 8), rootDirectoryLength: y(e, 16), jsonMetadataOffset: y(e, 24), jsonMetadataLength: y(e, 32), leafDirectoryOffset: y(e, 40), leafDirectoryLength: y(e, 48), tileDataOffset: y(e, 56), tileDataLength: y(e, 64), numAddressedTiles: y(e, 72), numTileEntries: y(e, 80), numTileContents: y(e, 88), clustered: e.getUint8(96) === 1, internalCompression: e.getUint8(97), tileCompression: e.getUint8(98), tileType: e.getUint8(99), minZoom: e.getUint8(100), maxZoom: e.getUint8(101), minLon: e.getInt32(102, true) / 1e7, minLat: e.getInt32(106, true) / 1e7, maxLon: e.getInt32(110, true) / 1e7, maxLat: e.getInt32(114, true) / 1e7, centerZoom: e.getUint8(118), centerLon: e.getInt32(119, true) / 1e7, centerLat: e.getInt32(123, true) / 1e7, etag: t };
}
d(X, "bytesToHeader");
function Z(o) {
  let t = { buf: new Uint8Array(o), pos: 0 }, e = x2(t), r = [], n = 0;
  for (let s = 0; s < e; s++) {
    let i2 = x2(t);
    r.push({ tileId: n + i2, offset: 0, length: 0, runLength: 1 }), n += i2;
  }
  for (let s = 0; s < e; s++) r[s].runLength = x2(t);
  for (let s = 0; s < e; s++) r[s].length = x2(t);
  for (let s = 0; s < e; s++) {
    let i2 = x2(t);
    i2 === 0 && s > 0 ? r[s].offset = r[s - 1].offset + r[s - 1].length : r[s].offset = i2 - 1;
  }
  return r;
}
d(Z, "deserializeIndex");
var R = class R2 extends Error {
};
d(R, "EtagMismatch");
var v = R;
function V(o, t) {
  return h(this, null, function* () {
    let e = yield o.getBytes(0, 16384);
    if (new DataView(e.data).getUint16(0, true) !== 19792) throw new Error("Wrong magic number for PMTiles archive");
    let n = e.data.slice(0, Y), s = X(n, e.etag), i2 = e.data.slice(s.rootDirectoryOffset, s.rootDirectoryOffset + s.rootDirectoryLength), a = `${o.getKey()}|${s.etag || ""}|${s.rootDirectoryOffset}|${s.rootDirectoryLength}`, c = Z(yield t(i2, s.internalCompression));
    return [s, [a, c.length, c]];
  });
}
d(V, "getHeaderAndRoot");
function F(o, t, e, r, n, s) {
  return h(this, null, function* () {
    let i2 = yield o.getBytes(e, r, s, n.etag), a = yield t(i2.data, n.internalCompression), c = Z(a);
    if (c.length === 0) throw new Error("Empty directory is invalid");
    return c;
  });
}
d(F, "getDirectory");
var U = class U2 {
  constructor(t = 100, e = true, r = P) {
    this.cache = /* @__PURE__ */ new Map(), this.maxCacheEntries = t, this.counter = 1, this.decompress = r;
  }
  getHeader(t) {
    return h(this, null, function* () {
      let e = t.getKey(), r = this.cache.get(e);
      if (r) return r.lastUsed = this.counter++, r.data;
      let n = yield V(t, this.decompress);
      return n[1] && this.cache.set(n[1][0], { lastUsed: this.counter++, data: n[1][2] }), this.cache.set(e, { lastUsed: this.counter++, data: n[0] }), this.prune(), n[0];
    });
  }
  getDirectory(t, e, r, n, s) {
    return h(this, null, function* () {
      let i2 = `${t.getKey()}|${n.etag || ""}|${e}|${r}`, a = this.cache.get(i2);
      if (a) return a.lastUsed = this.counter++, a.data;
      let c = yield F(t, this.decompress, e, r, n, s);
      return this.cache.set(i2, { lastUsed: this.counter++, data: c }), this.prune(), c;
    });
  }
  prune() {
    if (this.cache.size > this.maxCacheEntries) {
      let t = 1 / 0, e;
      this.cache.forEach((r, n) => {
        r.lastUsed < t && (t = r.lastUsed, e = n);
      }), e && this.cache.delete(e);
    }
  }
  invalidate(t) {
    return h(this, null, function* () {
      this.cache.delete(t.getKey());
    });
  }
};
d(U, "ResolvedValueCache");
var $ = U;
var M = class M2 {
  constructor(t = 100, e = true, r = P) {
    this.cache = /* @__PURE__ */ new Map(), this.invalidations = /* @__PURE__ */ new Map(), this.pendingFetches = /* @__PURE__ */ new Map(), this.maxCacheEntries = t, this.counter = 1, this.decompress = r;
  }
  getHeader(t) {
    return h(this, null, function* () {
      let e = t.getKey(), r = this.cache.get(e);
      if (r) return r.lastUsed = this.counter++, yield r.data;
      let n = new Promise((s, i2) => {
        V(t, this.decompress).then((a) => {
          a[1] && this.cache.set(a[1][0], { lastUsed: this.counter++, data: Promise.resolve(a[1][2]) }), s(a[0]), this.prune();
        }).catch((a) => {
          i2(a);
        });
      });
      return this.cache.set(e, { lastUsed: this.counter++, data: n }), n;
    });
  }
  trackSignal(t, e, r) {
    e.refs++, r.addEventListener("abort", () => {
      --e.refs <= 0 && this.pendingFetches.get(t) === e && (e.controller.abort(), this.cache.delete(t), this.pendingFetches.delete(t));
    }, { once: true });
  }
  getDirectory(t, e, r, n, s) {
    return h(this, null, function* () {
      let i2 = `${t.getKey()}|${n.etag || ""}|${e}|${r}`, a = this.cache.get(i2);
      if (a) {
        a.lastUsed = this.counter++;
        let m = this.pendingFetches.get(i2);
        return m && this.trackSignal(i2, m, s != null ? s : new AbortController().signal), yield a.data;
      }
      let c = new AbortController(), l = { controller: c, refs: 0 };
      this.trackSignal(i2, l, s != null ? s : new AbortController().signal), this.pendingFetches.set(i2, l);
      let u = new Promise((m, g) => {
        F(t, this.decompress, e, r, n, c.signal).then((p) => {
          this.pendingFetches.delete(i2), m(p), this.prune();
        }).catch((p) => {
          g(p);
        });
      });
      return this.cache.set(i2, { lastUsed: this.counter++, data: u }), u;
    });
  }
  prune() {
    if (this.cache.size >= this.maxCacheEntries) {
      let t = 1 / 0, e;
      this.cache.forEach((r, n) => {
        r.lastUsed < t && (t = r.lastUsed, e = n);
      }), e && this.cache.delete(e);
    }
  }
  invalidate(t) {
    return h(this, null, function* () {
      let e = t.getKey();
      if (this.invalidations.get(e)) return yield this.invalidations.get(e);
      this.cache.delete(t.getKey());
      let r = new Promise((n, s) => {
        this.getHeader(t).then((i2) => {
          n(), this.invalidations.delete(e);
        }).catch((i2) => {
          s(i2);
        });
      });
      this.invalidations.set(e, r);
    });
  }
};
d(M, "SharedPromiseCache");
var C = M;
var H = class H2 {
  constructor(t, e, r) {
    typeof t == "string" ? this.source = new E(t) : this.source = t, r ? this.decompress = r : this.decompress = P, e ? this.cache = e : this.cache = new C();
  }
  getHeader() {
    return h(this, null, function* () {
      return yield this.cache.getHeader(this.source);
    });
  }
  getZxyAttempt(t, e, r, n) {
    return h(this, null, function* () {
      let s = q(t, e, r), i2 = yield this.cache.getHeader(this.source);
      if (n == null || n.throwIfAborted(), t < i2.minZoom || t > i2.maxZoom) return;
      let a = i2.rootDirectoryOffset, c = i2.rootDirectoryLength;
      for (let l = 0; l <= 3; l++) {
        let u = yield this.cache.getDirectory(this.source, a, c, i2, n);
        n == null || n.throwIfAborted();
        let m = Q(u, s);
        if (m) {
          if (m.runLength > 0) {
            let g = yield this.source.getBytes(i2.tileDataOffset + m.offset, m.length, n, i2.etag);
            return { data: yield this.decompress(g.data, i2.tileCompression), cacheControl: g.cacheControl, expires: g.expires };
          }
          a = i2.leafDirectoryOffset + m.offset, c = m.length;
        } else return;
      }
      throw new Error("Maximum directory depth exceeded");
    });
  }
  getZxy(t, e, r, n) {
    return h(this, null, function* () {
      try {
        return yield this.getZxyAttempt(t, e, r, n);
      } catch (s) {
        if (s instanceof v) return this.cache.invalidate(this.source), yield this.getZxyAttempt(t, e, r, n);
        throw s;
      }
    });
  }
  getMetadataAttempt() {
    return h(this, null, function* () {
      let t = yield this.cache.getHeader(this.source), e = yield this.source.getBytes(t.jsonMetadataOffset, t.jsonMetadataLength, void 0, t.etag), r = yield this.decompress(e.data, t.internalCompression), n = new TextDecoder("utf-8");
      return JSON.parse(n.decode(r));
    });
  }
  getMetadata() {
    return h(this, null, function* () {
      try {
        return yield this.getMetadataAttempt();
      } catch (t) {
        if (t instanceof v) return this.cache.invalidate(this.source), yield this.getMetadataAttempt();
        throw t;
      }
    });
  }
  getTileJson(t) {
    return h(this, null, function* () {
      let e = yield this.getHeader(), r = yield this.getMetadata(), n = _(e.tileType);
      return { tilejson: "3.0.0", scheme: "xyz", tiles: [`${t}/{z}/{x}/{y}${n}`], vector_layers: r.vector_layers, attribution: r.attribution, description: r.description, name: r.name, version: r.version, bounds: [e.minLon, e.minLat, e.maxLon, e.maxLat], center: [e.centerLon, e.centerLat, e.centerZoom], minzoom: e.minZoom, maxzoom: e.maxZoom };
    });
  }
};
d(H, "PMTiles");
var w = H;
export {
  J as Compression,
  v as EtagMismatch,
  E as FetchSource,
  k as FileSource,
  w as PMTiles,
  B as Protocol,
  $ as ResolvedValueCache,
  C as SharedPromiseCache,
  O as TileType,
  X as bytesToHeader,
  Q as findTile,
  y as getUint64,
  re as leafletRasterLayer,
  x2 as readVarint,
  ie as tileIdToZxy,
  _ as tileTypeExt,
  q as zxyToTileId
};
