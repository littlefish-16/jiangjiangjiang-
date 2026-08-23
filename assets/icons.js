// ============================================================
//  三只蒋蒋 · 可爱美术素材（3 只吉祥物 + 柔和线条图标）
// ============================================================
(function () {
  'use strict';

  // ---------- 三只吉祥物（圆形脸蛋 + 腮红 + 大眼睛）----------
  function svgWrap(inner, size) {
    const s = size || 64;
    return '<svg viewBox="0 0 64 64" width="' + s + '" height="' + s + '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + inner + '</svg>';
  }

  function eyes() {
    return '' +
      '<circle cx="22.5" cy="28" r="3.6" fill="#3b3b4a"/>' +
      '<circle cx="41.5" cy="28" r="3.6" fill="#3b3b4a"/>' +
      '<circle cx="23.7" cy="26.7" r="1.25" fill="#ffffff"/>' +
      '<circle cx="42.7" cy="26.7" r="1.25" fill="#ffffff"/>';
  }
  function blush() {
    return '' +
      '<ellipse cx="15.5" cy="35.5" rx="4.2" ry="2.7" fill="#ffb8c6" opacity="0.85"/>' +
      '<ellipse cx="48.5" cy="35.5" rx="4.2" ry="2.7" fill="#ffb8c6" opacity="0.85"/>';
  }
  function smile(d) {
    return '<path d="' + (d || 'M26 40 Q32 45.5 38 40') + '" stroke="#c9896a" stroke-width="2.4" fill="none" stroke-linecap="round"/>';
  }

  const mascots = {
    // 小鸡 · 蒋蒋1（暖橙黄）
    chick: function (size) {
      return svgWrap(
        '<ellipse cx="32" cy="60" rx="20" ry="5" fill="#00000010"/>' +
        '<path d="M32 22 C30 13 33 7 36 5" stroke="#ffb45e" stroke-width="5" fill="none" stroke-linecap="round"/>' +
        '<circle cx="32" cy="32" r="25" fill="#ffd166"/>' +
        '<circle cx="32" cy="32" r="25" fill="url(#chickg)"/>' +
        '<defs><radialGradient id="chickg" cx="0.35" cy="0.25" r="0.9">' +
        '<stop offset="0" stop-color="#ffe9a8"/><stop offset="1" stop-color="#ffc558"/></radialGradient></defs>' +
        eyes() + blush() +
        '<path d="M29 30 L35 30 L32 36 Z" fill="#f59a3f" stroke="#f59a3f" stroke-linejoin="round"/>' +
        smile('M26 41 Q32 46.5 38 41'),
        size
      );
    },
    // 小兔 · 蒋蒋2（薄荷绿）
    bunny: function (size) {
      return svgWrap(
        '<ellipse cx="32" cy="60" rx="20" ry="5" fill="#00000010"/>' +
        '<ellipse cx="24" cy="13" rx="6" ry="13" fill="#bff0dd" transform="rotate(-15 24 13)"/>' +
        '<ellipse cx="40" cy="13" rx="6" ry="13" fill="#bff0dd" transform="rotate(15 40 13)"/>' +
        '<ellipse cx="24" cy="13" rx="3.1" ry="9" fill="#ffc9d8" transform="rotate(-15 24 13)"/>' +
        '<ellipse cx="40" cy="13" rx="3.1" ry="9" fill="#ffc9d8" transform="rotate(15 40 13)"/>' +
        '<circle cx="32" cy="32" r="25" fill="#a9e2c8"/>' +
        '<circle cx="32" cy="32" r="25" fill="url(#bunnyg)"/>' +
        '<defs><radialGradient id="bunnyg" cx="0.35" cy="0.25" r="0.9">' +
        '<stop offset="0" stop-color="#f1fff5"/><stop offset="1" stop-color="#a3ddc2"/></radialGradient></defs>' +
        eyes() + blush() +
        '<circle cx="32" cy="34" r="2.4" fill="#f08ca8"/>' +
        '<path d="M32 36.5 L32 40 M26 39 Q32 42 38 39" stroke="#c9896a" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
        size
      );
    },
    // 小熊 · 蒋蒋3（薰衣草紫）
    bear: function (size) {
      return svgWrap(
        '<ellipse cx="32" cy="60" rx="20" ry="5" fill="#00000010"/>' +
        '<circle cx="15" cy="12" r="7" fill="#c9bdf5"/>' +
        '<circle cx="49" cy="12" r="7" fill="#c9bdf5"/>' +
        '<circle cx="15" cy="12" r="3.4" fill="#f2c9dc"/>' +
        '<circle cx="49" cy="12" r="3.4" fill="#f2c9dc"/>' +
        '<circle cx="32" cy="32" r="25" fill="#b9acf2"/>' +
        '<circle cx="32" cy="32" r="25" fill="url(#bearg)"/>' +
        '<defs><radialGradient id="bearg" cx="0.35" cy="0.25" r="0.9">' +
        '<stop offset="0" stop-color="#ece7fc"/><stop offset="1" stop-color="#b5a7f0"/></radialGradient></defs>' +
        eyes() + blush() +
        '<ellipse cx="32" cy="37.5" rx="6" ry="4.6" fill="#efe3d8"/>' +
        '<ellipse cx="32" cy="35.5" rx="2.6" ry="2.2" fill="#d8a58f"/>' +
        '<path d="M32 39.5 L32 42.5 M29 41.5 Q32 43 35 41.5" stroke="#d8a58f" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
        size
      );
    }
  };

  // ---------- 通用柔和线条图标 ----------
  function icon(paths, extra) {
    return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg" ' +
      'stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"' + (extra || '') + '>' +
      paths + '</svg>';
  }

  const icons = {
    check: function (s) { return icon('<path d="M5 12.5 L9.8 17.2 L19 7"/>', s ? ' width="' + s + '" height="' + s + '"' : ''); },
    eye: function () { return icon('<path d="M2.5 12 C2.5 12 6 5.5 12 5.5 C18 5.5 21.5 12 21.5 12 C21.5 12 18 18.5 12 18.5 C6 18.5 2.5 12 2.5 12 Z"/><circle cx="12" cy="12" r="3"/>'); },
    edit: function () { return icon('<path d="M4 20 L4 16 L16 4 L20 8 L8 20 Z M13.5 6.5 L17.5 10.5"/>'); },
    trash: function () { return icon('<path d="M4 7 L20 7 M9.5 7 L9.5 4.5 L14.5 4.5 L14.5 7 M6.5 7 L7.5 19.5 L16.5 19.5 L17.5 7"/>'); },
    plus: function () { return icon('<path d="M12 5 L12 19 M5 12 L19 12"/>'); },
    save: function () { return icon('<path d="M5 4 L16 4 L19 7 L19 20 L5 20 Z M8 4 L8 8 L15 8 L15 4 M8 20 L8 13 L16 13 L16 20"/>'); },
    upload: function () { return icon('<path d="M12 16 L12 4 M7.5 8.5 L12 4 L16.5 8.5 M4 20 L20 20"/>'); },
    refresh: function () { return icon('<path d="M20 12 A8 8 0 1 1 18.6 6.5 M20 4 L20 8.5 L15.5 8.5"/>'); },
    left: function () { return icon('<path d="M15 5 L8 12 L15 19"/>'); },
    right: function () { return icon('<path d="M9 5 L16 12 L9 19"/>'); },
    close: function () { return icon('<path d="M6 6 L18 18 M18 6 L6 18"/>'); },
    camera: function () { return icon('<path d="M4 8 L8 8 L9.5 5.5 L14.5 5.5 L16 8 L20 8 L20 18 L4 18 Z"/><circle cx="12" cy="13" r="3.2"/>'); },
    key: function () { return icon('<circle cx="8" cy="14" r="4"/><path d="M11.5 11.5 L20 3 M15.5 7.5 L18 10 M13.5 9.5 L15.5 11.5"/>'); },
    logout: function () { return icon('<path d="M14 4 L9 4 L9 20 L14 20 M10 12 L20 12 M17 9 L20 12 L17 15"/>'); },
    swap: function () { return icon('<path d="M7 7 L17 17 M17 7 L6 18"/>'); },
    sparkle: function () { return icon('<path d="M12 3 L13.2 8.8 L19 10 L13.2 11.2 L12 17 L10.8 11.2 L5 10 L10.8 8.8 Z"/>'); },
    calendar: function () { return icon('<rect x="4" y="5.5" width="16" height="15" rx="2.5"/><path d="M8 3.5 L8 8 M16 3.5 L16 8 M4 10.5 L20 10.5"/>'); },
    setting: function () { return icon('<circle cx="12" cy="12" r="3.2"/><path d="M12 3 L12 6 M12 18 L12 21 M3 12 L6 12 M18 12 L21 12 M5.6 5.6 L7.6 7.6 M16.4 16.4 L18.4 18.4 M18.4 5.6 L16.4 7.6 M7.6 16.4 L5.6 18.4"/>'); },
    lock: function () { return icon('<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5 L8 7.5 A4 4 0 0 1 16 7.5 L16 10.5"/>'); },
    flag: function () { return icon('<path d="M5.5 3.5 L5.5 21 M5.5 4 L15.5 4 L13 8 L16 12 L5.5 12"/>'); }
  };

  window.MASCOTS = mascots;
  window.ICONS = icons;
})();