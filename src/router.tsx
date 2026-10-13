import {
  Component,
  Suspense,
  createContext,
  createElement,
  useContext,
  useMemo,
  useSyncExternalStore,
  type AnchorHTMLAttributes,
  type ComponentType,
  type MouseEvent,
  type ReactNode,
} from "react";
import { matchPath, specificity } from "./match.js";

export type ClientRoute = {
  path: string;
  Page: ComponentType;
  layouts: ComponentType<{ children?: ReactNode }>[];
  Loading?: ComponentType | null;
  Error?: ComponentType<{ error: Error; reset: () => void }> | null;
};

type RouterValue = {
  path: string;
  params: Record<string, string>;
  push: (href: string) => void;
  replace: (href: string) => void;
  back: () => void;
};

const RouterContext = createContext<RouterValue | null>(null);
const SlotContext = createContext<ReactNode>(null);

function pathname(): string {
  if (typeof window === "undefined") return "/";
  return window.location.pathname || "/";
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

export function usePathname(): string {
  return useSyncExternalStore(subscribe, pathname, () => "/");
}

export function useRouter(): RouterValue {
  const value = useContext(RouterContext);
  if (!value) throw new Error("useRouter must be used inside the Harmony router.");
  return value;
}

export function useParams(): Record<string, string> {
  return useRouter().params;
}

/** Expo layouts render the child with Slot. Next layouts render children. Both work. */
export function Slot(): ReactNode {
  return useContext(SlotContext);
}

export function Link({
  href,
  children,
  onClick,
  ...rest
}: { href: string; children: ReactNode; onClick?: (event: MouseEvent<HTMLAnchorElement>) => void } & Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href" | "onClick" | "children"
>) {
  const router = useRouter();
  return (
    <a
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || event.button !== 0) return;
        if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return;
        if (/^[a-z]+:/i.test(href)) return;
        event.preventDefault();
        router.push(href);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}

function pick(routes: ClientRoute[], path: string): { route: ClientRoute; params: Record<string, string> } | null {
  const hits = routes
    .map((route) => ({ route, params: matchPath(route.path, path) }))
    .filter((hit): hit is { route: ClientRoute; params: Record<string, string> } => hit.params !== null);
  hits.sort((a, b) => specificity(a.route.path) - specificity(b.route.path));
  return hits[0] ?? null;
}

function nest(page: ReactNode, layouts: ComponentType<{ children?: ReactNode }>[], loading: ComponentType | null | undefined): ReactNode {
  let tree = loading ? <Suspense fallback={createElement(loading)}>{page}</Suspense> : page;
  for (let i = layouts.length - 1; i >= 0; i -= 1) {
    const Layout = layouts[i];
    if (!Layout) continue;
    const inner = tree;
    tree = <SlotContext.Provider value={inner}>{createElement(Layout, null, inner)}</SlotContext.Provider>;
  }
  return tree;
}

export function Router({ routes }: { routes: ClientRoute[] }) {
  const path = usePathname();
  const value = useMemo<RouterValue>(() => {
    const hit = pick(routes, path);
    return {
      path,
      params: hit?.params ?? {},
      push(href: string) {
        window.history.pushState({}, "", href);
        window.dispatchEvent(new PopStateEvent("popstate"));
      },
      replace(href: string) {
        window.history.replaceState({}, "", href);
        window.dispatchEvent(new PopStateEvent("popstate"));
      },
      back() {
        window.history.back();
      },
    };
  }, [path, routes]);
  const hit = pick(routes, path);
  if (!hit) return <p>No screen for {path}.</p>;
  const page = createElement(hit.route.Page);
  const tree = nest(page, hit.route.layouts, hit.route.Loading);
  const ErrorView = hit.route.Error;
  return (
    <RouterContext.Provider value={value}>
      {ErrorView ? <Boundary fallback={ErrorView}>{tree}</Boundary> : tree}
    </RouterContext.Provider>
  );
}

class Boundary extends Component<{ fallback: ComponentType<{ error: Error; reset: () => void }>; children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      const Fallback = this.props.fallback;
      return <Fallback error={this.state.error} reset={this.reset} />;
    }
    return this.props.children;
  }
}
