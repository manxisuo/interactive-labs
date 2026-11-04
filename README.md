# Interactive Labs / 交互实验集

独立静态网页交互 Demo 合集。每个小实验位于自己的子目录，不需要编译或后端，兼容 GitHub Pages。

## 实验

| 目录 | 名称 | 技术 |
| --- | --- | --- |
| [camera-simulator/](./camera-simulator/) | 微单相机模拟器 | 原生 HTML/CSS/JavaScript、Canvas 2D |
| [am-radio/](./am-radio/) | AM 收音机原理演示 | 原生 HTML/CSS/JavaScript、Canvas 2D |

| [traffic-jam/](./traffic-jam/) | 幽灵堵车交通元胞自动机 | 原生 HTML/CSS/JavaScript、Canvas 2D |
| [genetic-evolution/](./genetic-evolution/) | 进化实验室 | 原生 HTML/CSS/JavaScript、Canvas 2D |
| [game-of-life/](./game-of-life/) | 康威生命游戏 | 原生 HTML/CSS/JavaScript、Canvas 2D |
| [ecosystem/](./ecosystem/) | 微型生态圈 | 原生 HTML/CSS/JavaScript、Canvas 2D |
| [doppler-effect/](./doppler-effect/) | 多普勒效应实验室 | 原生 HTML/CSS/JavaScript、Canvas 2D、Web Audio API |
| [microscope/](./microscope/) | 光学显微镜实验室 | 原生 HTML/CSS/JavaScript、SVG、Canvas 2D |
| [glider-logic/](./glider-logic/) | 滑翔机逻辑计算实验室 | 原生 HTML/CSS/JavaScript、Canvas 2D |

## 本地运行

可以直接打开 `index.html`；推荐在根目录执行 `python -m http.server 8000`，访问 `http://localhost:8000/`。

## 发布

已包含 `.github/workflows/pages.yml`。在 GitHub 仓库 Settings → Pages 将 Source 设为 **GitHub Actions**，之后每次 push main 自动部署。

## 新增实验

新增 `some-demo/index.html` 及可选资源，并在根目录 `index.html` 添加卡片链接。

## 关于模拟精度

演示以 20–70mm F4、全画幅相机为参考，风景由 Canvas 程序绘制。曝光、景深、动态模糊与噪声是教学近似，不是精确光学仿真。

## 模型说明

- 进化实验采用遗传算法优化固定长度运动指令，无法感知新环境；改变目标需重新进化。
- 康威生命游戏和滑翔机真实碰撞使用同步 B3/S23 邻域计算；逻辑门动画是布尔信号教学抽象，并非经过验证的康威逻辑门实体电路。
- 生态系统是简化个体模型，未使用真实生态数据标定。
- 交通模拟基于单车道周期边界 NaSch 规则，时空图与基本图是模拟观测，不是实际道路预测。
