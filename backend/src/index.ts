import { Hono } from "hono";
import authRoutes from "./routes/auth";

const app = new Hono<{ Bindings: CloudflareBindings }>();

// 注册认证路由
app.route("/auth", authRoutes);

// 测试端点
app.get("/message", (c) => {
  return c.text("Hello Hono!");
});

export default app;
