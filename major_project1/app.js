import { readFile, writeFile } from "fs/promises";
import { createServer } from "http";
import path from "path";
import crypto from "crypto";

const data_file = path.join("data", "links.json");

// Reusable file-serving function
const serveFile = async (res, filePath, contentType) => {
  try {
    const data = await readFile(filePath);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  } catch (error) {
    res.writeHead(404, { "Content-Type": contentType });
    res.end("404 page not found");
  }
};

const PORT = 3010;

const loadLinks = async () => {
  try {
    const data = await readFile(data_file, "utf-8");
    // Handle empty file or invalid JSON
    if (!data.trim()) {
      await writeFile(data_file, JSON.stringify({}));
      return {};
    }
    return JSON.parse(data);
  } catch (error) {
    if (error.code === "ENOENT" || error instanceof SyntaxError) {
      // File doesn't exist or contains invalid JSON
      await writeFile(data_file, JSON.stringify({}));
      return {};
    }
    throw error;
  }
};

const saveLinks = async (links) => {
  await writeFile(data_file, JSON.stringify(links));
};

const server = createServer(async (req, res) => {
  // Add CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === "GET") {
    if (req.url === "/") {
      await serveFile(res, path.join("public", "index.html"), "text/html");
    } else if (req.url === "/style.css") {
      await serveFile(res, path.join("public", "style.css"), "text/css");
    } else {
      // Handle shortened URL redirects
      const shortcode = req.url.slice(1); // Remove leading slash
      if (shortcode) {
        try {
          const links = await loadLinks();
          if (links[shortcode]) {
            res.writeHead(302, { "Location": links[shortcode] });
            res.end();
            return;
          }
        } catch (error) {
          console.error("Error loading links:", error);
        }
      }
      
      res.writeHead(404, { "Content-Type": "text/html" });
      res.end("404 page not found");
    }
  }

  else if (req.method === "POST" && req.url === "/shorten") {
    const links = await loadLinks();
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", async () => {
      try {
        const { url, shortcode } = JSON.parse(body);

        if (!url) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          return res.end("URL is required");
        }

        const finalShortCode = shortcode || crypto.randomBytes(4).toString("hex");

        if (links[finalShortCode]) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          return res.end("Short code already exists. Please choose another one.");
        }

        links[finalShortCode] = url;
        await saveLinks(links);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, shortcode: finalShortCode }));

      } catch (err) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Server error");
      }
    });
  }

  else {
    res.writeHead(405, { "Content-Type": "text/html" });
    res.end("Method not allowed");
  }
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});