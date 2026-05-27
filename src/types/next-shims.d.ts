declare module 'next/navigation' {
  export function useRouter(): {
    push: (path: string) => void;
    replace: (path: string) => void;
    back: () => void;
    refresh: () => void;
  };

  export function redirect(path: string): void;

  export function usePathname(): string;
}

declare module 'next/link' {
  import { ReactNode, MouseEventHandler } from 'react';

  interface LinkProps {
    href: string;
    children: ReactNode;
    className?: string;
    onClick?: MouseEventHandler<HTMLAnchorElement>;
    'aria-current'?: string;
  }

  export default function Link(props: LinkProps): JSX.Element;
}
