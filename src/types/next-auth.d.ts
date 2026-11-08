import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    /** Set to "RefreshTokenError" when Google no longer accepts the stored refresh token. The user must sign in again. */
    error?: "RefreshTokenError";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    /** Unix seconds when accessToken expires. */
    expiresAt?: number;
    error?: "RefreshTokenError";
  }
}
