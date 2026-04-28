import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";
import { setExternalApiOrigin } from "@workspace/replit-auth-web";
import App from "./App";
import { getApiOriginOverride } from "@/lib/api-base";
import "./index.css";

const apiOrigin = getApiOriginOverride();
setExternalApiOrigin(apiOrigin);
if (apiOrigin) {
  setBaseUrl(apiOrigin);
} else {
  // Generated hooks use absolute paths like /api/... which ignore Vite BASE_URL unless we
  // prepend origin + path (e.g. GitHub Pages at /xallo/ → https://host/xallo/api/...).
  const base = String(import.meta.env.BASE_URL ?? "/");
  const pathPrefix = base === "/" ? "" : base.replace(/\/+$/, "");
  setBaseUrl(`${window.location.origin}${pathPrefix}`);
}

createRoot(document.getElementById("root")!).render(<App />);
