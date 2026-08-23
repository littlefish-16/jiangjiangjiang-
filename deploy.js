// 三只蒋蒋 · 部署脚本
// 通过 GitHub API 直接上传所有文件（可避开不稳定的 git 推送），并尝试开启 Pages。
//
// 用法（任选其一）：
//   node deploy.js                          # 运行时粘贴密令
//   node deploy.js <你的密令>                # 作为参数传入
//   $env:JJJ_DEPLOY_TOKEN="<你的密令>"; node deploy.js
'use strict';

const fs = require('fs');
const path = require('path');

const OWNER = 'littlefish-16';
const REPO = 'jiangjiangjiang-';
const BRANCH = 'main';
const API = 'https://api.github.com';

// 需要上传的文件（相对本脚本所在目录）
const FILES = [
  'index.html',
  'assets/config.js',
  'assets/icons.js',
  'assets/styles.css',
  'assets/app.js',
  'data/db.json',
  'README.md',
  'deploy.js'
];

const BASE_HEADERS = {
  'User-Agent': 'jjj-deploy',
  'Accept': 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28'
};

function b64(buf) { return buf.toString('base64'); }

async function api(p, opts) {
  const res = await fetch(API + p, opts);
  let body = null;
  try { body = await res.json(); } catch (e) { /* 无 JSON */ }
  return { status: res.status, ok: res.ok, body: body };
}

async function getSha(filePath, token) {
  const r = await api(`/repos/${OWNER}/${REPO}/contents/${filePath}?ref=${BRANCH}`, {
    headers: Object.assign({}, BASE_HEADERS, { Authorization: 'Bearer ' + token })
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('读取 ' + filePath + ' 失败：' + ((r.body && r.body.message) || r.status));
  return r.body.sha;
}

async function putFile(filePath, token) {
  const local = path.join(__dirname, filePath);
  const content = b64(fs.readFileSync(local));
  const sha = await getSha(filePath, token);
  const body = { message: '📦 部署：' + filePath, branch: BRANCH, content: content };
  if (sha) body.sha = sha;
  const r = await api(`/repos/${OWNER}/${REPO}/contents/${filePath}`, {
    method: 'PUT',
    headers: Object.assign({}, BASE_HEADERS, {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    }),
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error('上传 ' + filePath + ' 失败：' + ((r.body && r.body.message) || r.status));
  return r;
}

async function enablePages(token) {
  const r = await api(`/repos/${OWNER}/${REPO}/pages`, {
    method: 'POST',
    headers: Object.assign({}, BASE_HEADERS, {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    }),
    body: JSON.stringify({ source: { branch: BRANCH, path: '/' } })
  });
  if (r.ok || r.status === 409) return true; // 成功 / 已开启
  return false;
}

function promptToken() {
  return new Promise((resolve, reject) => {
    if (process.env.JJJ_DEPLOY_TOKEN) return resolve(process.env.JJJ_DEPLOY_TOKEN.trim());
    if (process.argv[2]) return resolve(process.argv[2].trim());
    if (!process.stdin.isTTY) {
      reject(new Error('请通过环境变量 JJJ_DEPLOY_TOKEN 或第一个参数提供密令'));
      return;
    }
    const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
    rl.question('请粘贴 GitHub 密令 (token)：', (t) => { rl.close(); resolve(String(t || '').trim()); });
  });
}

(async function () {
  const token = await promptToken();
  if (!token) { console.log('未提供密令，已退出。'); return; }

  console.log('开始部署到 ' + OWNER + '/' + REPO + ' ...\n');
  let ok = 0;
  try {
    for (const f of FILES) {
      process.stdout.write('  上传 ' + f + ' ...');
      await putFile(f, token);
      console.log(' ✅');
      ok++;
    }
    console.log('\n✅ 共上传 ' + ok + '/' + FILES.length + ' 个文件！');

    const url = 'https://' + OWNER + '.github.io/' + REPO + '/';
    const pages = await enablePages(token);
    if (pages) {
      console.log('✅ GitHub Pages 已开启（首次构建约 1~2 分钟）');
      console.log('   访问地址：' + url);
    } else {
      console.log('⚠️  Pages 未自动开启（可能是密令没有 Pages 权限）。请手动到：');
      console.log('   https://github.com/' + OWNER + '/' + REPO + '/settings/pages');
      console.log('   设置 Source = Deploy from a branch → main → / (root)，保存后访问：');
      console.log('   ' + url);
    }
  } catch (e) {
    console.log('\n❌ 部署失败：' + e.message);
    console.log('   请确认密令正确，且已授予 Contents 读/写权限（建议同时授予 Pages 读/写）。');
    process.exit(1);
  }
})();