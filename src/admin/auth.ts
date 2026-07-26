import type { NextFunction, Request, Response } from "express";
import { ConfigService } from "../config/configService.js";

export const createAdminAuth = (config: ConfigService) => {
  return (request: Request, response: Response, next: NextFunction) => {
    const provided = request.header("x-admin-secret");

    if (!config.adminSecret || provided === config.adminSecret) {
      next();
      return;
    }

    response.status(401).json({ message: "Неверный секрет администратора" });
  };
};
