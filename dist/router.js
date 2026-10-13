import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Component, Suspense, createContext, createElement, useContext, useMemo, useSyncExternalStore, } from "react";
import { matchPath, specificity } from "./match.js";
const RouterContext = createContext(null);
const SlotContext = createContext(null);
function pathname() {
    if (typeof window === "undefined")
        return "/";
    return window.location.pathname || "/";
}
function subscribe(onChange) {
    window.addEventListener("popstate", onChange);
    return () => window.removeEventListener("popstate", onChange);
}
export function usePathname() {
    return useSyncExternalStore(subscribe, pathname, () => "/");
}
export function useRouter() {
    const value = useContext(RouterContext);
    if (!value)
        throw new Error("useRouter must be used inside the Harmony router.");
    return value;
}
export function useParams() {
    return useRouter().params;
}
/** Expo layouts render the child with Slot. Next layouts render children. Both work. */
export function Slot() {
    return useContext(SlotContext);
}
export function Link({ href, children, onClick, ...rest }) {
    const router = useRouter();
    return (_jsx("a", { href: href, onClick: (event) => {
            onClick?.(event);
            if (event.defaultPrevented || event.button !== 0)
                return;
            if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey)
                return;
            if (/^[a-z]+:/i.test(href))
                return;
            event.preventDefault();
            router.push(href);
        }, ...rest, children: children }));
}
function pick(routes, path) {
    const hits = routes
        .map((route) => ({ route, params: matchPath(route.path, path) }))
        .filter((hit) => hit.params !== null);
    hits.sort((a, b) => specificity(a.route.path) - specificity(b.route.path));
    return hits[0] ?? null;
}
function nest(page, layouts, loading) {
    let tree = loading ? _jsx(Suspense, { fallback: createElement(loading), children: page }) : page;
    for (let i = layouts.length - 1; i >= 0; i -= 1) {
        const Layout = layouts[i];
        if (!Layout)
            continue;
        const inner = tree;
        tree = _jsx(SlotContext.Provider, { value: inner, children: createElement(Layout, null, inner) });
    }
    return tree;
}
export function Router({ routes }) {
    const path = usePathname();
    const value = useMemo(() => {
        const hit = pick(routes, path);
        return {
            path,
            params: hit?.params ?? {},
            push(href) {
                window.history.pushState({}, "", href);
                window.dispatchEvent(new PopStateEvent("popstate"));
            },
            replace(href) {
                window.history.replaceState({}, "", href);
                window.dispatchEvent(new PopStateEvent("popstate"));
            },
            back() {
                window.history.back();
            },
        };
    }, [path, routes]);
    const hit = pick(routes, path);
    if (!hit)
        return _jsxs("p", { children: ["No screen for ", path, "."] });
    const page = createElement(hit.route.Page);
    const tree = nest(page, hit.route.layouts, hit.route.Loading);
    const ErrorView = hit.route.Error;
    return (_jsx(RouterContext.Provider, { value: value, children: ErrorView ? _jsx(Boundary, { fallback: ErrorView, children: tree }) : tree }));
}
class Boundary extends Component {
    state = { error: null };
    static getDerivedStateFromError(error) {
        return { error };
    }
    reset = () => {
        this.setState({ error: null });
    };
    render() {
        if (this.state.error) {
            const Fallback = this.props.fallback;
            return _jsx(Fallback, { error: this.state.error, reset: this.reset });
        }
        return this.props.children;
    }
}
//# sourceMappingURL=router.js.map