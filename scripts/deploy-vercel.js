/**
 * One-shot: use saved git HTTPS creds to sign GitHub API only (never printed).
 * Then create a Vercel project via GitHub deploy — requires VERCEL_TOKEN in env.
 * If no VERCEL_TOKEN, exits with instructions.
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function gitCreds() {
  const out = execSync("git credential fill", {
    input: "protocol=https\nhost=github.com\n\n",
    encoding: "utf8",
  });
  const m = {};
  for (const line of out.split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i > 0) m[line.slice(0, i)] = line.slice(i + 1);
  }
  return m;
}

const token = process.env.VERCEL_TOKEN;
if (!token) {
  console.log("missing_VERCEL_TOKEN");
  process.exit(2);
}

const team = process.env.VERCEL_TEAM_ID || undefined;
const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
};

async function api(method, urlPath, body) {
  const res = await fetch(`https://api.vercel.com${urlPath}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

(async () => {
  // Ensure repo exists (already pushed)
  const name = "glamocms";
  const create = await api("POST", `/v10/projects${team ? `?teamId=${team}` : ""}`, {
    name,
    framework: "nextjs",
    gitRepository: {
      type: "github",
      repo: "chatautsuraj/glamocms",
    },
    rootDirectory: "apps/web",
  });
  console.log(`create_status=${create.status}`);
  console.log(`project=${create.json?.id || create.json?.error?.message || "unknown"}`);

  // Trigger deployment from main
  const deploy = await api("POST", `/v13/deployments${team ? `?teamId=${team}` : ""}`, {
    name,
    project: name,
    gitSource: {
      type: "github",
      repo: "chatautsuraj/glamocms",
      ref: "main",
    },
    target: "production",
  });
  console.log(`deploy_status=${deploy.status}`);
  console.log(`url=${deploy.json?.url || deploy.json?.error?.message || ""}`);
  console.log(`alias=${(deploy.json?.alias || []).join(",")}`);
})().catch((e) => {
  console.error(String(e && e.message ? e.message : e));
  process.exit(1);
});
