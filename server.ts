import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Proxy for OpenRouter Models
  app.get("/api/models", async (req, res) => {
    try {
      const response = await axios.get("https://openrouter.ai/api/v1/models");
      res.json(response.data);
    } catch (error: any) {
      console.error("Error fetching models:", error.message);
      res.status(500).json({ error: "Failed to fetch models" });
    }
  });

  // Proxy for OpenRouter Key Info (Usage/Limits)
  app.get("/api/key-info", async (req, res) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(401).json({ error: "OPENROUTER_API_KEY is not set in environment variables." });
    }

    try {
      const response = await axios.get("https://openrouter.ai/api/v1/auth/key", {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });
      res.json(response.data);
    } catch (error: any) {
      console.error("Error fetching key info:", error.message);
      res.status(error.response?.status || 500).json({ error: error.response?.data || "Failed to fetch key info" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
