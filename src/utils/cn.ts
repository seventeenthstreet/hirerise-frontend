// utils/cn.ts — lightweight classname merger (no external dep needed)
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
