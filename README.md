# Interactive Labs / 交互实验集

独立静态网页交互 Demo 合集。每个小实验位于自己的子目录，不需要编译或后端，兼容 GitHub Pages。

## 实验

| 目录 | 名称 | 技术 |
| --- | --- | --- |
| [camera-simulator/](./camera-simulator/) | 微单相机模拟器 | 原生 HTML/CSS/JavaScript、Canvas 2D |

## 本地运行

可以直接打开 `index.html`；推荐在根目录执行 `python -m http.server 8000`，访问 `http://localhost:8000/`。

## 发布

已包含 `.github/workflows/pages.yml`。在 GitHub 仓库 Settings → Pages 将 Source 设为 **GitHub Actions**，之后每次 push main 自动部署。

## 新增实验

新增 `some-demo/index.html` 及可选资源，并在根目录 `index.html` 添加卡片链接。

## 关于模拟精度

演示以 20–70mm F4、全画幅相机为参考，风景由 Canvas 程序绘制。曝光、景深、动态模糊与噪声是教学近似，不是精确光学仿真。
