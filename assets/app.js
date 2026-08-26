// ============================================================
//  三只蒋蒋 · 打卡小站 主逻辑
//  用 GitHub 仓库本身当"数据库"：data/db.json + images/ 目录
// ============================================================
(function () {
  'use strict';

  var cfg = window.JJJ_CONFIG;
  var MASCOTS = window.MASCOTS;
  var ICONS = window.ICONS;

  var API = 'https://api.github.com';
  var RAW = 'https://raw.githubusercontent.com';

  // ---------- 工具 ----------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function h(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function fmtLocal(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function todayStr() { return fmtLocal(new Date()); }
  function parseDate(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function rawUrl(path) { return RAW + '/' + cfg.owner + '/' + cfg.repo + '/' + cfg.branch + '/' + path; }
  function memberById(id) { return cfg.members.filter(function (m) { return m.id === id; })[0]; }
  function memberName(id) { var m = memberById(id); return m ? m.name : id; }
  function currentMember() { return memberById(state.currentUserId); }

  // ---------- 状态 ----------
  var state = {
    currentUserId: localStorage.getItem('jjj_user') || null,
    db: null,
    viewDate: todayStr(),
    viewMonth: new Date(),
    working: null,          // { memberId, list: [{id,title}] }
    projEditIdx: -1,
    pendingUpload: null,    // { memberId, projectId, dataUrl, ext }
    pendingAvatar: null,    // { dataUrl, ext }
    pendingMood: null,
    pendingMessage: '',
    pendingCustomMood: null,
    pendingWallImage: null,
    page: 'home',
    foodRotation: 0,
    retry: null,
    saving: false
  };

  function emptyDb() {
    return {
      schema: 1,
      members: {
        jiangjiang1: { avatar: null },
        jiangjiang2: { avatar: null },
        jiangjiang3: { avatar: null }
      },
      projects: [],
      checkins: {}, plans: {}, comments: [], wallPosts: [], foodOptions: [], accounts: {}
    };
  }
  function normalizeDb() {
    var db = state.db || (state.db = emptyDb());
    db.members = db.members || {};
    cfg.members.forEach(function (m) { db.members[m.id] = db.members[m.id] || { avatar: null }; });
    db.projects = Array.isArray(db.projects) ? db.projects : [];
    db.checkins = db.checkins || {};
    db.plans = db.plans || {};
    db.comments = Array.isArray(db.comments) ? db.comments : [];
    db.wallPosts = Array.isArray(db.wallPosts) ? db.wallPosts : [];
    db.foodOptions = Array.isArray(db.foodOptions) ? db.foodOptions : [];
    db.accounts = db.accounts || {};
  }

  // ---------- GitHub 存储层 ----------
  function getToken() { return localStorage.getItem('jjj_token') || cfg.bakedToken || ''; }
  function utf8ToB64(s) { return btoa(unescape(encodeURIComponent(s))); }
  function b64ToUtf8(b) { return decodeURIComponent(escape(atob(b))); }

  async function ghError(res) {
    var msg = 'GitHub 请求失败 (' + res.status + ')';
    try { var j = await res.json(); if (j && j.message) msg = j.message; } catch (e) { }
    return new Error(msg);
  }

  async function apiGet(path) {
    var url = API + '/repos/' + cfg.owner + '/' + cfg.repo + '/contents/' + path + '?ref=' + cfg.branch;
    var headers = { 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    var t = getToken(); if (t) headers.Authorization = 'Bearer ' + t;
    var res = await fetch(url, { headers: headers, cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) throw await ghError(res);
    var j = await res.json();
    return { sha: j.sha, content: j.content };
  }

  async function apiPut(path, contentBase64, message, sha) {
    var t = getToken();
    if (!t) throw new Error('NO_TOKEN');
    var url = API + '/repos/' + cfg.owner + '/' + cfg.repo + '/contents/' + path;
    var body = { message: message, branch: cfg.branch, content: contentBase64 };
    if (sha) body.sha = sha;
    var res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + t, 'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw await ghError(res);
    return await res.json();
  }

  async function loadDb(force) {
    var json = null;
    // 优先走仓库 API（新鲜、不经 CDN 缓存），失败再退回 raw
    try {
      var api = await apiGet('data/db.json');
      if (api && api.content) json = JSON.parse(b64ToUtf8(api.content.replace(/\n/g, '')));
    } catch (e) {
      console.warn('apiGet 失败，回退 raw', e);
    }
    if (json == null) {
      try {
        var res = await fetch(rawUrl('data/db.json') + (force ? '?t=' + Date.now() : ''), { cache: 'no-store' });
        if (res.ok) json = await res.json();
      } catch (e) {
        console.warn('raw 读取失败', e);
      }
    }
    state.db = json || emptyDb();
    normalizeDb();
  }

  async function saveDb(message) {
    var cur = await apiGet('data/db.json');
    var sha = cur ? cur.sha : null;
    await apiPut('data/db.json', utf8ToB64(JSON.stringify(state.db, null, 2)), message, sha);
  }

  async function uploadImage(path, dataUrl, message) {
    var b64 = dataUrl.split(',')[1];
    await apiPut(path, b64, message, null);
  }

  // 需要密令的操作：没密令就先弹出引导，连好后自动重试
  function needToken(fn) {
    if (getToken()) { fn(); return; }
    state.retry = fn;
    openTokenModal();
  }

  // ---------- 业务辅助 ----------
  function memberDayStatus(dateStr, memberId) {
    var db = state.db; if (!db) return { done: 0, total: 0, all: false };
    var day = db.checkins[dateStr];
    var ck = day && day[memberId];
    var items = (ck && ck.items) || {};
    var projects = (db.projects || []).filter(function (p) { return p.member === memberId; });
    var done = 0;
    projects.forEach(function (p) { if (items[p.id] && items[p.id].done) done++; });
    return { done: done, total: projects.length, all: projects.length > 0 && done === projects.length };
  }
  function projectById(id) {
    return (state.db.projects || []).filter(function (p) { return p.id === id; })[0];
  }
  function projectsForDay(memberId, dateStr) {
    var plan = state.db.plans[dateStr] && state.db.plans[dateStr][memberId];
    if (dateStr > todayStr() && Array.isArray(plan)) return plan;
    return state.db.projects.filter(function (p) { return p.member === memberId; });
  }
  function ensureDay(memberId, dateStr) {
    var ds = dateStr || todayStr();
    state.db.checkins[ds] = state.db.checkins[ds] || {};
    state.db.checkins[ds][memberId] = state.db.checkins[ds][memberId] || {};
    state.db.checkins[ds][memberId].items = state.db.checkins[ds][memberId].items || {};
  }

  // ---------- 头像 / 吉祥物 ----------
  function avatarSrc(member) {
    var av = state.db && state.db.members && state.db.members[member.id] && state.db.members[member.id].avatar;
    return av ? rawUrl(av) : null;
  }
  function avatarHTML(member, size) {
    var src = avatarSrc(member);
    if (src) return '<img src="' + h(src) + '" alt="' + h(member.name) + '"/>';
    return MASCOTS[member.mascot](size || 40);
  }
  function miniAvatar(member) {
    var src = avatarSrc(member);
    if (src) return '<img src="' + h(src) + '" alt=""/>';
    return MASCOTS[member.mascot](20);
  }

  // ---------- 提示 ----------
  function toast(msg) {
    var root = $('#toastRoot');
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(function () { el.style.opacity = '0'; el.style.transition = 'opacity .4s ease'; }, 2800);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 3300);
  }

  // ---------- 弹窗 ----------
  function openModal(html, wide) {
    $('#modalRoot').innerHTML =
      '<div class="modal-backdrop" data-act="backdrop-close">' +
      '<div class="modal' + (wide ? ' wide' : '') + '" data-act="modal-stop">' + html + '</div>' +
      '</div>';
  }
  function closeModal() { $('#modalRoot').innerHTML = ''; }

  function modalHead(title, iconHTML) {
    return '<div class="modal-head"><div class="modal-title">' + (iconHTML || '') + h(title) + '</div>' +
      '<button class="icon-btn" data-act="modal-close">' + ICONS.close() + '</button></div>';
  }

  // ============================================================
  //  渲染
  // ============================================================
  function renderBrand() {
    $('#brandLogo').innerHTML = '<span style="display:inline-flex;width:34px;height:34px;">' + MASCOTS.chick(34) + '</span>';
  }

  function renderTopbar() {
    var btn = $('#loginBtn');
    var menu = $('#userMenu');
    var m = currentMember();
    if (m) {
      btn.dataset.act = 'menu-toggle';
      btn.innerHTML = '<span class="avatar">' + avatarHTML(m, 34) + '</span><span>' + h(m.name) + '</span><span style="color:var(--ink-faint)">▾</span>';
      menu.innerHTML =
        '<button data-act="menu-profile">' + ICONS.camera() + ' 个人中心</button>' +
        '<button data-act="menu-switch">' + ICONS.swap() + ' 切换账号</button>' +
        '<button data-act="menu-token">' + ICONS.key() + ' 连接仓库 / 密令</button>' +
        '<button data-act="logout">' + ICONS.logout() + ' 退出登录</button>';
    } else {
      btn.dataset.act = 'login';
      btn.innerHTML = ICONS.lock() + ' 登录';
      menu.innerHTML = '';
      menu.style.display = 'none';
    }
  }

  function renderMascots() {
    $('#mascotRow').innerHTML = cfg.members.map(function (m) {
      return '<div class="mascot-card" data-act="mascot" data-mid="' + m.id + '">' +
        '<span class="edit-badge">' + ICONS.setting() + '</span>' +
        '<span class="avatar">' + MASCOTS[m.mascot](84) + '</span>' +
        '<span class="mname">' + h(m.name) + '</span>' +
        '<span class="mtip">点击设置打卡项目</span>' +
        '</div>';
    }).join('');
  }

  function renderCalendar() {
    var d = state.viewMonth || new Date();
    var y = d.getFullYear(), mon = d.getMonth();
    $('#calTitle').textContent = (mon + 1) + '月';
    $('#calYear').textContent = y + '年';
    $('#calWeek').innerHTML = ['日', '一', '二', '三', '四', '五', '六'].map(function (w) { return '<div>' + w + '</div>'; }).join('');

    var first = new Date(y, mon, 1);
    var start = new Date(y, mon, 1 - first.getDay());
    var today = todayStr();
    var html = '';
    for (var i = 0; i < 42; i++) {
      var dd = new Date(start); dd.setDate(start.getDate() + i);
      var ds = fmtLocal(dd);
      var inMonth = dd.getMonth() === mon;
      var isToday = ds === today;
      var sel = ds === state.viewDate ? ' selected' : '';
      var weekend = (dd.getDay() === 0 || dd.getDay() === 6) ? ' weekend' : '';
      html +=
        '<div class="cal-cell' + (inMonth ? '' : ' out') + (isToday ? ' today' : '') + sel + ' clickable" data-act="cal-day" data-date="' + ds + '">' +
        '<div class="cal-num' + weekend + '">' + dd.getDate() + '</div>' +
        '<div class="mini-avatars">' + miniAvatarsHTML(ds) + '</div>' +
        '</div>';
    }
    $('#calGrid').innerHTML = html;
  }

  function miniAvatarsHTML(ds) {
    return cfg.members.map(function (m) {
      var st = memberDayStatus(ds, m.id);
      if (st.done === 0) return '';
      return '<span class="mini-avatar ' + (st.all ? 'lit' : 'dim') + '" title="' + h(m.name) + '">' + miniAvatar(m) + '</span>';
    }).join('');
  }

  function renderBoard() {
    var ds = state.viewDate;
    var d = parseDate(ds);
    var isToday = ds === todayStr(), isFuture = ds > todayStr();
    $('#boardDate').textContent = d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 星期' + '日一二三四五六'[d.getDay()];
    $('#boardBadge').innerHTML = isToday ? '<span class="badge-today">今天</span>' : '<span class="badge-history">' + (isFuture ? '未来 · 计划' : '历史 · 只读') + '</span>';
    $('#boardHint').textContent = isToday ? '只能给「自己」的打勾噢 ✿' : (isFuture ? '点头像或「设置计划」来安排这一天 ✿' : '点击内容可以留下评论');
    $('#columns').innerHTML = cfg.members.map(function (m) { return columnHTML(m, ds); }).join('');
  }

  function columnHTML(member, ds) {
    var checkin = state.db.checkins[ds] && state.db.checkins[ds][member.id];
    var items = (checkin && checkin.items) || {};
    var projects = projectsForDay(member.id, ds)
      .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    var isToday = ds === todayStr(), isFuture = ds > todayStr();
    var self = state.currentUserId === member.id;
    var mood = checkin && checkin.mood;
    var message = checkin && checkin.message;
    var done = 0;
    projects.forEach(function (p) { if (items[p.id] && items[p.id].done) done++; });
    var total = projects.length;
    var pct = total ? Math.round(done / total * 100) : 0;

    var rows;
    if (total === 0) {
      rows = '<div class="col-empty">还没有打卡项目～<br/>点上方的小可爱来添加吧</div>';
    } else {
      rows = projects.map(function (p) {
        var it = items[p.id];
        var before = isToday && self && state.currentUserId;
        var cls;
        if (before && it) cls = 'ck on';
        else if (before) cls = 'ck';
        else cls = 'ck locked';
        var ck = '<button class="' + cls + '" data-act="check" data-mid="' + member.id + '" data-pid="' + p.id + '">' + ICONS.check() + '</button>';
        var view = it && it.image ? '<button class="view-btn" data-act="view" data-img="' + h(it.image) + '" data-title="' + h(p.title) + '">' + ICONS.eye() + ' 查看</button>' : '';
        var comment = (!isFuture && (it || p)) ? '<button class="tiny-comment" data-act="comment" data-target="checkin" data-mid="' + member.id + '" data-date="' + ds + '" data-pid="' + p.id + '" title="评论">💬</button>' : '';
        return '<div class="project-row' + (it ? ' done' : '') + '">' + ck + '<div class="ptitle">' + h(p.title) + '</div>' + view + comment + '</div>';
      }).join('');
    }

    var moodPart = mood ? '<button class="col-mood" data-act="comment" data-target="mood" data-mid="' + member.id + '" data-date="' + ds + '" title="点击评论心情">' + h(typeof mood === 'object' ? mood.emoji : mood) + '</button>'
      : '<div class="col-mood muted" style="font-size:.8rem">还没设置心情</div>';
    var msg = message ? '<button class="col-msg" data-act="comment" data-target="message" data-mid="' + member.id + '" data-date="' + ds + '" title="点击评论留言">' + h(message) + ' <small>💬</small></button>'
      : '<div class="col-msg empty">今天还没有留言～</div>';
    var quick = (isToday && self)
      ? '<div style="text-align:center;margin:2px 0 8px;"><button class="view-btn" data-act="quick-status">' + ICONS.edit() + ' 设置今日状态</button></div>'
      : (isFuture && state.currentUserId ? '<div style="text-align:center;margin:2px 0 8px;"><button class="view-btn" data-act="plan-open" data-mid="' + member.id + '">✎ 设置计划</button></div>' : '');

    return '<div class="column" style="--col:' + member.color + ';--soft:' + member.soft + '">' +
      '<div class="col-head">' +
      '<div class="avatar" data-act="' + (isFuture ? 'plan-open' : 'col-avatar') + '" data-mid="' + member.id + '" title="' + (isFuture ? '设置未来计划' : '设置打卡项目') + '">' + avatarHTML(member, 66) + '</div>' +
      '<div class="cname">' + h(member.name) + '</div>' +
      '<div class="cg">' + (isFuture ? '点头像设置计划' : '点头像设置项目') + '</div>' +
      moodPart +
      '</div>' +
      msg + quick +
      '<div class="col-list">' + rows + '</div>' +
      '<div class="col-progress">' +
      '<div class="progress-track"><div class="progress-fill" style="width:' + pct + '%"></div></div>' +
      '<div class="progress-label">' + done + '/' + total + ' 完成' + (total && done === total ? ' · 今天点亮 ✨' : '') + '</div>' +
      '</div></div>';
  }

  function renderAll() {
    renderTopbar();
    renderMascots();
    renderCalendar();
    renderBoard();
    renderWall();
    renderFood();
    renderAccount();
  }

  function showPage(page) {
    state.page = page;
    $('#homePage').hidden = page !== 'home'; $('#foodPage').hidden = page !== 'food'; $('#accountPage').hidden = page !== 'account';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function renderWall() {
    var root = $('#stickerWall'); if (!root) return;
    var posts = state.db.wallPosts.slice().sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
    root.innerHTML = posts.length ? posts.map(function (p, i) {
      var m = memberById(p.author);
      return '<article class="sticker s' + (i % 5) + '"><div class="sticker-pin">✿</div><div class="sticker-meta">' + h(m ? m.name : p.author) + ' · ' + h((p.at || '').replace('T', ' ').slice(0, 16)) + ' ' + h(p.mood || '') + '</div><div class="sticker-text">' + h(p.text) + '</div>' + (p.image ? '<img src="' + h(rawUrl(p.image)) + '" alt="留言照片"/>' : '') + '<button class="tiny-comment" data-act="comment" data-target="wall" data-mid="' + h(p.author) + '" data-wallid="' + h(p.id) + '" title="评论">💬 ' + commentCount('wall', p.id) + '</button></article>';
    }).join('') : '<div class="col-empty">还没有贴纸，来留下第一张吧～</div>';
  }
  function commentCount(type, id) { return state.db.comments.filter(function (c) { return c.target && c.target.type === type && c.target.id === id; }).length; }
  function renderFood() {
    var root = $('#foodOptions'), wheel = $('#foodWheel'); if (!root || !wheel) return;
    var opts = state.db.foodOptions;
    root.innerHTML = opts.length ? opts.map(function (o) { return '<div class="food-option">' + h(o.name) + '<button data-act="food-delete" data-id="' + h(o.id) + '">×</button></div>'; }).join('') : '<div class="col-empty">先添加几个想吃的吧～</div>';
    var colors = ['#ffd2b4','#cceedd','#ddd3ff','#ffe6a9','#ffc9dc','#bfe9ef'];
    var bg = opts.length ? 'conic-gradient(' + opts.map(function (o, i) { var a = i * 360 / opts.length, b = (i + 1) * 360 / opts.length; return colors[i % colors.length] + ' ' + a + 'deg ' + b + 'deg'; }).join(',') + ')' : '#f1edfb';
    wheel.style.background = bg; wheel.style.transform = 'rotate(' + state.foodRotation + 'deg)';
    var b = $('button', wheel); if (b) b.style.transform = 'rotate(' + (-state.foodRotation) + 'deg)';
  }
  function renderAccount() {
    var root = $('#accountContent'); if (!root) return;
    var mid = state.currentUserId; if (!mid) { root.innerHTML = '<div class="empty-state"><div class="empty-emoji">🔐</div><b>这是每个人自己的小账本</b><p>登录后才会显示并管理你的收支记录。</p><button class="btn btn-primary" data-act="account-login">选择账号登录</button></div>'; return; }
    var list = (state.db.accounts[mid] || []).slice().sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
    var income = list.filter(function(x){return x.type==='income';}).reduce(function(s,x){return s + (+x.amount||0);},0), expense = list.filter(function(x){return x.type!=='income';}).reduce(function(s,x){return s + (+x.amount||0);},0);
    root.innerHTML = '<div class="account-summary"><div>收入<b>¥' + income.toFixed(2) + '</b></div><div>支出<b>¥' + expense.toFixed(2) + '</b></div><div>结余<b>¥' + (income-expense).toFixed(2) + '</b></div></div><div class="account-form"><select class="input" id="accountType"><option value="expense">支出</option><option value="income">收入</option></select><input class="input" id="accountAmount" type="number" min="0" step="0.01" placeholder="金额"/><input class="input" id="accountCategory" placeholder="分类，如：奶茶"/><input class="input" id="accountNote" placeholder="备注（可选）"/><button class="btn btn-primary" data-act="account-add">记一笔</button></div><div class="account-list">' + (list.length ? list.map(function(x){return '<div class="account-row ' + x.type + '"><span>' + (x.type==='income'?'＋':'－') + ' ¥' + (+x.amount).toFixed(2) + '</span><b>' + h(x.category) + '</b><small>' + h(x.note||'') + ' · ' + h((x.at||'').slice(0,10)) + '</small></div>';}).join('') : '<div class="col-empty">还没有记录，第一笔从这里开始～</div>') + '</div>';
  }

  // ============================================================
  //  登录 / 退出
  // ============================================================
  function openLogin() {
    var list = cfg.members.map(function (m) {
      return '<div class="login-item" data-act="login-as" data-mid="' + m.id + '">' +
        '<span class="avatar">' + MASCOTS[m.mascot](52) + '</span>' +
        '<div><div class="who">' + h(m.name) + '</div><div class="sub">点我登录（无需密码）</div></div>' +
        '</div>';
    }).join('');
    openModal(modalHead('选一只小蒋蒋登录', ICONS.sparkle()) +
      '<div class="modal-body"><p class="muted">不用密码～选中就能进去打卡啦 ✿</p><div class="login-list">' + list + '</div></div>');
  }
  function doLogin(mid) {
    state.currentUserId = mid;
    localStorage.setItem('jjj_user', mid);
    closeModal();
    renderAll();
    toast('欢迎回来，' + memberName(mid) + ' ✿');
    setTimeout(showNotifications, 250);
  }
  function doLogout() {
    if (!confirm('确定要退出登录吗？')) return;
    state.currentUserId = null;
    localStorage.removeItem('jjj_user');
    renderAll();
    toast('已退出，拜拜 ✿');
  }
  function toggleMenu() {
    var menu = $('#userMenu');
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  }
  function hideMenu() { $('#userMenu').style.display = 'none'; }

  // ============================================================
  //  密令 / 连接仓库
  // ============================================================
  function openTokenModal() {
    var repoLine = cfg.owner + '/' + cfg.repo;
    openModal(modalHead('连接 GitHub 仓库', ICONS.key()) +
      '<div class="modal-body">' +
      '<div class="note-box">' +
      '1. 打开 <a href="https://github.com/settings/personal-access-tokens/new" target="_blank">这里</a> 新建密令（Fine-grained token）<br/>' +
      '2. Repository access 选 <b>Only select repositories</b> → 选 <b>' + h(repoLine) + '</b><br/>' +
      '3. Permissions → Repository permissions → <b>Contents</b> = <b>Read and write</b><br/>' +
      '4. 生成后复制密令，粘贴到下面，保存在你自己的浏览器里 ✿' +
      '</div>' +
      '<div class="field"><label>GitHub 密令 (token)</label>' +
      '<input class="input" id="tokenInput" type="password" placeholder="github_pat_xxx..." data-enter="save-token"/></div>' +
      '<div class="input-row"><button class="btn btn-primary" data-act="save-token" style="flex:1;justify-content:center;">保存并连接</button></div>' +
      '<p class="hint center">密令只存在你自己的浏览器，不会进代码仓库哦</p>' +
      '</div>', true);
    setTimeout(function () { var i = $('#tokenInput'); if (i) i.focus(); }, 60);
  }
  async function saveToken() {
    var val = $('#tokenInput').value.trim();
    if (!val) { toast('请先粘贴密令'); return; }
    try {
      var res = await fetch(API + '/repos/' + cfg.owner + '/' + cfg.repo, {
        headers: { 'Authorization': 'Bearer ' + val, 'Accept': 'application/vnd.github+json' }
      });
      if (!res.ok) { toast('密令无效（' + res.status + '），换一个试试'); return; }
      localStorage.setItem('jjj_token', val);
      closeModal();
      renderTopbar();
      toast('已连接仓库，可以开始打卡啦 ✿');
      if (state.retry) { var fn = state.retry; state.retry = null; fn(); }
    } catch (e) { toast('连接失败：' + e.message); }
  }

  // ============================================================
  //  项目设计面板
  // ============================================================
  function openProjectPanel(memberId) {
    if (!state.currentUserId) { toast('请先登录才能设置项目哦'); openLogin(); return; }
    var m = memberById(memberId);
    state.working = {
      memberId: memberId,
      list: state.db.projects.filter(function (p) { return p.member === memberId; })
        .sort(function (a, b) { return (a.order || 0) - (b.order || 0); })
        .map(function (p) { return { id: p.id, title: p.title }; })
    };
    state.projEditIdx = -1;
    renderProjectModal(m);
  }
  function renderProjectModal(m) {
    var items = '';
    if (state.working.list.length === 0) {
      items = '<div class="col-empty" style="padding:14px;">还没有项目，在下面输入一个吧 ✿</div>';
    } else {
      items = state.working.list.map(function (p, i) {
        if (state.projEditIdx === i) {
          return '<div class="proj-item">' +
            '<div class="idx">' + (i + 1) + '</div>' +
            '<input class="input" id="projEditInput" value="' + h(p.title) + '" data-enter="project-item-save"/>' +
            '<div class="proj-actions">' +
            '<button class="mini-ic" data-act="project-item-save" data-idx="' + i + '">' + ICONS.check() + '</button>' +
            '<button class="mini-ic del" data-act="project-item-cancel">' + ICONS.close() + '</button>' +
            '</div></div>';
        }
        return '<div class="proj-item"><div class="idx">' + (i + 1) + '</div>' +
          '<div class="ptext">' + h(p.title) + '</div>' +
          '<div class="proj-actions">' +
          '<button class="mini-ic" data-act="project-edit" data-idx="' + i + '" title="修改">' + ICONS.edit() + '</button>' +
          '<button class="mini-ic del" data-act="project-del" data-idx="' + i + '" title="删除">' + ICONS.trash() + '</button>' +
          '</div></div>';
      }).join('');
    }
    openModal(modalHead(m.name + ' · 打卡项目设计', ICONS.flag()) +
      '<div class="modal-body">' +
      '<div class="note-box">任何成员都可以帮别人设置项目；点「保存」后立即生效 ✿</div>' +
      '<div class="input-row">' +
      '<input class="input" id="projNewInput" placeholder="输入新项目，如：喝 8 杯水" data-enter="project-add"/>' +
      '<button class="btn btn-mint" data-act="project-add">' + ICONS.plus() + ' 添加</button>' +
      '</div>' +
      '<div id="projList" style="display:flex;flex-direction:column;gap:8px;">' + items + '</div>' +
      '<div class="input-row"><button class="btn btn-primary" data-act="project-save" style="flex:1;justify-content:center;">' + ICONS.save() + ' 保存项目</button></div>' +
      '</div>', true);
    setTimeout(function () { var i = $('#projNewInput'); if (i) i.focus(); }, 60);
  }
  function addProject() {
    var input = $('#projNewInput');
    var v = input.value.trim();
    if (!v) { toast('先输入项目内容哦'); return; }
    state.working.list.push({ id: 'p_' + Date.now() + '_' + Math.floor(Math.random() * 1000), title: v });
    input.value = '';
    renderProjectModal(memberById(state.working.memberId));
    toast('已添加，记得点保存～');
  }
  function editProject(idx) {
    state.projEditIdx = +idx;
    renderProjectModal(memberById(state.working.memberId));
    setTimeout(function () { var i = $('#projEditInput'); if (i) { i.focus(); i.select(); } }, 60);
  }
  function saveProjectItem() {
    var v = $('#projEditInput').value.trim();
    if (!v) { toast('内容不能为空哦'); return; }
    state.working.list[state.projEditIdx].title = v;
    state.projEditIdx = -1;
    renderProjectModal(memberById(state.working.memberId));
  }
  function cancelProjectItem() {
    state.projEditIdx = -1;
    renderProjectModal(memberById(state.working.memberId));
  }
  function delProject(idx) {
    if (!confirm('要删除这个项目吗？')) return;
    state.working.list.splice(+idx, 1);
    renderProjectModal(memberById(state.working.memberId));
  }
  function saveProjects() {
    if (state.saving) return;
    var mid = state.working.memberId;
    var list = state.working.list;
    if (list.some(function (x) { return !x.title.trim(); })) { toast('项目内容不能为空哦'); return; }
    needToken(function () {
      state.saving = true;
      (async function () {
        try {
          state.db.projects = (state.db.projects || []).filter(function (p) { return p.member !== mid; });
          list.forEach(function (it, i) {
            state.db.projects.push({ id: it.id, member: mid, title: it.title.trim(), order: i });
          });
          await saveDb('📝 更新 ' + memberName(mid) + ' 的打卡项目');
          state.working = null; state.projEditIdx = -1;
          closeModal(); renderAll();
          toast('项目已保存 ✿');
        } catch (e) { if (e.message !== 'NO_TOKEN') toast('保存失败：' + e.message); }
        finally { state.saving = false; }
      })();
    });
  }

  // ============================================================
  //  打卡与取消打卡
  // ============================================================
  function onCheckClick(el) {
    var mid = el.dataset.mid, pid = el.dataset.pid;
    if (state.viewDate !== todayStr()) { toast('历史日期只能查看，不能打卡哦'); return; }
    var m = currentMember();
    if (!m) { toast('请先登录才能打卡'); openLogin(); return; }
    if (m.id !== mid) { toast('只能给自己的项目打勾哦 ✿'); return; }
    var items = state.db.checkins[todayStr()] && state.db.checkins[todayStr()][mid] && state.db.checkins[todayStr()][mid].items;
    var done = items && items[pid] && items[pid].done;
    if (done) { uncheck(mid, pid); } else { openUploadModal(mid, pid); }
  }

  function openUploadModal(memberId, projectId) {
    state.pendingUpload = { memberId: memberId, projectId: projectId, dataUrl: '', ext: '' };
    var p = projectById(projectId);
    openModal(modalHead('拍照留影 ✿', ICONS.camera()) +
      '<div class="modal-body">' +
      '<p class="muted">完成「<b>' + h(p ? p.title : '项目') + '</b>」打卡。照片凭证是可选的（jpg / png）</p>' +
      '<div class="upload-zone" id="uploadZone" data-act="upload-pick">' +
      '<span class="big-ic">' + ICONS.camera() + '</span>' +
      '<span style="font-weight:800;">点这里选择图片</span>' +
      '<span class="hint">只支持 jpg 或 png</span>' +
      '</div>' +
      '<div id="uploadPreview" style="display:none;"></div>' +
      '<div class="input-row">' +
      '<button class="btn btn-ghost" data-act="modal-close" style="flex:1;justify-content:center;">取消</button>' +
      '<button class="btn btn-primary" id="uploadConfirm" data-act="upload-confirm" style="flex:1;justify-content:center;">确定打卡</button>' +
      '</div></div>');
  }
  function pickUploadFile() { triggerFileInput('image/jpeg,image/png', onUploadFile); }
  async function onUploadFile(e) {
    var f = e.target.files[0];
    if (!f) return;
    if (!/image\/(jpeg|png)/.test(f.type)) { toast('只能上传 jpg 或 png 图片哦'); return; }
    try {
      var r = await processImage(f);
      state.pendingUpload.dataUrl = r.dataUrl;
      state.pendingUpload.ext = r.ext;
      $('#uploadPreview').innerHTML = '<div class="upload-preview"><img src="' + r.dataUrl + '"/></div>';
      $('#uploadPreview').style.display = 'block';
      $('#uploadZone').style.display = 'none';
      $('#uploadConfirm').disabled = false;
    } catch (err) { toast('图片读取失败，换一张试试'); }
  }
  function confirmUpload() {
    if (state.saving) return;
    var u = state.pendingUpload;
    if (!u) return;
    needToken(function () {
      state.saving = true;
      (async function () {
        try {
          var date = todayStr();
          var safe = String(u.projectId).replace(/[^a-zA-Z0-9_-]/g, '');
          var path = null;
          if (u.dataUrl) { path = cfg.imagesDir + '/' + date + '/' + u.memberId + '/' + safe + '-' + Date.now() + '.' + u.ext; await uploadImage(path, u.dataUrl, '📷 打卡凭证'); }
          ensureDay(u.memberId, date);
          state.db.checkins[date][u.memberId].items[u.projectId] = { done: true, image: path, at: new Date().toISOString() };
          await saveDb('✨ ' + memberName(u.memberId) + ' 完成打卡「' + (projectById(u.projectId) ? projectById(u.projectId).title : '') + '」 ' + date);
          closeModal();
          renderAll();
          var st = memberDayStatus(date, u.memberId);
          if (st.all) toast('太棒啦！全部完成，今天点亮啦 ✨🎉');
          else toast('打卡成功～继续加油 🎀');
        } catch (e) { if (e.message !== 'NO_TOKEN') toast('保存失败：' + e.message); }
        finally { state.saving = false; }
      })();
    });
  }
  function uncheck(mid, pid) {
    if (!confirm('要取消这项打卡吗？')) return;
    if (state.saving) return;
    needToken(function () {
      state.saving = true;
      (async function () {
        try {
          var day = state.db.checkins[todayStr()];
          if (day && day[mid] && day[mid].items) delete day[mid].items[pid];
          await saveDb('↩️ ' + memberName(mid) + ' 取消打卡「' + (projectById(pid) ? projectById(pid).title : '') + '」');
          renderAll();
          toast('已取消该打卡');
        } catch (e) { if (e.message !== 'NO_TOKEN') toast('取消失败：' + e.message); }
        finally { state.saving = false; }
      })();
    });
  }

  // ---------- 未来计划 / 评论 / 贴纸墙 ----------
  function openPlanPanel(mid) {
    if (!currentMember()) { toast('请先登录才能安排计划'); openLogin(); return; }
    var ds = state.viewDate;
    if (ds <= todayStr()) return;
    var list = state.working && state.working.date === ds && state.working.memberId === mid ? state.working.list : ((state.db.plans[ds] && state.db.plans[ds][mid]) || projectsForDay(mid, ds));
    var rows = list.map(function(p, i){ return '<div class="proj-item"><span class="idx">' + (i+1) + '</span><input class="input plan-title" data-idx="' + i + '" value="' + h(p.title) + '"/><button class="mini-ic del" data-act="plan-delete" data-idx="' + i + '">×</button></div>'; }).join('');
    openModal(modalHead(memberName(mid) + ' · ' + ds + ' 的计划', '🗓️') + '<div class="modal-body"><div class="note-box">未来计划可由任意已登录成员安排或修改，到了当天会自动显示在看板上。</div><div id="planRows">' + (rows || '<div class="col-empty">还没有安排，添加一项吧～</div>') + '</div><div class="input-row"><input class="input" id="planNew" placeholder="例如：带水杯出门"/><button class="btn btn-mint" data-act="plan-add">添加</button></div><button class="btn btn-primary" data-act="plan-save">保存未来计划</button></div>');
    state.working = { memberId: mid, date: ds, list: list.map(function(p){return {id:p.id || ('plan_'+Date.now()),title:p.title};}) };
  }
  function planAdd() { var v=$('#planNew').value.trim(); if(!v) return toast('先写下计划内容哦'); state.working.list.push({id:'plan_'+Date.now()+'_'+Math.random().toString(36).slice(2,5),title:v}); openPlanPanel(state.working.memberId); }
  function planDelete(idx) { state.working.list.splice(+idx,1); openPlanPanel(state.working.memberId); }
  function savePlan() {
    var inputs = document.querySelectorAll('.plan-title'); inputs.forEach(function(x){ state.working.list[+x.dataset.idx].title=x.value.trim(); });
    if (state.working.list.some(function(x){return !x.title;})) return toast('计划内容不能为空哦');
    var w=state.working; needToken(function(){ (async function(){ try { state.db.plans[w.date]=state.db.plans[w.date]||{}; state.db.plans[w.date][w.memberId]=w.list; await saveDb('🗓️ 更新 '+memberName(w.memberId)+' 的未来计划 '+w.date); closeModal(); renderAll(); toast('未来计划已保存 ✿'); }catch(e){if(e.message!=='NO_TOKEN')toast('保存失败：'+e.message);} })(); });
  }
  function openComment(el) {
    if (!currentMember()) { toast('登录后就可以留言啦'); openLogin(); return; }
    var target={type:el.dataset.target, memberId:el.dataset.mid||null, date:el.dataset.date||null, projectId:el.dataset.pid||null, id:el.dataset.wallid||null};
    openModal(modalHead('留一句小纸条', '💬') + '<div class="modal-body"><p class="muted">这条留言会在对方下次打开网站时提醒 TA。</p><textarea id="commentText" class="input" placeholder="写下想说的话吧～"></textarea><button class="btn btn-primary" data-act="comment-save" data-target="' + h(JSON.stringify(target)) + '">发送留言</button></div>');
  }
  function saveComment(el) {
    var text=$('#commentText').value.trim(); if(!text) return toast('写点内容再发送吧'); var target=JSON.parse(el.dataset.target);
    needToken(function(){ (async function(){try{state.db.comments.push({id:'c_'+Date.now(),target:target,author:state.currentUserId,text:text,at:new Date().toISOString(),readBy:{}});await saveDb('💬 '+memberName(state.currentUserId)+' 留下评论');closeModal();renderAll();toast('小纸条送出啦 ✿');}catch(e){if(e.message!=='NO_TOKEN')toast('发送失败：'+e.message);}})();});
  }
  function openWallAdd() {
    if(!currentMember()){toast('登录后就能贴留言啦');openLogin();return;} state.pendingWallImage=null;
    openModal(modalHead('贴一张留言', '📌')+'<div class="modal-body"><textarea class="input" id="wallText" placeholder="写下今天的小小分享吧～"></textarea><div class="upload-zone" data-act="wall-image-pick"><span class="big-ic">📷</span><b>添加一张照片（可选）</b></div><div id="wallPreview"></div><button class="btn btn-primary" data-act="wall-save">贴到留言墙</button></div>');
  }
  function pickWallImage(){triggerFileInput('image/jpeg,image/png',onWallImage);}
  async function onWallImage(e){var f=e.target.files[0];if(!f)return;try{state.pendingWallImage=await processImage(f);$('#wallPreview').innerHTML='<div class="upload-preview"><img src="'+state.pendingWallImage.dataUrl+'"/></div>';}catch(x){toast('图片读取失败');}}
  function saveWall(){var text=$('#wallText').value.trim();if(!text)return toast('写一句话再贴上去吧');needToken(function(){(async function(){try{var image=null;if(state.pendingWallImage){image=cfg.imagesDir+'/wall/'+Date.now()+'.'+state.pendingWallImage.ext;await uploadImage(image,state.pendingWallImage.dataUrl,'📌 留言墙照片');}var ck=state.db.checkins[todayStr()]&&state.db.checkins[todayStr()][state.currentUserId], mood=ck&&ck.mood;state.db.wallPosts.push({id:'w_'+Date.now(),author:state.currentUserId,text:text,image:image,mood:mood&&typeof mood==='object'?mood.emoji:(mood||'🌷'),at:new Date().toISOString()});await saveDb('📌 新增留言墙贴纸');closeModal();renderAll();toast('贴好啦 ✿');}catch(e){if(e.message!=='NO_TOKEN')toast('保存失败：'+e.message);}})();});}
  function addFood(){if(!currentMember()){toast('登录后才可以编辑菜单');openLogin();return;}var v=$('#foodNewInput').value.trim();if(!v)return toast('先写下一个选项吧');needToken(function(){(async function(){try{state.db.foodOptions.push({id:'food_'+Date.now(),name:v});await saveDb('🍜 新增吃什么选项');renderFood();$('#foodNewInput').value='';}catch(e){if(e.message!=='NO_TOKEN')toast('保存失败：'+e.message);}})();});}
  function deleteFood(id){needToken(function(){(async function(){try{state.db.foodOptions=state.db.foodOptions.filter(function(x){return x.id!==id;});await saveDb('🍜 删除吃什么选项');renderFood();}catch(e){toast('保存失败：'+e.message);}})();});}
  function spinFood(){var opts=state.db.foodOptions;if(!opts.length)return toast('先添加几个菜单选项吧');var chosen=Math.floor(Math.random()*opts.length), turns=1440+Math.floor(Math.random()*720), target=360-(chosen+.5)*360/opts.length;state.foodRotation+=turns+(target-(state.foodRotation%360));renderFood();setTimeout(function(){$('#foodResult').textContent='今天就吃：'+opts[chosen].name+' ✨';},1050);}
  function addAccount(){var amount=+$('#accountAmount').value,cat=$('#accountCategory').value.trim();if(!amount||!cat)return toast('请填写金额和分类哦');var mid=state.currentUserId;needToken(function(){(async function(){try{state.db.accounts[mid]=state.db.accounts[mid]||[];state.db.accounts[mid].push({id:'a_'+Date.now(),type:$('#accountType').value,amount:amount,category:cat,note:$('#accountNote').value.trim(),at:new Date().toISOString()});await saveDb('💰 '+memberName(mid)+' 记了一笔账');renderAccount();toast('记好啦 ✿');}catch(e){if(e.message!=='NO_TOKEN')toast('保存失败：'+e.message);}})();});}
  async function showNotifications() { var mid=state.currentUserId;if(!mid)return;var list=state.db.comments.filter(function(c){return c.author!==mid&&c.target&&c.target.memberId===mid&&!(c.readBy&&c.readBy[mid]);});if(!list.length)return;openModal(modalHead('你有新的小纸条 ✉️','')+'<div class="modal-body">'+list.map(function(c){return '<div class="note-box"><b>来自 '+h(memberName(c.author))+'：</b>'+h(c.text)+'</div>';}).join('')+'<button class="btn btn-primary" data-act="notification-read">我收到啦</button></div>'); }
  function readNotifications(){var mid=state.currentUserId;state.db.comments.forEach(function(c){if(c.target&&c.target.memberId===mid&&c.author!==mid){c.readBy=c.readBy||{};c.readBy[mid]=true;}});closeModal();if(getToken())saveDb('✉️ 阅读留言提醒').catch(function(){});}

  // ============================================================
  //  图片查看
  // ============================================================
  function openViewImage(path, title) {
    var url = rawUrl(path);
    openModal(modalHead(title || '打卡图片', ICONS.eye()) +
      '<div class="view-wrap"><img src="' + h(url) + '" alt=""/>' +
      '<div class="input-row"><a class="btn btn-soft" style="flex:1;justify-content:center;text-decoration:none;" href="' + h(url) + '" target="_blank">在新窗口打开</a>' +
      '<button class="btn btn-ghost" data-act="modal-close" style="flex:1;justify-content:center;">关闭</button></div></div>', true);
  }

  // ============================================================
  //  个人中心（头像 / 心情 / 留言）
  // ============================================================
  function openProfile() {
    var m = currentMember();
    if (!m) { toast('请先登录'); openLogin(); return; }
    var ck = state.db.checkins[todayStr()] && state.db.checkins[todayStr()][m.id];
    state.pendingAvatar = null;
    state.pendingMood = ck && ck.mood ? (typeof ck.mood === 'object' ? ck.mood.emoji : ck.mood) : null;
    state.pendingCustomMood = ck && ck.mood && typeof ck.mood === 'object' ? ck.mood : null;
    state.pendingMessage = ck && ck.message ? ck.message : '';
    renderProfileModal(m);
  }
  function renderProfileModal(m) {
    var avatar = state.pendingAvatar
      ? '<img src="' + state.pendingAvatar.dataUrl + '"/>'
      : avatarHTML(m, 84);
    openModal(modalHead(m.name + ' · 个人中心', ICONS.camera()) +
      '<div class="modal-body">' +
      '<div class="field"><label>我的头像</label>' +
      '<div class="avatar-preview" id="avatarPreview">' + avatar + '</div>' +
      '<button class="btn btn-soft" data-act="avatar-pick" style="justify-content:center;">' + ICONS.upload() + ' 更换头像</button></div>' +
      '<div class="field"><label>今日心情</label><div class="mood-grid" id="moodGrid">' + moodGridHTML(m) + '</div><div class="input-row custom-mood"><input class="input" id="customMoodEmoji" maxlength="8" placeholder="自定义 emoji" value="' + h(state.pendingCustomMood ? state.pendingCustomMood.emoji : '') + '"/><input class="input" id="customMoodLabel" maxlength="16" placeholder="自定义心情名称" value="' + h(state.pendingCustomMood ? state.pendingCustomMood.label : '') + '"/><button class="btn btn-soft" data-act="mood-custom">使用</button></div></div>' +
      '<div class="field"><label>今日留言</label><textarea class="input" id="messageInput" placeholder="写一句想说的话吧～">' + h(state.pendingMessage) + '</textarea></div>' +
      '<div class="input-row"><button class="btn btn-primary" data-act="profile-save" style="flex:1;justify-content:center;">' + ICONS.save() + ' 保存</button></div>' +
      '</div>');
  }
  function moodGridHTML(m) {
    return cfg.moods.map(function (mo) {
      return '<div class="mood-opt' + (state.pendingMood === mo.emoji ? ' sel' : '') + '" data-act="mood-pick" data-emoji="' + mo.emoji + '" title="' + h(mo.label) + '">' +
        '<span class="mo">' + mo.emoji + '</span><span class="lab">' + h(mo.label) + '</span></div>';
    }).join('');
  }
  function pickAvatarFile() { triggerFileInput('image/jpeg,image/png', onAvatarFile); }
  async function onAvatarFile(e) {
    var f = e.target.files[0];
    if (!f) return;
    if (!/image\/(jpeg|png)/.test(f.type)) { toast('只能上传 jpg 或 png 图片哦'); return; }
    try {
      var r = await processImage(f);
      state.pendingAvatar = { dataUrl: r.dataUrl, ext: r.ext };
      $('#avatarPreview').innerHTML = '<img src="' + r.dataUrl + '"/>';
    } catch (err) { toast('图片读取失败'); }
  }
  function pickMood(emoji) {
    state.pendingMood = emoji;
    state.pendingCustomMood = null;
    $('#moodGrid').innerHTML = moodGridHTML(currentMember());
  }
  function pickCustomMood() {
    var emoji = $('#customMoodEmoji').value.trim(), label = $('#customMoodLabel').value.trim();
    if (!emoji || !label) { toast('请填写 emoji 和心情名称哦'); return; }
    state.pendingMood = emoji; state.pendingCustomMood = { emoji: emoji, label: label };
    $('#moodGrid').innerHTML = moodGridHTML(currentMember()); toast('已选中自定义心情 ✿');
  }
  function saveProfile() {
    if (state.saving) return;
    state.pendingMessage = $('#messageInput').value;
    var mid = state.currentUserId;
    needToken(function () {
      state.saving = true;
      (async function () {
        try {
          if (state.pendingAvatar) {
            var path = cfg.imagesDir + '/avatars/' + mid + '-' + Date.now() + '.' + state.pendingAvatar.ext;
            await uploadImage(path, state.pendingAvatar.dataUrl, '🎨 ' + memberName(mid) + ' 更新头像');
            state.db.members[mid].avatar = path;
          }
          ensureDay(mid, todayStr());
          var day = state.db.checkins[todayStr()][mid];
          day.mood = state.pendingCustomMood || state.pendingMood || null;
          day.message = (state.pendingMessage || '').trim() || null;
          await saveDb('💬 ' + memberName(mid) + ' 更新今日心情与留言');
          closeModal(); renderAll();
          toast('保存好啦 ✿');
        } catch (e) { if (e.message !== 'NO_TOKEN') toast('保存失败：' + e.message); }
        finally { state.saving = false; }
      })();
    });
  }

  // ============================================================
  //  图片处理（降采样压缩，控制体积）
  // ============================================================
  function triggerFileInput(accept, cb) {
    var inp = document.createElement('input');
    inp.type = 'file'; inp.accept = accept; inp.style.display = 'none';
    inp.onchange = function (e) { cb(e); inp.remove(); };
    document.body.appendChild(inp);
    inp.click();
  }
  function fileToDataUrl(file) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(r.result); };
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }
  function processImage(file) {
    return fileToDataUrl(file).then(function (dataUrl) {
      return new Promise(function (res, rej) {
        var img = new Image();
        img.onload = function () {
          var w = img.naturalWidth || img.width, hh = img.naturalHeight || img.height;
          var isPng = file.type === 'image/png';
          // 图片本来就不大：直接原样使用
          if (w <= 1200 && hh <= 1200 && dataUrl.length < 900000) {
            res({ dataUrl: dataUrl, ext: isPng ? 'png' : 'jpg' });
            return;
          }
          var ext = isPng ? 'png' : 'jpg';
          var maxDim = 1280;
          var out = null;
          while (maxDim >= 320) {
            var scale = Math.min(1, maxDim / Math.max(w, hh));
            var tw = Math.max(1, Math.round(w * scale)), th = Math.max(1, Math.round(hh * scale));
            var cv = document.createElement('canvas');
            cv.width = tw; cv.height = th;
            cv.getContext('2d').drawImage(img, 0, 0, tw, th);
            out = ext === 'png' ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.82);
            if (out.length < 900000) break;
            if (ext === 'png') { ext = 'jpg'; continue; }   // png 太大改 jpg，保持尺寸再来一次
            maxDim = Math.round(maxDim * 0.75);              // 仍太大就缩小再压
          }
          res({ dataUrl: out, ext: ext });
        };
        img.onerror = rej;
        img.src = dataUrl;
      });
    });
  }

  // ============================================================
  //  事件分发
  // ============================================================
  function handleAction(name, el) {
    switch (name) {
      case 'login': openLogin(); break;
      case 'login-as': doLogin(el.dataset.mid); break;
      case 'menu-toggle': toggleMenu(); break;
      case 'menu-profile': hideMenu(); openProfile(); break;
      case 'menu-switch': hideMenu(); openLogin(); break;
      case 'menu-token': hideMenu(); openTokenModal(); break;
      case 'logout': hideMenu(); doLogout(); break;
      case 'refresh': (async function () { toast('刷新中…'); await loadDb(true); renderAll(); })(); break;
      case 'go-home': showPage('home'); break;
      case 'go-food': showPage('food'); break;
      case 'go-account': showPage('account'); break;
      case 'account-login': openLogin(); break;
      case 'cal-prev': state.viewMonth.setMonth(state.viewMonth.getMonth() - 1); renderCalendar(); break;
      case 'cal-next': state.viewMonth.setMonth(state.viewMonth.getMonth() + 1); renderCalendar(); break;
      case 'cal-today': state.viewMonth = new Date(); state.viewDate = todayStr(); renderCalendar(); renderBoard(); break;
      case 'cal-day': state.viewDate = el.dataset.date; renderCalendar(); renderBoard(); break;
      case 'mascot': openProjectPanel(el.dataset.mid); break;
      case 'col-avatar': openProjectPanel(el.dataset.mid); break;
      case 'quick-status': openProfile(); break;
      case 'plan-open': openPlanPanel(el.dataset.mid); break;
      case 'plan-add': planAdd(); break;
      case 'plan-delete': planDelete(el.dataset.idx); break;
      case 'plan-save': savePlan(); break;
      case 'check': onCheckClick(el); break;
      case 'view': openViewImage(el.dataset.img, el.dataset.title); break;
      case 'project-add': addProject(); break;
      case 'project-edit': editProject(el.dataset.idx); break;
      case 'project-del': delProject(el.dataset.idx); break;
      case 'project-item-save': saveProjectItem(); break;
      case 'project-item-cancel': cancelProjectItem(); break;
      case 'project-save': saveProjects(); break;
      case 'project-cancel': state.working = null; state.projEditIdx = -1; closeModal(); break;
      case 'upload-pick': pickUploadFile(); break;
      case 'upload-confirm': confirmUpload(); break;
      case 'avatar-pick': pickAvatarFile(); break;
      case 'mood-pick': pickMood(el.dataset.emoji); break;
      case 'mood-custom': pickCustomMood(); break;
      case 'profile-save': saveProfile(); break;
      case 'comment': openComment(el); break;
      case 'comment-save': saveComment(el); break;
      case 'notification-read': readNotifications(); break;
      case 'wall-add': openWallAdd(); break;
      case 'wall-image-pick': pickWallImage(); break;
      case 'wall-save': saveWall(); break;
      case 'food-add': addFood(); break;
      case 'food-delete': deleteFood(el.dataset.id); break;
      case 'spin-food': spinFood(); break;
      case 'account-add': addAccount(); break;
      case 'save-token': saveToken(); break;
      case 'open-token': openTokenModal(); break;
      case 'backdrop-close': closeModal(); break;
      case 'modal-close': closeModal(); break;
      case 'modal-stop': break;
    }
  }

  function bindEvents() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-act]');
      if (el) handleAction(el.dataset.act, el);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var t = e.target;
        if (t && t.closest && t.dataset && t.dataset.enter) handleAction(t.dataset.enter, t);
      }
    });
    document.addEventListener('click', function (e) {
      var menu = $('#userMenu'), chip = $('#loginBtn');
      if (menu && chip && menu.style.display !== 'none') {
        if (!chip.contains(e.target) && !menu.contains(e.target)) menu.style.display = 'none';
      }
    });
    var btn = $('#refreshBtn');
    if (btn) { btn.innerHTML = ICONS.refresh(); btn.dataset.act = 'refresh'; }
    $('#calPrev').dataset.act = 'cal-prev'; $('#calPrev').innerHTML = ICONS.left();
    $('#calNext').dataset.act = 'cal-next'; $('#calNext').innerHTML = ICONS.right();
    $('#calToday').dataset.act = 'cal-today';
  }

  // ============================================================
  //  启动
  // ============================================================
  async function init() {
    bindEvents();
    renderBrand();
    renderTopbar();
    renderMascots();
    await loadDb(false);
    renderAll();
    setTimeout(showNotifications, 350);
  }

  init();
})();
