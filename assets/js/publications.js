/* Shared publications renderer: build HTML with a supplied document, then attach
 * browser controls to the saved markup without replacing the table. */
(function (factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory;
    return;
  }
  var publications = factory(document);
  function init() {
    var root = document.getElementById("pubs");
    if (!root) return;
    try {
      publications.enhance(root);
    } catch (err) {
      console.error("Could not initialize publication controls", err);
      var message = document.createElement("p");
      message.className = "pub-error";
      message.setAttribute("role", "alert");
      message.textContent = "Publication controls are unavailable (" +
        err.message + "). The publications below are still readable.";
      root.prepend(message);
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(function (document) {
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

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
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
    var labels = [];
    var previous = -1;
    entry.authors_raw.forEach(function (a, i) {
      if (entry.abbreviate_authors && i > 1 &&
          i < entry.authors_raw.length - 1 && !YOU_ARE(a)) return;
      if (i > previous + 1) labels.push("...");
      var label = el("span", null, entry.authors[i]).innerHTML;
      labels.push(YOU_ARE(a)
        ? '<strong>' + label + '</strong>'
        : label);
      previous = i;
    });
    return labels.join(", ");
  }

  // ---- global state ----
  // Default column widths (title, year, venue, authors, topics, links).
  // Columns trade width with their neighbour; filtering preserves the columns.
  var DEFAULT_WIDTHS = ["37.5%", "6%", "13.5%", "23%", "10%", "10%"];

  var STATE = { entries: [], rows: [], query: "", activeTags: {}, allTags: [] };

  // "Full" = every topic selected = the neutral "show all" state.
  function topicsFull() {
    return STATE.allTags.length &&
      STATE.allTags.every(function (id) { return STATE.activeTags[id]; });
  }
  function setAllTopics(v) {
    STATE.allTags.forEach(function (id) { STATE.activeTags[id] = v; });
  }
  // Shared toggle used by the legend AND the table emojis, so both stay in
  // lockstep:
  //   - from the neutral all-selected state, toggling one isolates it;
  //   - toggling off the last remaining topic reverts to all-selected;
  //   - otherwise it's a plain add/remove (AND filter).
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
  // Reflect STATE.activeTags into the legend (active class). Called on every
  // render so the legend + table emojis stay in sync.
  function syncTopics(root) {
    var full = topicsFull();
    root.querySelectorAll(".pub-legend-item").forEach(function (item) {
      var id = item.getAttribute("data-tag");
      item.classList.toggle("active", !full && !!STATE.activeTags[id]);
    });
  }

  function matches(entry) {
    // topic filter: AND over the checked topics. The "all checked" default
    // remains neutral.
    // No topic checked = show nothing.
    var anySelected = entry.tags.some(function (t) {
      return STATE.activeTags[t];
    });
    if (!anySelected) return false;
    if (!topicsFull() && !STATE.allTags.every(function (id) {
      return !STATE.activeTags[id] || entry.tags.some(function (t) {
        return t === id;
      });
    })) return false;
    // text query -- match against the full-text blob (every raw bibtex field
    // value + compact venue + tag labels), case-insensitive, all words must hit.
    var q = STATE.query.trim().toLowerCase();
    if (!q) return true;
    return q.split(/\s+/).every(function (w) { return entry.search.indexOf(w) !== -1; });
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

  function buildRows(root) {
    var visible = STATE.entries.filter(function (e) {
      return e.section !== "hidden";
    });

    var tbody = root.querySelector(".pub-table tbody");
    tbody.innerHTML = "";

    var rows = sortEntries(visible);
    rows.forEach(function (e) {
      var tr = el("tr");
      tr.className = "pub-row";
      tr.setAttribute("data-key", e.key);
      tr.setAttribute("data-tags", JSON.stringify(e.tags.map(function (t) { return t.id; })));
      tr.setAttribute("data-search", ((e.search || "") + " " + e.title + " " +
        e.venue + " " + e.authors.join(" ") + " " +
        e.tags.map(function (t) { return t.label; }).join(" ")).toLowerCase());

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
      var tdAuth = el("td", "pub-authors");
      if (e.abbreviate_authors) {
        var abbreviated = el("span", "pub-authors-abbreviated");
        abbreviated.setAttribute("aria-hidden", "true");
        abbreviated.innerHTML = authorsHTML(e);
        tdAuth.appendChild(abbreviated);
        tdAuth.appendChild(el("span", "pub-authors-full",
          "Full author list (visible list abbreviated): " +
          e.authors_raw.map(function (a) {
            return a.first + " " + a.last + (a.equal ? "*" : "");
          }).join(", ")));
      } else {
        tdAuth.innerHTML = authorsHTML(e);
      }
      if (e.authors.some(function (a) { return a.indexOf("*") !== -1; })) {
        var note = el("div", "pub-equal-note");
        note.appendChild(el("small", null, "(* denotes equal contribution)"));
        tdAuth.appendChild(note);
      }
      tr.appendChild(tdAuth);

      // Topics: emojis only (labels are decoded in the legend above the table).
      // Each emoji is clickable (same toggle mechanics as the legend) and
      // carries its own tooltip with just that topic's label.
      var tdTags = el("td", "pub-topics");
      if (e.tags.length) {
        var span = el("span", "pub-topic-emojis");
        e.tags.forEach(function (t) {
          var em = el("span", "pub-topic-emoji", t.emoji);
          em.title = t.label;
          em.setAttribute("data-tag", t.id);
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

    var empty = el("tr", "pub-empty-row");
    empty.hidden = rows.length > 0;
    var td = el("td", "pub-empty", "No publications match the current filters.");
    td.colSpan = 6;
    empty.appendChild(td);
    tbody.appendChild(empty);
    updateCount(root, rows.length, rows.length);
  }

  function filterRows(root) {
    var shown = 0;
    STATE.rows.forEach(function (entry) {
      entry.row.hidden = !matches(entry);
      if (!entry.row.hidden) shown++;
    });
    root.querySelector(".pub-empty-row").hidden = shown > 0;
    updateCount(root, shown, STATE.rows.length);
    syncTopics(root);
  }

  function updateCount(root, shown, total) {
    var c = root.querySelector(".pub-count");
    if (c) c.textContent = shown === total
      ? total + " publications"
      : shown + " of " + total + " publications";
  }

  function buildChrome(root) {
    // controls (single line): search | Clear | count. Topic filtering lives in
    // the clickable legend above + the table emojis (see OLD_dropdown_ variant
    // for the multi-select dropdown version).
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

    // Legend/key above the controls. Clickable (same toggle mechanics as the
    // table emojis); stays in sync via syncTopics on every render.
    var legend = el("div", "pub-legend");
    legend.appendChild(el("span", "pub-legend-label", "topics: "));
    order.forEach(function (id, i) {
      var t = info[id];
      var item = el("span", "pub-legend-item",
        t.emoji + " " + t.label + " (" + counts[id] + ")");
      item.setAttribute("data-tag", id);
      item.title = "filter by " + t.label;
      legend.appendChild(item);
      if (i < order.length - 1) {
        legend.appendChild(document.createTextNode(", "));
      }
    });
    root.appendChild(legend);

    var search = el("input", "pub-search");
    search.type = "search";
    search.placeholder = "Search titles, authors, venues, topics…";
    search.setAttribute("aria-label", "Search publications");
    controls.appendChild(search);

    var reset = el("button", "pub-reset", "Clear");
    reset.type = "button";
    controls.appendChild(reset);
    controls.appendChild(el("span", "pub-count"));

    root.appendChild(controls);

    // table
    var table = el("table", "pub-table");

    // table-layout:fixed in CSS makes these percentages scale with the window.
    var colgroup = el("colgroup");
    DEFAULT_WIDTHS.forEach(function (w) {
      var col = document.createElement("col");
      col.style.width = w;
      colgroup.appendChild(col);
    });
    table.appendChild(colgroup);

    var thead = el("thead");
    var htr = el("tr");
    var labels = ["title", "year", "venue", "authors", "topics", "links"];
    labels.forEach(function (label, idx) {
      var th = el("th", null, label);
      th.scope = "col";
      // drag handle on the right edge of every column but the last; dragging
      // trades width between this column and the next, keeping the sum at 100%.
      if (idx < labels.length - 1) {
        var handle = el("span", "pub-resizer");
        th.appendChild(handle);
      }
      htr.appendChild(th);
    });
    thead.appendChild(htr);
    table.appendChild(thead);
    table.appendChild(el("tbody"));
    root.appendChild(table);
  }

  function bindResizing(root) {
    var table = root.querySelector(".pub-table");
    var cols = Array.from(table.querySelectorAll("col"));
    root.querySelectorAll(".pub-resizer").forEach(function (handle, idx) {
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
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      });
    });
  }

  function build(root, data) {
    STATE.entries = data.entries;
    root.replaceChildren();
    buildChrome(root);
    buildRows(root);
  }

  function enhance(root) {
    if (root.classList.contains("pub-enhanced")) return;
    if (!root.querySelector(".pub-table")) throw new Error("Missing pre-rendered table");
    STATE.rows = Array.from(root.querySelectorAll(".pub-row")).map(function (row) {
      return { row: row, tags: JSON.parse(row.getAttribute("data-tags")),
        search: row.getAttribute("data-search") };
    });
    STATE.allTags = Array.from(root.querySelectorAll(".pub-legend-item")).map(function (item) {
      return item.getAttribute("data-tag");
    });
    STATE.query = "";
    STATE.activeTags = {};
    setAllTopics(true);

    root.querySelectorAll("[data-tag]").forEach(function (item) {
      item.setAttribute("role", "button");
      item.tabIndex = 0;
      var toggle = function () {
        toggleTopic(item.getAttribute("data-tag"));
        filterRows(root);
      };
      item.addEventListener("click", toggle);
      item.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); toggle(); }
      });
    });
    var search = root.querySelector(".pub-search");
    search.value = "";
    search.addEventListener("input", function () {
      STATE.query = search.value;
      filterRows(root);
    });
    root.querySelector(".pub-reset").addEventListener("click", function () {
      STATE.query = "";
      search.value = "";
      setAllTopics(true);
      filterRows(root);
    });
    bindResizing(root);
    root.classList.add("pub-enhanced");
  }

  return { build: build, enhance: enhance };
});
