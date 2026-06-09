import { NextRequest, NextResponse } from "next/server";
import http from "http";

const ALLOWED_SERVICES = [
  "facidance-admin",
  "facidance-auth",
  "facidance-face",
  "facidance-frontend",
  "facidance-student",
  "facidance-teacher",
];

export async function GET(req: NextRequest) {
  // 1. Authenticate Admin
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.split(" ")[1];
  
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
  const linesCount = parseInt(searchParams.get("lines") || "200", 10);

  if (!ALLOWED_SERVICES.includes(service)) {
    return NextResponse.json({ detail: "Invalid service requested" }, { status: 400 });
  }

  // The docker container names are typically <project>_<service>_1 or <project>-<service>-1
  // If the VPS folder is /opt/facidance, compose v2 usually names it facidance-<service>-1
  const serviceSuffix = service.replace("facidance-", "");
  const containerName = `facidance-${serviceSuffix}-1`;

  try {
    const logs = await fetchDockerLogs(containerName, linesCount, type);
    return NextResponse.json({ logs });
  } catch (err: any) {
    console.error("Failed to fetch docker logs:", err);
    // Fallback if container is not found or socket is unavailable
    if (err.message && err.message.includes("No such container")) {
      return NextResponse.json({ logs: [`Container ${containerName} not found. Is it running?`] });
    }
    return NextResponse.json({ detail: "Failed to read logs. Make sure docker.sock is mounted." }, { status: 500 });
  }
}

/**
 * Fetches logs directly from the Docker Engine API via the Unix socket
 */
function fetchDockerLogs(containerName: string, tail: number, type: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    // Docker multiplexes stdout and stderr.
    // If type='out', we request stdout. If 'error', we request stderr.
    const stdout = type === "out" ? "true" : "false";
    const stderr = type === "error" ? "true" : "false";
    // Also request both if you prefer, but the UI filters by type.

    const options = {
      socketPath: "/var/run/docker.sock",
      path: `/containers/${containerName}/logs?stdout=${stdout}&stderr=${stderr}&tail=${tail}`,
      method: "GET",
    };

    const req = http.request(options, (res) => {
      if (res.statusCode === 404) {
        return reject(new Error("No such container"));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Docker API returned status ${res.statusCode}`));
      }

      let rawData = Buffer.alloc(0);

      res.on("data", (chunk) => {
        rawData = Buffer.concat([rawData, chunk]);
      });

      res.on("end", () => {
        const lines: string[] = [];
        let offset = 0;

        // Docker multiplexed stream format:
        // [8 bytes header] [payload]
        // Header: [1 byte stream type] [3 bytes padding] [4 bytes big-endian payload size]
        // Stream type: 1 = stdout, 2 = stderr
        while (offset < rawData.length) {
          if (offset + 8 > rawData.length) break;
          
          const streamType = rawData.readUInt8(offset);
          const payloadSize = rawData.readUInt32BE(offset + 4);
          offset += 8;

          if (offset + payloadSize > rawData.length) {
            // Incomplete payload, break
            break;
          }

          const payload = rawData.subarray(offset, offset + payloadSize).toString("utf8");
          // Split by newline and add to our lines array
          const splitLines = payload.split(/\r?\n/);
          for (const line of splitLines) {
            if (line) lines.push(`[${streamType === 1 ? 'STDOUT' : 'STDERR'}] ${line}`);
          }
          
          offset += payloadSize;
        }

        resolve(lines.slice(-tail));
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.end();
  });
}
