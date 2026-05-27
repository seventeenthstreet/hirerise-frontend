import type { ReactNode } from 'react';

interface LinkProps {
  href: string;
  children: ReactNode;
  className?: string;
}

export default function Link({
  href,
  children,
  className,
}: LinkProps) {
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}