"use client";

import { createContext, useContext, type ComponentType, type ReactNode } from "react";

/** Pass the shadcn/ui components installed in the host application. */
export interface ShadcnComponents {
  Button: ComponentType<any>;
  Alert: ComponentType<any>;
  AlertDescription: ComponentType<any>;
  AlertAction: ComponentType<any>;
  Empty: ComponentType<any>;
  EmptyHeader: ComponentType<any>;
  EmptyTitle: ComponentType<any>;
  EmptyDescription: ComponentType<any>;
  EmptyContent: ComponentType<any>;
  Skeleton: ComponentType<any>;
  Dialog?: ComponentType<any>;
  DialogContent?: ComponentType<any>;
  DialogHeader?: ComponentType<any>;
  DialogTitle?: ComponentType<any>;
  DialogDescription?: ComponentType<any>;
  DialogFooter?: ComponentType<any>;
}

const UIContext = createContext<ShadcnComponents | null>(null);

export function SindreUIProvider({ components, children }: { components: ShadcnComponents; children: ReactNode }) {
  return <UIContext.Provider value={components}>{children}</UIContext.Provider>;
}

export function useShadcnComponents() { return useContext(UIContext); }
