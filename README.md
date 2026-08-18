# youzi (柚子) · 逆向工程与自动化工具

对目标站 `yznb.4y3d.cc`（柚子）的接口协议进行逆向，并基于破解的传输加密实现两类自动化工具：

1. **自动邀请工具**（`invite-tool/`，图形界面）——一键创建主账号并批量邀请次账号，为主账号赚取金币 / 升级 VIP。
2. **视频下载脚本**（`download.js`，命令行）——根据影片 ID 拉取播放地址并下载为 MP4。

## 核心情报：传输加密

目标站所有 API 请求/响应使用 **AES-GCM 加密**（密钥从前端 bundle 逆向获得）：

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
├── download.js            # 视频下载脚本（ffmpeg 拉 m3u8 + 自动解密分片）
├── invite-tool/           # ★ 自动邀请工具（图形界面，主交付物）
│   ├── server.js          #   本地 HTTP 服务 + 业务逻辑
│   ├── start.js           #   一键入口（起服务 + 自动开浏览器）
│   ├── 启动.bat           #   Windows 双击启动脚本
│   ├── lib/               #   代理检测 / 加密请求 / 邀请业务
│   └── public/            #   前端界面（状态灯 / 按钮 / 日志 / 历史记录）
├── README.md              # 本文档
├── README_invite.md       # 邀请链路逆向情报 + 使用文档
└── package.json           # 依赖：undici
```

## 快速开始

### 自动邀请工具（图形界面）

```bash
cd invite-tool
npm install
node start.js
```

浏览器会自动打开 `http://127.0.0.1:5888`。界面提供：

- 「邀请 3 人」/「邀请 7 人」按钮：一键创建全新主账号 + 批量邀请次账号
- 实时日志、主账号金币/VIP 状态
- 历史记录面板：每次运行的主账号/密码/邀请码/次账号列表

> **前提**：目标站注册有按出口 IP 的每日上限，工具需配合 **Hiddify** 代理（本地 `127.0.0.1:12334`）使用，程序会自动检测并提示。

### 视频下载（命令行）

```bash
# 需要 ffmpeg 在 PATH 中
node download.js 426          # 下载影片 id=426 到 outputs/
node download.js 426 0:30     # 只下前 30 秒
```

## 安全性说明

- 每次运行生成**全新**主账号 + 次账号，互不冲突
- 请求走代理轮换出口 IP + 随机限速 + 串行执行，降低触发风控的概率
- 账号凭证保存在本地 `invite-tool/accounts/`（已被 `.gitignore` 排除，不会上传）

## 免责声明

本项目仅用于**技术研究与学习**目的。请勿用于任何商业用途或违反目标网站服务条款的行为；使用本项目产生的一切后果由使用者自行承担。
