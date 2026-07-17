/* Publications widget: renders a filterable table from
 * assets/publications.json. Framework-agnostic vanilla JS + Font Awesome /
 * Academicons (both already loaded site-wide). Mount with:
 *   <div id="pubs" data-src="/assets/publications.json"></div>
 *   <script src="/assets/js/publications.js"></script>
 */
(function () {
  "use strict";

  // link type -> icon. Prefer academicons (ai) for scholarly stuff, else FA.
  // {cls: icon classes, title: hover label}
  var ICONS = {
    paper:   { cls: "fas fa-file-lines", title: "Paper" },
    arxiv:   { cls: "ai ai-arxiv",       title: "arXiv" },
    pdf:     { cls: "fas fa-file-pdf",   title: "PDF" },
    code:    { cls: "fab fa-github",     title: "Code" },
    webpage: { cls: "fas fa-house",      title: "Project page" },
    slides:  { cls: "fas fa-desktop",    title: "Slides" },
    poster:  { cls: "fas fa-image",      title: "Poster" },
    video:   { cls: "fas fa-video",      title: "Video" },
    dataset: { cls: "fas fa-database",   title: "Dataset" },
    blog:    { cls: "fas fa-pen-nib",    title: "Blog" }
  };

  // author names matching these get bolded (it's *your* page)
  var ME = { last: "davies", first: "a" };

  var YOU_ARE = function (a) {
    return a.last.toLowerCase() === ME.last &&
           a.first.toLowerCase().charAt(0) === ME.first;
  };

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function iconLink(link) {
    var meta = ICONS[link.type] || { cls: "fas fa-link", title: link.type };
    var a = el("a", "pub-link");
    a.href = link.url;
    a.target = "_blank";
    a.rel = "noopener";
    a.title = meta.title;
    a.setAttribute("aria-label", meta.title);
    a.appendChild(el("i", meta.cls));
    return a;
  }

  function authorsHTML(entry) {
    return entry.authors_raw.map(function (a, i) {
      var label = entry.authors[i];
      return YOU_ARE(a)
        ? '<strong>' + label + '</strong>'
        : label;
    }).join(", ");
  }

  // ---- global state ----
  // Default column widths (title, year, venue, authors, topics, links).
  // Columns are drag-resizable in the browser (widths trade with the neighbour,
  // sum stays 100%); the resized set lives only in STATE.widths for the session.
  var DEFAULT_WIDTHS = ["37.5%", "6%", "13.5%", "23%", "10%", "10%"];

  var STATE = { entries: [], legend: {}, query: "", activeTags: {}, allTags: [], widths: DEFAULT_WIDTHS.slice() };

  // "Full" = every topic selected = the neutral "show all" state.
  function topicsFull() {
    return STATE.allTags.length &&
      STATE.allTags.every(function (id) { return STATE.activeTags[id]; });
  }
  function setAllTopics(v) {
    STATE.allTags.forEach(function (id) { STATE.activeTags[id] = v; });
  }
  // Shared toggle used by the legend, the table emojis, AND the dropdown, so
  // all three stay in lockstep:
  //   - from the neutral all-selected state, toggling one isolates it;
  //   - toggling off the last remaining topic reverts to all-selected;
  //   - otherwise it's a plain add/remove (OR filter).
  function toggleTopic(id) {
    if (topicsFull()) {
      setAllTopics(false);
      STATE.activeTags[id] = true;
    } else if (STATE.activeTags[id]) {
      STATE.activeTags[id] = false;
      if (STATE.allTags.every(function (k) { return !STATE.activeTags[k]; })) {
        setAllTopics(true);
      }
    } else {
      STATE.activeTags[id] = true;
    }
  }
  // Reflect STATE.activeTags into the legend (active class) and the dropdown
  // (checkboxes + caption). Called on every render so everything auto-syncs.
  function syncTopics(root) {
    var full = topicsFull();
    root.querySelectorAll(".pub-legend-item").forEach(function (item) {
      var id = item.getAttribute("data-tag");
      item.classList.toggle("active", !full && !!STATE.activeTags[id]);
    });
    root.querySelectorAll(".pub-ms-opt input").forEach(function (b) {
      b.checked = !!STATE.activeTags[b.getAttribute("data-tag")];
    });
    var n = STATE.allTags.filter(function (id) { return STATE.activeTags[id]; }).length;
    var cap = root.querySelector(".pub-ms-cap");
    if (cap) cap.textContent = "topics: " + (n === STATE.allTags.length ? "all" : (n + " selected"));
  }

  function matches(entry) {
    // topic filter: OR over the checked topics. The "all checked" default is
    // neutral (every visible paper has >=1 tag, so OR-over-all includes all).
    // No topic checked = show nothing.
    var anySelected = entry.tags.some(function (t) {
      return STATE.activeTags[t.id];
    });
    if (!anySelected) return false;
    // text query -- match against the full-text blob (every raw bibtex field
    // value + compact venue + tag labels), case-insensitive, all words must hit.
    var q = STATE.query.trim().toLowerCase();
    if (!q) return true;
    var hay = (entry.search || "") + " " +
              entry.title + " " + entry.venue + " " +
              entry.authors.join(" ") + " " +
              entry.tags.map(function (t) { return t.label; }).join(" ");
    hay = hay.toLowerCase();
    return q.split(/\s+/).every(function (w) { return hay.indexOf(w) !== -1; });
  }

  // always sorted by year desc, then month desc, then conferences before
  // workshops (is_workshop asc), then title (stable tiebreak)
  function sortEntries(list) {
    return list.slice().sort(function (a, b) {
      if (a.year !== b.year) return b.year - a.year;
      if ((a.month || 0) !== (b.month || 0)) return (b.month || 0) - (a.month || 0);
      var aw = a.is_workshop ? 1 : 0, bw = b.is_workshop ? 1 : 0;
      if (aw !== bw) return aw - bw;
      return a.title.toLowerCase() < b.title.toLowerCase() ? -1 : 1;
    });
  }

  function render(root) {
    var visible = STATE.entries.filter(function (e) {
      return e.section !== "hidden";
    });

    var tbody = root.querySelector(".pub-table tbody");
    tbody.innerHTML = "";

    var rows = sortEntries(visible.filter(matches));
    if (!rows.length) {
      var tr = el("tr");
      var td = el("td", "pub-empty");
      td.colSpan = 6;
      td.textContent = "No publications match the current filters.";
      tr.appendChild(td);
      tbody.appendChild(tr);
    }

    rows.forEach(function (e) {
      var tr = el("tr");
      tr.className = "pub-row";

      // Title (+ optional note)
      var tdTitle = el("td", "pub-title");
      tdTitle.appendChild(el("span", "pub-title-text", e.title));
      if (e.notes) {
        tdTitle.appendChild(el("div", "pub-note", e.notes));
      }
      tr.appendChild(tdTitle);

      // Year
      tr.appendChild(el("td", "pub-year", String(e.year)));

      // Venue
      tr.appendChild(el("td", "pub-venue", e.venue || ""));

      // Authors (+ equal-contribution note when any author is starred)
      var tdAuth = el("td", "pub-authors", authorsHTML(e));
      if (e.authors.some(function (a) { return a.indexOf("*") !== -1; })) {
        tdAuth.appendChild(el("div", "pub-equal-note",
          "<small>(* denotes equal contribution)</small>"));
      }
      tr.appendChild(tdAuth);

      // Topics: emojis only (labels are decoded in the legend above the table).
      // Each emoji is clickable (same toggle mechanics as legend + dropdown) and
      // carries its own tooltip with just that topic's label.
      var tdTags = el("td", "pub-topics");
      if (e.tags.length) {
        var span = el("span", "pub-topic-emojis");
        e.tags.forEach(function (t) {
          var em = el("span", "pub-topic-emoji", t.emoji);
          em.title = t.label;
          em.setAttribute("role", "button");
          em.tabIndex = 0;
          em.addEventListener("click", function () {
            toggleTopic(t.id); render(root);
          });
          em.addEventListener("keydown", function (ev) {
            if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); toggleTopic(t.id); render(root); }
          });
          span.appendChild(em);
        });
        tdTags.appendChild(span);
      }
      tr.appendChild(tdTags);

      // Links
      var tdLinks = el("td", "pub-links");
      e.links.forEach(function (l) { tdLinks.appendChild(iconLink(l)); });
      tr.appendChild(tdLinks);

      tbody.appendChild(tr);
    });

    updateCount(root, rows.length, visible.length);
    syncTopics(root);
  }

  function updateCount(root, shown, total) {
    var c = root.querySelector(".pub-count");
    if (c) c.textContent = shown === total
      ? total + " publications"
      : shown + " of " + total + " publications";
  }

  // Checkbox-popover multi-select for topics (M365-explorer style). Uses the
  // shared toggleTopic mechanics so it stays in sync with the legend + table.
  //   - "select all" / "clear" at the top, then each topic (emoji + label +
  //     count) ordered by count desc.
  //   - Default: every topic checked = neutral = show all.
  function buildTopicDropdown(root, order, info, counts) {
    var wrap = el("div", "pub-ms");

    var btn = el("button", "pub-ms-btn");
    btn.type = "button";
    var cap = el("span", "pub-ms-cap", "topics: all");
    btn.appendChild(cap);
    btn.appendChild(el("span", "pub-ms-chev", "▾"));
    wrap.appendChild(btn);

    var pop = el("div", "pub-ms-pop");
    var tools = el("div", "pub-ms-tools");
    var selAll = el("a", "pub-ms-tool", "select all");
    var clr = el("a", "pub-ms-tool", "clear");
    selAll.setAttribute("role", "button"); selAll.tabIndex = 0;
    clr.setAttribute("role", "button"); clr.tabIndex = 0;
    tools.appendChild(selAll);
    tools.appendChild(clr);
    pop.appendChild(tools);

    order.forEach(function (id) {
      var t = info[id];
      var lab = el("label", "pub-ms-opt");
      var box = document.createElement("input");
      box.type = "checkbox";
      box.setAttribute("data-tag", id);
      box.addEventListener("change", function () {
        toggleTopic(id);
        render(root);
      });
      lab.appendChild(box);
      lab.appendChild(el("span", "pub-ms-opt-label", t.emoji + " " + t.label));
      lab.appendChild(el("span", "pub-ms-n", String(counts[id])));
      pop.appendChild(lab);
    });
    wrap.appendChild(pop);

    btn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      wrap.classList.toggle("open");
    });
    pop.addEventListener("click", function (ev) { ev.stopPropagation(); });

    selAll.addEventListener("click", function () { setAllTopics(true); render(root); });
    clr.addEventListener("click", function () { setAllTopics(false); render(root); });

    return wrap;
  }

  function buildChrome(root) {
    // controls (single line): topics dropdown | search | Clear | count
    var controls = el("div", "pub-controls");

    // Tally topic counts over visible papers; order by count desc (then A-Z).
    var counts = {};
    var info = {};
    STATE.entries.forEach(function (e) {
      if (e.section === "hidden") return;
      e.tags.forEach(function (t) {
        counts[t.id] = (counts[t.id] || 0) + 1;
        info[t.id] = t;
      });
    });
    var order = Object.keys(counts).sort(function (a, b) {
      if (counts[b] !== counts[a]) return counts[b] - counts[a];   // count desc
      return info[a].label.localeCompare(info[b].label);           // then A-Z
    });

    // default: every topic selected (neutral = show all)
    STATE.allTags = order.slice();
    STATE.activeTags = {};
    setAllTopics(true);

    // Legend/key above the controls. Clickable (same toggle mechanics as the
    // dropdown + table emojis); stays in sync via syncTopics on every render.
    var legend = el("div", "pub-legend");
    legend.appendChild(el("span", "pub-legend-label", "topics: "));
    order.forEach(function (id, i) {
      var t = info[id];
      var item = el("span", "pub-legend-item",
        t.emoji + " " + t.label + " (" + counts[id] + ")");
      item.setAttribute("data-tag", id);
      item.setAttribute("role", "button");
      item.tabIndex = 0;
      item.title = "filter by " + t.label;
      var toggle = function () { toggleTopic(id); render(root); };
      item.addEventListener("click", toggle);
      item.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); toggle(); }
      });
      legend.appendChild(item);
      if (i < order.length - 1) {
        legend.appendChild(document.createTextNode(", "));
      }
    });
    root.appendChild(legend);

    controls.appendChild(buildTopicDropdown(root, order, info, counts));

    var search = el("input", "pub-search");
    search.type = "search";
    search.placeholder = "Search titles, authors, venues, topics…";
    search.addEventListener("input", function () {
      STATE.query = search.value;
      render(root);
    });
    controls.appendChild(search);

    var reset = el("button", "pub-reset", "Clear");
    reset.type = "button";
    reset.addEventListener("click", function () {
      STATE.query = "";
      search.value = "";
      setAllTopics(true);
      render(root);
    });
    controls.appendChild(reset);
    controls.appendChild(el("span", "pub-count"));

    root.appendChild(controls);

    // close any open dropdown when clicking elsewhere
    document.addEventListener("click", function () {
      var open = root.querySelector(".pub-ms.open");
      if (open) open.classList.remove("open");
    });

    // table
    var table = el("table", "pub-table");

    // Column widths come from STATE.widths (defaults in DEFAULT_WIDTHS).
    // table-layout:fixed in CSS makes these percentages scale with the window.
    var colgroup = el("colgroup");
    var cols = STATE.widths.map(function (w) {
      var col = document.createElement("col");
      col.style.width = w;
      colgroup.appendChild(col);
      return col;
    });
    table.appendChild(colgroup);

    var thead = el("thead");
    var htr = el("tr");
    var labels = ["title", "year", "venue", "authors", "topics", "links"];
    labels.forEach(function (label, idx) {
      var th = el("th", null, label);
      // drag handle on the right edge of every column but the last; dragging
      // trades width between this column and the next, keeping the sum at 100%.
      if (idx < labels.length - 1) {
        var handle = el("span", "pub-resizer");
        handle.addEventListener("mousedown", function (ev) {
          ev.preventDefault();
          var tableW = table.getBoundingClientRect().width;
          var startX = ev.clientX;
          var leftPct = parseFloat(cols[idx].style.width);
          var rightPct = parseFloat(cols[idx + 1].style.width);
          var sum = leftPct + rightPct;
          document.body.classList.add("pub-resizing");
          var onMove = function (e) {
            var dPct = ((e.clientX - startX) / tableW) * 100;
            var nl = Math.min(Math.max(leftPct + dPct, 3), sum - 3);
            cols[idx].style.width = nl + "%";
            cols[idx + 1].style.width = (sum - nl) + "%";
          };
          var onUp = function () {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
            document.body.classList.remove("pub-resizing");
            STATE.widths = cols.map(function (c) { return c.style.width; });
          };
          document.addEventListener("mousemove", onMove);
          document.addEventListener("mouseup", onUp);
        });
        th.appendChild(handle);
      }
      htr.appendChild(th);
    });
    thead.appendChild(htr);
    table.appendChild(thead);
    table.appendChild(el("tbody"));
    root.appendChild(table);
  }

  function init() {
    var root = document.getElementById("pubs");
    if (!root) return;
    var src = root.getAttribute("data-src") || "/assets/publications.json";
    fetch(src, { cache: "no-cache" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        STATE.entries = data.entries || [];
        STATE.legend = data.tag_legend || {};
        buildChrome(root);
        render(root);
      })
      .catch(function (err) {
        root.innerHTML = '<p class="pub-error">Could not load publications (' +
          err.message + ').</p>';
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
