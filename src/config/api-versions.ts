import type { Router } from "express";
import {
    authRouter,
    coursesRouter,
    examsRouter,
    attemptsRouter,
    adminRouter,
} from "@/routes/v1/index.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ApiVersion = {
    /** Version identifier, e.g. "v1", "v2". Used as URL prefix: /<version>/api/... */
    version: string;
    /** Route map: URL segment → Express Router.  e.g. { auth: authRouter } → /<version>/api/auth */
    routes: Record<string, Router>;
    /**
     * When true, routes are *also* mounted on the legacy `/api/*` prefix (no version).
     * Only ONE version should be the default at any given time.
     */
    isDefault: boolean;
    /**
     * When set, every response from this version includes a `Deprecation: true` header
     * and optionally a `Sunset` header with the provided date string (ISO 8601).
     * Set to `true` for just the Deprecation header, or an ISO date string for both.
     */
    deprecated?: boolean | string;
};

// ── Version Registry (single source of truth) ────────────────────────────────

export const API_VERSIONS: ApiVersion[] = [
    {
        version: "v1",
        routes: {
            auth: authRouter,
            courses: coursesRouter,
            exams: examsRouter,
            attempts: attemptsRouter,
            admin: adminRouter,
        },
        isDefault: true,
    },

    // ─── Future versions ──────────────────────────────────────────────
    // To add v2:
    //   1. Create src/routes/v2/index.ts exporting new/modified routers.
    //   2. Import them here and add an entry:
    //
    //   {
    //       version: "v2",
    //       routes: { auth: v2AuthRouter, courses: v2CoursesRouter, ... },
    //       isDefault: true,   // promote v2 as the default
    //   },
    //
    //   3. Set the v1 entry's `isDefault` to false and add `deprecated: true`
    //      (or `deprecated: "2025-12-31"` for a sunset date).
];
