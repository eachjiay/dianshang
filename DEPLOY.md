# 帝全电商平台 Docker 部署

## 服务器准备

安装 Docker 和 Docker Compose 后，开放阿里云安全组 80 端口。

## 部署

```bash
git clone https://github.com/eachjiay/dianshang.git
cd dianshang
cp .env.example .env
```

编辑 `.env`，把 `JWT_SECRET` 改成一串足够长的随机字符串。

```bash
docker compose up -d --build
```

## 验证

```bash
docker compose ps
curl http://localhost:5000/health
```

浏览器访问：

```text
http://服务器公网IP
```

演示账号密码均为 `123456`：

- 管理员：`13800000001`
- 商家：`13800000002`
- 企业采购用户：`13800000003`
