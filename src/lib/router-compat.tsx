/**
 * Thin compatibility layer exposing the small react-router-style API the
 * migrated Grantly pages use, implemented on TanStack Router.
 */
import React, { useEffect } from "react";
import {
  Link as TsLink,
  useNavigate as useTsNavigate,
  useLocation as useTsLocation,
  useParams as useTsParams,
  useRouterState,
} from "@tanstack/react-router";

type AnyProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "children"> & {
  to: string;
  replace?: boolean;
  state?: unknown;
  className?: string | ((args: { isActive: boolean }) => string);
  children?: React.ReactNode | ((args: { isActive: boolean }) => React.ReactNode);
  end?: boolean;
};

function splitTo(to: string) {
  const [pathAndSearch, hash] = to.split("#");
  const [pathname, search] = pathAndSearch.split("?");
  const searchObj: Record<string, string> = {};
  if (search) new URLSearchParams(search).forEach((v, k) => (searchObj[k] = v));
  return { pathname: pathname || "/", search: search ? searchObj : undefined, hash };
}

export const Link = React.forwardRef<HTMLAnchorElement, AnyProps>(function Link(
  { to, replace, state: _state, className, children, end: _end, ...rest },
  ref,
) {
  const { pathname, search, hash } = splitTo(to);
  const current = useRouterState({ select: (s) => s.location.pathname });
  const isActive = current === pathname;
  const cls = typeof className === "function" ? className({ isActive }) : className;
  const kids = typeof children === "function" ? children({ isActive }) : children;
  return (
    <TsLink
      ref={ref}
      {...(rest as Record<string, unknown>)}
      to={pathname as never}
      search={search as never}
      hash={hash}
      replace={replace}
      className={cls}
    >
      {kids}
    </TsLink>
  );
});

export const NavLink = Link;

export function useNavigate() {
  const navigate = useTsNavigate();
  return (to: string | number, opts?: { replace?: boolean; state?: unknown }) => {
    if (typeof to === "number") {
      window.history.go(to);
      return;
    }
    const { pathname, search, hash } = splitTo(to);
    navigate({ to: pathname as never, search: search as never, hash, replace: opts?.replace, state: opts?.state as never });
  };
}

export function useLocation() {
  const loc = useTsLocation();
  const searchStr = typeof window !== "undefined" ? window.location.search : "";
  return {
    pathname: loc.pathname,
    search: searchStr,
    hash: loc.hash ? `#${loc.hash}` : "",
    state: (loc.state ?? {}) as any,
  };
}

export function useParams<T extends Record<string, string | undefined>>(): T {
  return useTsParams({ strict: false }) as unknown as T;
}

export function useSearchParams(): [URLSearchParams, (next: Record<string, string> | URLSearchParams) => void] {
  const href = useRouterState({ select: (s) => s.location.searchStr });
  const navigate = useTsNavigate();
  const params = new URLSearchParams(href || "");
  const set = (next: Record<string, string> | URLSearchParams) => {
    const obj: Record<string, string> = {};
    new URLSearchParams(next as Record<string, string>).forEach((v, k) => (obj[k] = v));
    navigate({ to: "." as never, search: obj as never });
  };
  return [params, set];
}

export function Navigate({ to, replace, state }: { to: string; replace?: boolean; state?: unknown }) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to, { replace, state });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to]);
  return null;
}
