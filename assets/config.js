// ============================================================
//  三只蒋蒋 · 站点配置
//  部署前请确认 owner / repo / branch 与你的 GitHub 仓库一致
// ============================================================
window.JJJ_CONFIG = {
  // GitHub 仓库信息
  owner: 'littlefish-16',
  repo: 'jiangjiangjiang-',
  branch: 'main',

  // (可选) 把 GitHub 密令直接写在这里 —— 强烈不推荐！
  // 若留空，用户首次打卡时会弹出引导，把密令存在自己浏览器里（更安全）。
  bakedToken: '',

  // 三位成员（id 用于存储目录，name 用于显示）
  members: [
    { id: 'jiangjiang1', name: '蒋蒋1', mascot: 'chick',  color: '#ff9f68', soft: '#ffe3cf', gradient: ['#ffd7b0', '#ffb077'] },
    { id: 'jiangjiang2', name: '蒋蒋2', mascot: 'bunny',  color: '#62c9a4', soft: '#d8f3e7', gradient: ['#c8efe0', '#7fd7b6'] },
    { id: 'jiangjiang3', name: '蒋蒋3', mascot: 'bear',   color: '#9d8cf0', soft: '#e6e0fb', gradient: ['#ded6fb', '#a896ef'] }
  ],

  // 打卡图片存储目录（会被 GitHub API 自动创建）
  imagesDir: 'images',

  // 心情可选表情
  moods: [
    { emoji: '😆', label: '超开心' },
    { emoji: '😊', label: '开心' },
    { emoji: '🥰', label: '甜甜的' },
    { emoji: '😐', label: '平静' },
    { emoji: '😴', label: '困困' },
    { emoji: '😢', label: '难过' },
    { emoji: '😭', label: '哭哭' },
    { emoji: '🎠', label: '出去玩' },
    { emoji: '💼', label: '忙' },
    { emoji: '🤒', label: '不舒服' },
    { emoji: '💪', label: '加油' }
  ]
};
