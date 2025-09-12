// 简化版后端入口文件
import { Hono } from "hono";
import { cors } from "hono/cors";
import adminRoutes from "./routes/admin/index-simple";

const app = new Hono();

// 添加CORS中间件
app.use(
  cors({
    origin: (origin) => origin,
    allowMethods: ['POST', 'PUT', 'DELETE', 'GET', 'OPTIONS'],
    exposeHeaders: ['Content-Length', 'X-Kuma-Revision'],
    allowHeaders: ['Content-Type', 'Authorization', 'Accept', 'Accept-Language', 'Access-Control-Request-Headers', 'Access-Control-Request-Method', 'Cache-Control', 'Connection', 'Origin', 'Pragma', 'Referer', 'Sec-Fetch-Mode', 'User-Agent'],
    maxAge: 600,
    credentials: true,
  })
);

// 注册管理员API路由
app.route("/admin", adminRoutes);

// 测试端点
app.get("/message", (c) => {
  return c.text("Hello Hono!");
});

export default {
  fetch: app.fetch.bind(app),
};