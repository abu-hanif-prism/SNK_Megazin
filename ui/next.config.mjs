// Static export: the devices have no internet and run only nginx + the API,
// so the UI ships as plain files (same as the old Angular build output).
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true, // /admin → admin/index.html (nginx try_files friendly)
  images: { unoptimized: true },
  allowedDevOrigins: ["192.168.*.*"], // `next dev` opened from a phone on the LAN (else its JS is blocked → buttons dead)
  agentRules: false, // don't let `next dev` write AGENTS.md/CLAUDE.md into the repo
};

export default nextConfig;
