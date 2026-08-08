import createClient from "openapi-fetch";

import { tokenStore } from "../auth/tokenStore";
import { resolverBaseUrl } from "./baseUrl";
import type { paths } from "./schema";

export const apiClient = createClient<paths>({ baseUrl: resolverBaseUrl() });

apiClient.use({
  onRequest({ request }) {
    const access = tokenStore.getAccess();
    if (access) {
      request.headers.set("Authorization", `Bearer ${access}`);
    }
    return request;
  },
});
