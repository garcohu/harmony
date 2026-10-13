import { type AnchorHTMLAttributes, type ComponentType, type MouseEvent, type ReactNode } from "react";
export type ClientRoute = {
    path: string;
    Page: ComponentType;
    layouts: ComponentType<{
        children?: ReactNode;
    }>[];
    Loading?: ComponentType | null;
    Error?: ComponentType<{
        error: Error;
        reset: () => void;
    }> | null;
};
type RouterValue = {
    path: string;
    params: Record<string, string>;
    push: (href: string) => void;
    replace: (href: string) => void;
    back: () => void;
};
export declare function usePathname(): string;
export declare function useRouter(): RouterValue;
export declare function useParams(): Record<string, string>;
/** Expo layouts render the child with Slot. Next layouts render children. Both work. */
export declare function Slot(): ReactNode;
export declare function Link({ href, children, onClick, ...rest }: {
    href: string;
    children: ReactNode;
    onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "onClick" | "children">): import("react/jsx-runtime").JSX.Element;
export declare function Router({ routes }: {
    routes: ClientRoute[];
}): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=router.d.ts.map