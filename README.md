# 舞台视觉作品集

[浏览作品集](https://gggyh494.github.io/stage-visual-portfolio/) · [登录管理作品](https://gggyh494.github.io/stage-visual-portfolio/admin/)

## 本地预览与管理

1. 安装 Node.js 22 或更高版本。Windows 双击 **start-admin.cmd**，或在这个目录运行 `node manage.mjs`。
2. 在浏览器打开 [本机作品管理](http://127.0.0.1:8788/_editor/)。可以改工作室文案和邮箱、新建或调整案例顺序、上传图片和视频，并编辑项目需求、制作范围、交付内容。
3. 点击「保存更改」后，打开 [作品集](http://127.0.0.1:8788/) 或刷新页面。保存会更新 `docs/portfolio.json`；上传会把素材放进 `docs/media/uploads/`。关闭终端即可停止本机管理。

本机管理只监听 127.0.0.1，编辑工具不在 GitHub Pages 的发布目录里。需要单独发一个本地预览文件，可运行 `node pack.mjs preview.html`。这个预览文件会包含本地素材；外链素材仍需要网络。

## 发布到个人 GitHub

1. 把模板目录里的文件放到目标仓库根目录，保留 `.pages.yml` 和 `docs/.nojekyll`。不要上传打包生成的单文件预览，GitHub Pages 直接使用 `docs/`。
2. 在仓库 **Settings → Pages** 下选择 **Deploy from a branch**，选默认分支（如 `main`）和 **/docs**，保存。等部署完成后，从 Settings → Pages 复制网站链接。个人项目站地址通常是 `https://用户名.github.io/仓库名/`。
3. 给客户发网站链接，或直接发带 `#case/项目ID` 的案例链接。也可以把网站链接填进仓库 About → Website 方便查找。

普通 GitHub Pages 网站可在互联网上访问；即使仓库是私有的，也不能据此判断作品页是私有的。免费个人账号通常使用公开仓库，私有仓库的 Pages 可用性取决于账号方案。发布前替换示例内容，确认正式素材适合公开展示。见 [GitHub Pages 官方说明](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)。

## 线上编辑素材

访问网站末尾的 `/admin/`，或直接进入 [Pages CMS](https://app.pagescms.org/)。用 GitHub 登录，把 Pages CMS 的 GitHub App 授权给**该作品集仓库**，然后打开「舞台作品集」。字段和上传目录已在 `.pages.yml` 配好；保存内容会写回仓库，随后由 GitHub Pages 更新公开页面。访客不需要登录，也不会得到编辑权限。配置步骤见 [Pages CMS 快速开始](https://pagescms.org/docs/quick-start/)。

## 长画幅与素材

- 首页最多展示三个精选项目；主推案例可选，首屏封面留空时会用主推项目的全景图。
- 案例把项目全景、现场视频和屏幕原画分开。3:1、4:1 及更长的图片或视频按原比例显示；图片可点击放大后横向拖动。像素和比例来自媒体本身。
- 大屏视频建议导出可在手机直接播放的 H.264 MP4（音频可用 AAC）。本地编辑器支持单文件 90 MiB 以内。对很长或较大的视频，建议单独托管，用支持 HTTPS 和分段播放的 MP4/WebM 直链；普通分享页链接不等于视频文件地址。[GitHub 文件大小限制](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github)
- 示例图和视频仅用于看版式与播放器，来源与生成提示见 **素材与参考.md**。换完内容后，在管理页取消「概念样板」标记。
