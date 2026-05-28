import http from "http";
import path from "path";
import express from "express";
import apiRouter, { startPeriodicCleanup } from "./src/server/api";

const app = express();
const port = Number(process.env.PORT) || Number(process.env.APP_PORT) || 5000;

// Mount modular API router
app.use("/api", apiRouter);

// Start background expiration task
startPeriodicCleanup();

const server = http.createServer(app);

if (process.env.NODE_ENV === "production") {
    // Production: Serve the compiled SPA static files from 'dist'
    app.use(express.static(path.resolve("dist")));
    app.get(/.*/, (req, res) => {
        res.sendFile(path.resolve("dist/index.html"));
    });
} else {
    // Development: Mount Vite dev server middleware
    console.log("Starting Vite server in development middleware mode...");
    (async () => {
        const { createServer: createViteServer } = await import("vite");
        const vite = await createViteServer({
            server: {
                middlewareMode: true,
                hmr: server
            },
            appType: "spa",
        });
        app.use(vite.middlewares);
    })();
}

server.listen(port, "0.0.0.0", () => {
    const url = process.env.APP_URL || `http://localhost:${port}`;
    console.log(`[File Sender] Running gracefully on ${url}`);
});
