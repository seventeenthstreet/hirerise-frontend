declare const __DEV__: boolean | undefined;

// isDevelopment is a safe cross-environment dev flag.
// Supports environments where __DEV__ may not be defined.
//
// Resolution order:
//   1. __DEV__  — injected by some bundlers (e.g. React Native / Metro)
//   2. process.env.NODE_ENV — standard for Node, Next.js, Webpack, Vite, Jest
//
// In production both conditions evaluate to false, so the constant carries
// zero runtime cost beyond a single boolean read.
export const isDevelopment =
  typeof __DEV__ !== 'undefined'
    ? __DEV__
    : process.env.NODE_ENV === 'development';

/**
 * @deprecated Use `isDevelopment` instead.
 * This alias is kept for backward compatibility and will remain supported.
 * Existing usages are safe — no behavior change.
 */
export const isDev = isDevelopment;