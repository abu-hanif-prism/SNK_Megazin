// Static export: the devices have no internet and run only nginx + the API,
// so the UI ships as plain files (same as the old Angular build output).
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true, // /admin → admin/index.html (nginx try_files friendly)
  images: { unoptimized: true },
  agentRules: false, // don't let `next dev` write AGENTS.md/CLAUDE.md into the repo
};

export default nextConfig;
