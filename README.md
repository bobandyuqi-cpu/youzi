# youzi · 协议研究与自动化脚本集

对某视频平台（目标域名隐去，见下）的传输协议进行研究，并基于研究结果实现两类自动化脚本。本项目仅用于**协议分析学习**，请勿用于任何违反平台条款或法律的行为。

## 研究目标（域名已打码，请手动拼接）

> 目标域名：`yznb` `[.]` `4y3d` `[.]` `cc`（按 `[.]` 替换为英文句点拼接）

## 核心研究结论：传输加密

平台所有 API 请求/响应使用 **AES-GCM 加密**（密钥从前端脚本分析获得）：

- 密钥：`0e3d2cf6f78dc8d8`（16 字节 = AES-128）
- 协议格式：`base64( [12字节nonce] || AES-GCM密文(+16字节tag) )`
- 实现见 [`crypto.js`](crypto.js)（Node 原生 `webcrypto.subtle`）

```js
const { gcmEncrypt, gcmDecrypt } = require('./crypto.js');
const body = await gcmEncrypt(JSON.stringify({ id: 426 }), KEY_TEXT);
const resp = JSON.parse(await gcmDecrypt(raw, KEY_TEXT));
```

## 目录结构

```
youzi/
├── crypto.js              # AES-GCM 加解密工具（核心）
├── download.js            # 媒体流下载脚本（ffmpeg 拉取 + 自动解密分片）
├── invite-tool/           # ★ 账号推广自动化工具（图形界面，主交付物）
│   ├── server.js          #   本地 HTTP 服务 + 业务逻辑
│   ├── start.js           #   一键入口（自动装依赖 + 起服务 + 自动开浏览器）
│   ├── 启动.bat           #   Windows 双击启动脚本
│   ├── lib/               #   代理检测 / 加密请求 / 邀请业务
│   └── public/            #   前端界面（状态灯 / 按钮 / 日志 / 历史记录）
├── README.md              # 本文档
├── README_invite.md       # 邀请链路研究笔记
└── package.json           # 依赖：undici
```

## 快速开始

### 邀请自动化工具（图形界面）

```bash
cd invite-tool
node start.js
```

首次运行会自动安装依赖（`npm install`），然后自动打开 `http://127.0.0.1:5888`。界面提供：

- 「邀请 3 人」/「邀请 7 人」按钮：一键创建全新主账号 + 批量邀请
- 实时日志、主账号金币/VIP 状态
- 历史记录面板：每次运行的主账号/密码/邀请码/次账号列表

> **前提**：目标平台注册有按出口 IP 的每日上限，工具需配合本地代理（如 Hiddify，默认端口 `127.0.0.1:12334`）使用，程序会自动检测并提示。

### 媒体流下载（命令行）

```bash
# 需要 ffmpeg 在 PATH 中
node download.js 426          # 下载媒体 id=426 到 outputs/
node download.js 426 0:30     # 只下前 30 秒
```

## 安全性说明

- 每次运行生成**全新**主账号 + 次账号，互不冲突
- 请求走代理轮换出口 IP + 随机限速 + 串行执行，降低触发风控的概率
- 账号凭证保存在本地 `invite-tool/accounts/`（已被 `.gitignore` 排除，不会上传）

## 免责声明

本项目仅供**协议逆向与安全技术研究**使用。使用者须自行确保：
1. 已获得目标平台的授权或符合其服务条款；
2. 不用于任何商业用途、侵权或违法活动；
3. 遵守当地法律法规。

使用本项目产生的一切后果由使用者自行承担，作者不对任何滥用行为负责。
