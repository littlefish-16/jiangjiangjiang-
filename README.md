# 三只蒋蒋 · 打卡小站 ✿

一个可爱风格的成员打卡网站：日历打卡 + 每日项目打卡 + 图片凭证 + 心情留言，全部数据都保存在这个 GitHub 仓库里（无需独立服务器）。

## 成员
- 蒋蒋1（小鸡）
- 蒋蒋2（小兔）
- 蒋蒋3（小熊）

## 功能
- 🗓️ 首页日历，按日期显示每位成员的打卡情况；当天所有项目都完成 → 日历上的图标被点亮 ✨
- ✅ 每位成员一列打卡项目，勾选完成（勾选时必须上传一张 jpg/png 图片做凭证）
- 👀 每个已完成项目旁有「查看」按钮，查看当天的打卡图片
- 🎨 点击三只吉祥物 / 列头像 → 进入「打卡项目设计」，可给自己或别人添加、修改、删除项目
- 📷 个人中心：上传/修改头像、设置今日心情、设置今日留言
- 🔑 无需密码，只需选择用户名登录（蒋蒋1 / 蒋蒋2 / 蒋蒋3）

## 权限规则
- 未登录：只能浏览（日历、看板、历史、查看图片）
- 登录后：只能给「自己」勾选打卡；任何人可给「任意成员」设置打卡项目

## 数据如何保存
GitHub Pages 是纯静态托管、没有服务器，所以本网站把你的 **GitHub 仓库本身当成数据库**：
- 打卡记录 → `data/db.json`
- 打卡图片 → `images/日期/成员名/xxx.jpg`
- 头像 → `images/avatars/xxx.png`

保存数据需要一个 **GitHub 密令（fine-grained token，只需 Contents 读写权限）**。成员第一次打卡/保存时，网站会弹出引导，把密令粘贴一次、存在自己的浏览器里即可（不会进入公开代码）。

## 目录结构
```
index.html                 首页
assets/
  config.js                配置（仓库 owner/repo/branch、成员、心情表情）
  icons.js                 三只吉祥物 + 可爱图标
  styles.css               柔和少女风样式
  app.js                   全部逻辑（存储 / 日历 / 打卡 / 项目 / 个人中心）
data/db.json               打卡数据（JSON）
images/                    打卡图片与头像（自动按 日期/成员 建目录）
```

## 部署（GitHub Pages）
1. 把整个项目推送到本仓库 `main` 分支。
2. 仓库 `Settings → Pages`，Source 选 `Deploy from a branch`，Branch 选 `main`、目录 `/ (root)`，保存。
3. 等 1 分钟左右，访问：`https://littlefish-16.github.io/jiangjiangjiang-/`

## 使用（首次）
1. 打开网站，右上角「登录」选一位成员。
2. 点击三只吉祥物给成员添加打卡项目，点「保存项目」——此时会提示创建并粘贴 GitHub 密令。
3. 之后就可以在主页勾选项目、上传图片、设置心情留言啦。

> 密令创建：GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens →
> 仓库选 `littlefish-16/jiangjiangjiang-`，权限 `Contents = Read and write`。