import createClient from "openapi-fetch";

import { tokenStore } from "../auth/tokenStore";
import type { paths } from "./schema";

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8001";

export const apiClient = createClient<paths>({ baseUrl });

apiClient.use({
  onRequest({ request }) {
    const access = tokenStore.getAccess();
    if (access) {
      request.headers.set("Authorization", `Bearer ${access}`);
    }
    return request;
  },
});
