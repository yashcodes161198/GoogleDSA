import { ComponentPropsWithoutRef, forwardRef } from "react";

export type ExternalLinkProps = Omit<
  ComponentPropsWithoutRef<"a">,
  "target" | "rel"
>;

export const ExternalLink = forwardRef<HTMLAnchorElement, ExternalLinkProps>(
  ({ children, ...props }, ref) => (
    <a ref={ref} target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  )
);
ExternalLink.displayName = "ExternalLink";
