import { Hono } from "hono";
import authRoutes from "./routes/auth";
import sourceRoutes from "./routes/sources";

const app = new Hono<{ Bindings: CloudflareBindings }>();

// 注册认证路由
app.route("/auth", authRoutes);

// 注册RSS源路由
app.route("/sources", sourceRoutes);

// 测试端点
app.get("/message", (c) => {
  return c.text("Hello Hono!");
});

export default app;
