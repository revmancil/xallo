export * from "./generated/api";
export * from "./generated/types";

import { z } from "zod";

export const ExchangeMobileAuthorizationCodeBody = z.object({
  code: z.string(),
  codeVerifier: z.string(),
  state: z.string().optional(),
  nonce: z.string().optional(),
  redirectUri: z.string(),
});

export const ExchangeMobileAuthorizationCodeResponse = z.object({
  sessionToken: z.string(),
});

export const LogoutMobileSessionResponse = z.object({
  success: z.boolean(),
});
