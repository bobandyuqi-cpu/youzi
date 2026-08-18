# 邀请链路研究笔记 (invite chain)

> 目标平台域名已打码：`yznb` `[.]` `4y3d` `[.]` `cc`（按 `[.]` 替换为英文句点拼接）
> 本文仅为协议研究记录，请勿用于任何违规用途。

传输加密: AES-GCM, 密钥 `0e3d2cf6f78dc8d8` (见 `crypto.js`)
加解密协议: `base64( [12字节nonce] || AES-GCM密文(+16字节tag) )`

---

## ✅ 邀请链路已完整验证通过

**链路**: 主账号(邀请人) → 生成邀请码/链接 → 次账号带码注册 → 主账号自动收到被邀记录 + 金币奖励。

### 验证结果摘要 (示例值, 非真实账号)

| 项 | 值 |
|----|-----|
| 主账号 | `<随机账号>` (uid 例如 `2000956`) |
| 主账号邀请码 | 8 位小写字母数字, 例如 `02f2f434` |
| 主账号邀请链接 | `https://<平台域名>/?inviteCode=<8位码>&sig=<hex>` |
| 被邀请账号 | 每个主账号可邀请 N 个, 全部上账 |
| 主账号钱包 | 每邀 1 人 +30 金币, 实时到账 |
| 主账号 invite/list | 被邀记录全部上账 (含 account / invited_at / nickname) |

> 每次运行会生成**全新的主账号 + N 个被邀账号**, 凭证保存在 `invite-tool/accounts/` 下
> (该目录已在 `.gitignore` 中排除, 不会上传)。
> **Token 有效期约 1000 天** (expires_in=86313600 秒), 但建议按需用账号+密码重新登录。

---

## 接口情报 (脚本能复用的所有点)

### 注册接口 `/api/auth/reg`
```
POST body: {
  account, password, verify_password,
  ch: '' ,            // 渠道/推广来源
  invite_code: '',    // ★ 被邀请人填邀请人的码
  device_type: 'H',   // H = 手机(H5), 有别的值可试
  version: '0.0.0'
}
Headers: Content-Type: text/plain;charset=UTF-8
         X-Device-Id: dev-<16hex>   (设备指纹, 随机即可)
```
成功返回 `data.token` (JWT, 内含 uid) + `data.refresh_token`。

### 邀请相关
- `user/info` 返回: `invite_code`, `invite_link`, `qr_code`, `invite`(已邀人数), `parent_uid`(上级 uid, 空=无上级)
  - invite_link 格式: `https://<平台域名>/?inviteCode=<8位码>&sig=<hex>`
  - qr_code 格式: `<uid>#<hex>`
- `user/invite/list` `{page, page_size}` → `data.list[]`, 每条含被邀账号 `account`, `invited_at`(秒), `nickname`, `invite_code`
- `user/walletinfo` → `data.gold`(金币)

### 每邀 1 人奖励
实测 **30 金币/人**, 实时到账。里程碑奖励见 bundle(未逐一实测, 可查 `config.invite.milestones`)。

---

## ⚠️ 关键难点 & 解法: 注册被 IP 限速

`/api/auth/reg` 有 **按出口 IP 的每日注册上限** (报 `"该IP今日注册次数已达上限"`)。

**教训**: 本机直连(node 默认 fetch 直连)会走本机公网 IP, 批量注册必然触发上限。
**解法**: 必须走代理换出口 IP。本项目用 **Hiddify** 本地 HTTP 代理 `127.0.0.1:12334` + **undici ProxyAgent**, 并**每次请求重建连接**, 让 Hiddify 节点池轮换出口 IP, 从而分散限速。

> 代理端口不是固定的, 用前先查系统代理: `HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings → ProxyServer`
> 例: `http://127.0.0.1:12334`。设 `PROXY` 环境变量可覆盖。

### 确认是否走了代理
```
node -e "const{ProxyAgent,fetch}=require('undici');(async()=>{const a=new ProxyAgent('http://127.0.0.1:12334');const r=await fetch('http://ip-api.com/json/?fields=query,country,isp',{dispatcher:a});console.log(await r.json())})()"
```

---

## 使用方式 (完整工具, 见 `invite-tool/`)

图形界面版 (推荐):

```bash
cd invite-tool
node start.js      # 首次自动装依赖, 自动起服务并打开浏览器 http://127.0.0.1:5888
```

界面提供「邀请 3 人」/「邀请 7 人」两个按钮, 一键完成: 注册主账号 → 读邀请码 → 批量邀请 → 校验金币/VIP。
每次运行结果 (账号/密码/邀请码) 会显示在界面"历史记录"里, 凭证保存在 `invite-tool/accounts/`。

---

## 一起交付的脚本
- `crypto.js` — AES-GCM 加解密工具
- `download.js` — 媒体流下载 (ffmpeg 拉取, 自动解密分片)
- `invite-tool/` — ★ 邀请自动化工具 (图形界面, 主交付物)

## 已知可再扩展的方向
- 被邀请人注册后是否需要额外操作才触发**里程碑**奖励(当前每邀 1 人 30 金币是立到的)
- 邀请链可继续向下延伸(被邀人再邀人 → 多级奖励), `parent_uid` 字段暗示层级结构
