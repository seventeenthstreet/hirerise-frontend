/**
 * @file src/types/globals.d.ts
 * @description Ambient type declarations for non-TypeScript file imports.
 *
 * TypeScript does not natively understand CSS imports used as side-effects
 * (e.g. `import './academics.css'` in component files). This declaration tells
 * the TypeScript compiler to treat any `.css` import as a valid module with no
 * exported members, which is exactly what a side-effect CSS import is.
 *
 * Without this file, ts(2882) fires:
 *   "Cannot find module or type declarations for side-effect import of './foo.css'"
 *
 * Vite handles the actual CSS processing at build time.
 * This file is purely a TypeScript-layer hint — it has no runtime effect.
 */

// Treat all .css files as side-effect modules with no exports.
declare module '*.css' {}
