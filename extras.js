/* The Living Heritage Route: add-on loaded after the main map script.
   1. Replaces the hand-drawn road with road.json (aligned to present-day roads).
   2. Adds photos (Wikimedia Commons, credited) from photos.json.
   3. Adds a "Travellers & images" tab: historical travellers' accounts (travellers.json) and an image gallery. */
(function () {
  var PHOTOS = {}, TRAVEL = {}, tab = "details";

  var css = [
    ".photo img{width:100%;height:100%;object-fit:cover;display:block}",
    ".photo .credit{position:absolute;left:0;right:0;bottom:5px;padding:14px 10px 4px;font:400 10.5px/1.3 var(--body);color:#fff;background:linear-gradient(transparent,rgba(0,0,0,.65));text-align:right}",
    ".photo .credit a{color:#fff}",
    ".photo .cap{position:absolute;left:10px;top:10px;max-width:75%;background:rgba(0,0,0,.6);color:#fff;font:700 10.5px/1.3 var(--body);letter-spacing:.04em;padding:4px 7px}",
    ".tabs{display:flex;gap:0;border-bottom:1px solid var(--line);margin:-2px 0 0}",
    ".tabs button{flex:1;background:none;border:0;border-bottom:2px solid transparent;padding:9px 4px;font:700 11px var(--body);letter-spacing:.12em;text-transform:uppercase;color:var(--muted);cursor:pointer}",
    ".tabs button[aria-selected=true]{color:var(--ink);border-bottom-color:var(--ink)}",
    ".quote{margin:0;padding:0 0 14px;border-bottom:1px solid var(--line)}",
    ".quote blockquote{margin:0 0 8px;font:400 14.5px/1.6 var(--body);font-style:italic}",
    ".quote .who{font:700 12px var(--body)}",
    ".quote .qsrc{font-size:12px;color:var(--muted)}",
    ".gal{display:grid;grid-template-columns:1fr 1fr;gap:8px}",
    ".gal a{position:relative;display:block;aspect-ratio:4/3;overflow:hidden;background:#2b2b2b}",
    ".gal img{width:100%;height:100%;object-fit:cover;display:block}",
    ".gal .h{position:absolute;left:4px;top:4px;background:#111;color:#fff;font:700 9.5px var(--body);letter-spacing:.1em;text-transform:uppercase;padding:2px 5px}",
    ".gal .c{position:absolute;left:0;right:0;bottom:0;padding:10px 6px 3px;font-size:9.5px;line-height:1.25;color:#fff;background:linear-gradient(transparent,rgba(0,0,0,.7))}",
    ".empty-note{font-size:13px;color:var(--muted);margin:0}",
    ".pin.has-travel::after{content:'';position:absolute;right:-1px;top:-1px;width:9px;height:9px;background:#F2C14E;border:1.5px solid #111;border-radius:50%}",
    ".pin{position:relative}"
  ].join("\n");
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  function esc2(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function credit(p) { return (p.artist ? esc2(p.artist) : "Unknown author") + (p.license ? " · " + esc2(p.license) : ""); }

  /* ---------- road ---------- */
  fetch("road.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (gj) {
    if (!gj || !gj.features || !gj.features.length) return;
    var lines = gj.features.map(function (f) { return f.geometry.coordinates.map(function (c) { return [c[1], c[0]]; }); });
    var old = [];
    map.eachLayer(function (l) { if (l instanceof L.Polyline && !(l instanceof L.Polygon)) old.push(l); });
    old.forEach(function (l) { map.removeLayer(l); });
    L.polyline(lines, { color: "#23160a", weight: 7, opacity: .65, interactive: false, lineCap: "round", lineJoin: "round" }).addTo(map);
    L.polyline(lines, { color: "#F2C14E", weight: 3.2, opacity: 1, lineCap: "round", lineJoin: "round" })
      .bindTooltip("Imperial road (Sol Kol), İstanbul – Edirne. Approximate route, aligned to present-day roads.", { sticky: true, className: "road-tip" }).addTo(map);
  }).catch(function () {});

  /* ---------- photos + travellers ---------- */
  function load(url) { return fetch(url, { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }); }
  Promise.all([load("photos.json"), load("travellers.json"), load("positions.json")]).then(function (res) {
    PHOTOS = res[0] || {}; TRAVEL = res[1] || {};
    var POS = res[2] || {}, moved = 0;
    WORKS.forEach(function (w) {
      var p = POS[w.id]; if (!p) return;
      if (typeof p.lat === "number" && typeof p.lon === "number") {
        w.lat = p.lat; w.lon = p.lon;
        var m = markers.get(w.id); if (m) m.setLatLng([p.lat, p.lon]);
        moved++;
      }
      if (p.conf) w.conf = p.conf;
      if (p.note) w.notes = p.note + (w.notes ? " | " + w.notes : "");
    });
    if (moved) apply();
    markTravel();
    if (state.sel != null) renderCard(WORKS.find(function (x) { return x.id === state.sel; }));
  });

  function markTravel() {
    WORKS.forEach(function (w) {
      var m = markers.get(w.id), el = m && m.getElement && m.getElement();
      if (el) el.classList.toggle("has-travel", !!(TRAVEL[w.id] && TRAVEL[w.id].length));
    });
  }
  map.on("zoomend moveend layeradd", markTravel);

  var baseRender = renderCard;
  renderCard = function (w) {
    baseRender(w);
    var card = document.getElementById("card"), p = PHOTOS[w.id];
    var photo = card.querySelector(".photo");
    if (p && p.photo && photo) {
      var ph = photo.querySelector(".ph"); if (ph) ph.remove();
      var img = document.createElement("img"); img.src = p.photo.thumb; img.alt = w.name; img.loading = "lazy";
      photo.insertBefore(img, photo.firstChild);
      var cr = document.createElement("div"); cr.className = "credit";
      cr.innerHTML = '<a href="' + esc2(p.photo.page) + '" target="_blank" rel="noopener">Photo: ' + credit(p.photo) + "</a>";
      photo.appendChild(cr);
      if (p.photo.caption) { var cap = document.createElement("div"); cap.className = "cap"; cap.textContent = p.photo.caption; photo.appendChild(cap); }
    } else if (photo) {
      var t = photo.querySelector(".ph span"); if (t) t.textContent = "No photo available";
    }
    // tabs
    var body = card.querySelector(".cbody"); if (!body) return;
    var head = body.firstElementChild;
    var details = [].slice.call(body.children, 1);
    var tabs = document.createElement("div"); tabs.className = "tabs"; tabs.setAttribute("role", "tablist");
    tabs.innerHTML = '<button type="button" role="tab" data-t="details">Details</button><button type="button" role="tab" data-t="travel">Travellers &amp; images</button>';
    head.after(tabs);
    var pane = document.createElement("div"); pane.className = "travel-pane"; pane.style.display = "grid"; pane.style.gap = "16px";
    pane.innerHTML = travelHTML(w);
    tabs.after(pane);
    function show(which) {
      tab = which;
      details.forEach(function (el) { el.hidden = which !== "details"; });
      pane.hidden = which !== "travel";
      [].forEach.call(tabs.children, function (b) { b.setAttribute("aria-selected", b.dataset.t === which); });
    }
    tabs.addEventListener("click", function (e) { var b = e.target.closest("button"); if (b) show(b.dataset.t); });
    show(tab);
  };

  function travelHTML(w) {
    var out = "", acc = TRAVEL[w.id] || [];
    out += '<div class="sec"><h3>Travellers’ accounts</h3>';
    if (acc.length) {
      out += acc.map(function (a) {
        return '<figure class="quote"><blockquote>“' + esc2(a.quote) + '”</blockquote><figcaption><div class="who">' + esc2(a.traveller) + (a.year ? " · " + esc2(a.year) : "") + '</div><div class="qsrc">' + esc2(a.source) + "</div></figcaption></figure>";
      }).join("");
    } else out += '<p class="empty-note">No accounts added yet for this building.</p>';
    out += "</div>";
    var p = PHOTOS[w.id], imgs = [];
    if (p) { if (p.photo && !p.site) imgs.push(p.photo); imgs = imgs.concat(p.gallery || []); }
    out += '<div class="sec"><h3>Images</h3>';
    if (imgs.length) {
      imgs.sort(function (a, b) { return (b.historic ? 1 : 0) - (a.historic ? 1 : 0); });
      out += '<div class="gal">' + imgs.slice(0, 8).map(function (g) {
        return '<a href="' + esc2(g.page) + '" target="_blank" rel="noopener" title="' + esc2(g.title) + '"><img src="' + esc2(g.thumb) + '" alt="" loading="lazy">' + (g.historic ? '<span class="h">Historic</span>' : "") + '<span class="c">' + credit(g) + "</span></a>";
      }).join("") + "</div>";
    } else out += '<p class="empty-note">No freely licensed images found yet.</p>';
    out += "</div>";
    out += '<div class="actions"><a class="btn" href="https://www.google.com/maps/search/?api=1&query=' + w.lat + "," + w.lon + '" target="_blank" rel="noopener">Visitor photos &amp; reviews on Google Maps ↗</a></div>';
    out += '<p class="empty-note" style="font-size:11.5px">Images from Wikimedia Commons; click an image for its author and licence.</p>';
    return out;
  }
})();
