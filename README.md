# 落鲸起始页

一款轻量、现代、国际化的浏览器起始页。采用原生 HTML、CSS 和 JavaScript 开发，默认使用 Bing 搜索，内置国际常用网站，并支持用户直接在页面中自定义快捷入口。无需构建工具或后端，上传后即可通过 GitHub Pages 使用。

## 功能

- 现代 iOS / Glassmorphism 视觉，克制使用透明与模糊
- 桌面、平板和手机响应式布局，支持安全区与触控操作
- Bing 搜索建议：防抖、上下键选择、Enter 确认、Esc 或点击外部关闭
- 兼容中文输入法 composition 事件，避免拼音输入期间误请求
- WAI-ARIA Listbox 交互语义与读屏状态提示
- 浅色、深色主题：首次跟随系统，手动切换后记住选择
- 中英文界面一键切换，首次根据浏览器语言自动选择
- 默认提供 YouTube、GitHub、Wikipedia、Gmail、Reddit、X、LinkedIn、Netflix
- 页面内管理快捷网站：新增、删除、恢复国际默认项，配置保存在本地
- 原生 SVG 和系统字体，无框架、字体包或图片请求
- 支持 `prefers-reduced-motion`

## 目录结构

```text
.
├── index.html                 页面结构、管理弹窗和 SEO 信息
├── beginPageCss1.css          主题、布局、弹窗和响应式样式
├── search-suggestions.js      Bing 建议、国际化、主题和快捷入口
├── assets/
│   └── favicon.svg            轻量矢量站点图标
└── README.md                  项目说明
```

## 本地预览

项目不需要安装依赖。可以直接双击 `index.html`；推荐在项目目录启动静态服务器，以便获得与线上一致的资源加载方式：

```bash
python -m http.server 8080
```

访问 `http://localhost:8080`。Bing 建议服务需要联网；建议不可用时不会影响普通搜索。

## 部署到 GitHub Pages

1. 将本目录全部文件放到 GitHub 仓库根目录并推送。
2. 打开仓库的 **Settings → Pages**。
3. Source 选择 **Deploy from a branch**，Branch 选择 `main` 和 `/ (root)`。
4. 保存并等待部署完成。

用户名仓库（例如 `yourname.github.io`）也可直接使用。若原项目已有 `CNAME`，替换文件时请保留，以免自定义域名失效。

## 自定义快捷网站

点击页面“常用网站”右侧的 **自定义** 按钮，即可新增网站、删除快捷入口或恢复国际默认项。设置保存在浏览器 `localStorage` 中，不会上传到任何服务器；不同浏览器和设备会分别保存。

如需修改所有访问者首次打开时看到的默认网站，可编辑 `search-suggestions.js` 顶部的 `DEFAULT_SHORTCUTS`：

```js
{
  nameZh: "GitHub",
  nameEn: "GitHub",
  label: "GH",
  url: "https://github.com/",
  color: "#7c8799"
}
```

- `nameZh`、`nameEn`：中英文界面显示名称
- `label`：卡片图标短文字，建议不超过 4 个字符
- `url`：完整 HTTP/HTTPS 地址
- `color`：品牌点缀色

页面内最多保存 20 个网站。读取本地设置时会重新验证协议、长度和颜色格式。

## 国际化

页面首次打开时根据浏览器语言选择中文或英文，之后使用右上角语言按钮切换并记住选择。界面文案集中在脚本的 `I18N` 对象中，可以继续添加或调整翻译；默认网站分别使用 `nameZh` 和 `nameEn`。

## Bing 搜索建议机制

正式搜索提交到 `https://www.bing.com/search`，关键词参数为 `q`。GitHub Pages 是纯静态托管，直接 `fetch` 第三方服务可能受跨域策略限制，因此建议功能使用 Bing OpenSearch 端点的 JSONP 返回方式，为每次请求生成唯一回调，并通过动态 `<script>` 加载结果。

实现包含以下保护：

- 输入停止 220ms 后请求，减少接口压力
- 查询参数由 `URLSearchParams` 安全编码
- 回调名称仅由内部递增序号产生
- 对响应结构和条目类型进行检查，只用 `textContent` 写入建议
- 旧请求不会覆盖新输入，5 秒超时后清理脚本和全局回调
- 接口异常时自动降级，普通 Bing 搜索保持可用

JSONP 会执行第三方返回的脚本，因此只应连接可信且固定的服务地址。端点集中定义在 `SUGGESTION_ENDPOINT`，便于审计或替换。

## 性能与兼容性

- 首屏仅加载 HTML、CSS、延迟执行的 JS 和 SVG 图标
- 不使用 npm、框架、Web Font、远程背景或运行时组件库
- 建议请求仅在输入后发生；自定义数据完全保存在本地
- 透明模糊提供纯色回退，核心搜索与导航不依赖高级视觉特性
- 面向当前 Chrome、Edge、Firefox、Safari、iOS Safari 和 Android Chrome
- `color-mix()` 仅用于视觉增强，不支持时不影响核心功能

## 自定义视觉

主题色、圆角、背景和阴影集中在 `beginPageCss1.css` 顶部的 CSS 变量中。修改 `--accent`、`--bg`、`--surface` 等变量即可形成自己的风格。

## 许可

这是一次原创重写，可按项目需要继续修改、部署和使用。
