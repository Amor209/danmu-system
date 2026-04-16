const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cloudbase = require("@cloudbase/node-sdk");

const app = cloudbase.init({
  env: "这里填写你的腾讯云环境ID"
});
const db = app.database();

const expressApp = express();
const server = http.createServer(expressApp);
const io = new Server(server, {
  cors: { origin: "*" }
});

expressApp.use(express.json());
expressApp.use(express.static("public"));

io.on("connection", (socket) => {
  console.log("用户连接：" + socket.id);

  socket.on("login", async (data, callback) => {
    const { realName, idCard } = data;
    if (!realName || !idCard) {
      callback({ success: false, msg: "请填写实名信息" });
      return;
    }
    await db.collection("users").add({
      realName, idCard, socketId: socket.id, createTime: new Date()
    });
    socket.realName = realName;
    socket.isAdmin = realName === "admin";
    callback({ success: true });

    const themeRes = await db.collection("config").doc("theme").get();
    const theme = themeRes.data?.value || "欢迎使用弹幕系统";
    socket.emit("theme", theme);
  });

  socket.on("sendDanmu", async (content) => {
    if (!socket.realName) return;
    const danmu = {
      realName: socket.realName,
      content,
      createTime: new Date()
    };
    await db.collection("danmus").add(danmu);
    io.emit("newDanmu", danmu);
  });

  socket.on("setTheme", async (theme) => {
    if (!socket.isAdmin) return;
    await db.collection("config").doc("theme").set({ value: theme });
    io.emit("theme", theme);
  });

  socket.on("deleteDanmu", async (id) => {
    if (!socket.isAdmin) return;
    await db.collection("danmus").doc(id).delete();
    io.emit("deleteDanmu", id);
  });
});

const PORT = 8080;
server.listen(PORT, () => {
  console.log("服务启动：端口" + PORT);
});
