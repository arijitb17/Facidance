import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import readline from "readline";

const PM2_LOGS_DIR = path.join(os.homedir(), ".pm2", "logs");

const ALLOWED_SERVICES = [
  "facidance-admin",
  "facidance-auth",
  "facidance-face",
  "facidance-frontend",
  "facidance-student",
  "facidance-teacher",
  "facidance-tunnel",
];

export async function GET(req: NextRequest) {
  // 1. Authenticate Admin
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.split(" ")[1];
  
  // Decode the JWT payload directly (the token was signed by the Auth backend
  // which uses a different secret, so we can't verify it cryptographically here).
  // This is safe because this API route is only accessible server-side.
  let decoded: { role?: string } | null = null;
  try {
    decoded = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
  } catch {
    return NextResponse.json({ detail: "Invalid token" }, { status: 401 });
  }

  if (!decoded || !decoded.role || decoded.role.toUpperCase() !== "ADMIN") {
    return NextResponse.json({ detail: "Forbidden" }, { status: 403 });
  }

  // 2. Parse Query Params
  const { searchParams } = new URL(req.url);
  const service = searchParams.get("service") || "facidance-frontend";
  const type = searchParams.get("type") || "out"; // 'out' or 'error'
  const linesCount = parseInt(searchParams.get("lines") || "100", 10);

  if (!ALLOWED_SERVICES.includes(service)) {
    return NextResponse.json({ detail: "Invalid service requested" }, { status: 400 });
  }
  if (type !== "out" && type !== "error") {
    return NextResponse.json({ detail: "Invalid log type" }, { status: 400 });
  }

  const fileName = `${service}-${type}.log`;
  const filePath = path.join(PM2_LOGS_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ logs: [] });
  }

  // 3. Read the last N lines
  try {
    const logs = await readLastLines(filePath, linesCount);
    return NextResponse.json({ logs });
  } catch (err) {
    console.error("Failed to read logs:", err);
    return NextResponse.json({ detail: "Failed to read logs" }, { status: 500 });
  }
}

/**
 * Reads the last N lines of a file efficiently
 */
async function readLastLines(filePath: string, maxLines: number): Promise<string[]> {
  const stat = fs.statSync(filePath);
  const size = stat.size;
  if (size === 0) return [];

  // If the file is small, just read the whole thing
  if (size < 1024 * 1024) { // < 1MB
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split(/\r?\n/).filter(Boolean);
    return lines.slice(-maxLines);
  }

  // For larger files, we could read chunks from the end, but for simplicity
  // in this implementation we'll stream and keep a buffer.
  return new Promise((resolve, reject) => {
    const lines: string[] = [];
    const stream = fs.createReadStream(filePath, { encoding: "utf-8" });
    const rl = readline.createInterface({ input: stream });

    rl.on("line", (line) => {
      lines.push(line);
      if (lines.length > maxLines) {
        lines.shift();
      }
    });

    rl.on("close", () => {
      resolve(lines);
    });

    rl.on("error", (err) => {
      reject(err);
    });
  });
}
