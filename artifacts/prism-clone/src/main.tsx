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
}

createRoot(document.getElementById("root")!).render(<App />);
