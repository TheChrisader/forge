export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  tokenType: "Bearer";
}

export interface SessionPayload {
  id: string;
  email: string;
}
