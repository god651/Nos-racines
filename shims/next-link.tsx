import { forwardRef } from "react";

type Props = React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean; replace?: boolean; scroll?: boolean };

// Remplace next/link : un lien normal, intercepté par le routeur de l'application.
const Link = forwardRef<HTMLAnchorElement, Props>(function Link({ href, prefetch: _p, replace: _r, scroll: _s, ...rest }, ref) {
  void _p;
  void _r;
  void _s;
  return <a ref={ref} href={href} {...rest} />;
});
export default Link;
