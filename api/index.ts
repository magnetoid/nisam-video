import app from "../server/index.js";
import { registerRoutes } from "../server/routes.js";

// Cache the initialization
let isInitialized = false;

export default async function (req: any, res: any) {
  if (!isInitialized) {
    await registerRoutes(app);
    isInitialized = true;
  }
  
  app(req, res);
}
