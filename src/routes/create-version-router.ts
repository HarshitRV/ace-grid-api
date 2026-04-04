import { Router } from "express";
import type { ApiVersion } from "@/config/api-versions.js";

/**
 * Creates a top-level Express Router for a single API version.
 *
 * Given a version config like `{ version: "v1", routes: { auth, courses }, isDefault: true }`,
 * this produces:
 *   - `/v1/api/auth`    → authRouter
 *   - `/v1/api/courses` → coursesRouter
 *   - `/api/auth`       → authRouter       (only when isDefault is true)
 *   - `/api/courses`    → coursesRouter     (only when isDefault is true)
 *
 * If the version is deprecated, a middleware injects `Deprecation` (and optionally `Sunset`) headers.
 */
export function createVersionRouter(apiVersion: ApiVersion): Router {
    const router = Router();

    // ── Deprecation middleware ─────────────────────────────────────────
    if (apiVersion.deprecated) {
        router.use((_req, res, next) => {
            res.setHeader("Deprecation", "true");

            if (typeof apiVersion.deprecated === "string") {
                res.setHeader("Sunset", apiVersion.deprecated);
            }

            next();
        });
    }

    // ── Mount each route under /<version>/api/<segment> ───────────────
    for (const [segment, handler] of Object.entries(apiVersion.routes)) {
        console.log(`Loading route: /${apiVersion.version}/api/${segment}`)

        router.use(`/${apiVersion.version}/api/${segment}`, handler);
    }
    
    // ── Legacy /api/* mount (backward compatibility) ──────────────────
    if (apiVersion.isDefault) {
        for (const [segment, handler] of Object.entries(apiVersion.routes)) {
            console.log(`Loading legacy route: /api/${segment}`)

            router.use(`/api/${segment}`, handler);
        }
    }

    return router;
}
