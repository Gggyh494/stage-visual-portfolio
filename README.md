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

## 更换线上素材

1. 在已通过 Git 登录 GitHub 的电脑上，解压仓库并双击 **start-github-admin.cmd**。也可运行 `node manage.mjs --github`，打开终端显示的本机地址。需要 Node.js 22 或更新版本及 Git。
2. 选首页或某个案例里的素材位置，选择图片、MP4 或 WebM，预览后点「上传并发布」。工具会在一次提交中放入新文件并更新所选位置。每个文件最多 90 MiB。
3. 提交成功后可查看提交记录。GitHub Pages 部署完成后，新素材会出现在作品集上。若别人先更新了仓库，点「刷新素材列表」后重新选文件。

发布工具只在本机监听，使用电脑已有的 GitHub 凭据，目标固定为 `Gggyh494/stage-visual-portfolio` 的 `main`。打开 [管理入口](https://gggyh494.github.io/stage-visual-portfolio/admin/) 可下载工具。也可在 GitHub 素材目录上传同名、同格式文件进行替换，网页单文件上限为 25 MiB。

## 舞台展映

- 声波开场：3:1，紫银巡演主屏。
- 暖铜揭幕：4:1，品牌发布会主屏。
- 光场行进：32:9，沉浸空间预览。
- 熔金脉阵、冰弧巡游、白瓷轴线、荧柠信标和珊瑚引力各有一段标题版。无字版可在各自的案例页播放。

八段样片均为 7 秒 H.264 MP4，按原画幅播放。首页可选章节、播放、暂停、拖动和全屏，离开播放器后暂停。

## 长画幅与素材

- 首页展示五个精选项目。首屏封面留空时会用主推项目的全景图。两个管理工具都可更换首页默认循环片和各项目的首屏循环片，建议使用无声的 16:9 MP4。
- 案例把项目全景、现场视频和屏幕原画分开。3:1、4:1 及更长的图片或视频按原比例显示；图片可点击放大后横向拖动。像素和比例来自媒体本身。
- 大屏视频建议导出可在手机直接播放的 H.264 MP4（音频可用 AAC）。本地编辑器支持单文件 90 MiB 以内。对很长或较大的视频，建议单独托管，用支持 HTTPS 和分段播放的 MP4/WebM 直链；普通分享页链接不等于视频文件地址。[GitHub 文件大小限制](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github)
- 示例图和视频仅用于看版式与播放器，来源与生成提示见 **素材与参考.md**。换完内容后，在管理页取消「概念样板」标记。

交互参考：[Apple Vision Pro Guided Tour](https://www.apple.com/ca/apple-vision-pro/guided-tour/) 的章节化看片，以及 [Bang & Olufsen Beolab 90](https://www.bang-olufsen.com/en/ca/speakers/beolab-90) 的全画面展示和按需深入查看。
