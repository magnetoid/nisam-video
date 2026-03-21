import "express-session";

declare module "express-session" {
  interface SessionData {
    isAuthenticated?: boolean;
    username?: string;
    userId?: string;
    role?: string;
  }
}
