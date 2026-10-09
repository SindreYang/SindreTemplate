"use client";

import type { ReactNode } from "react";
import { GripVertical } from "lucide-react";
import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import { cn } from "../styles.js";

export { DragDropProvider, DragOverlay, useDraggable, useDroppable } from "@dnd-kit/react";
export { useSortable, isSortable } from "@dnd-kit/react/sortable";

export interface SortableListProps<T> {
  items: readonly T[];
  getId: (item: T) => string | number;
  renderItem: (item: T) => ReactNode;
  onReorder: (items: T[]) => void;
  className?: string;
  itemClassName?: string;
  handleLabel?: string;
  orientation?: "vertical" | "horizontal";
}

function SortableRow<T>({ item, id, index, renderItem, itemClassName, handleLabel }: {
  item: T; id: string | number; index: number; renderItem: (item: T) => ReactNode;
  itemClassName?: string; handleLabel: string;
}) {
  const { ref, handleRef, isDragging } = useSortable({ id, index });
  return <li ref={ref} className={cn("flex items-center gap-2", isDragging && "opacity-60", itemClassName)}>
    <button ref={handleRef} type="button" aria-label={`${handleLabel}: ${id}`}
      className="touch-none rounded-md p-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
      <GripVertical size={18} aria-hidden="true" />
    </button>
    {renderItem(item)}
  </li>;
}

/** Controlled sortable list. Item IDs must be unique and stable across renders. */
export function SortableList<T>({ items, getId, renderItem, onReorder, className, itemClassName,
  handleLabel = "拖动排序", orientation = "vertical" }: SortableListProps<T>) {
  const handleDragEnd = ({ canceled, operation }: DragEndEvent) => {
    if (canceled || !isSortable(operation.source)) return;
    const from = operation.source.initialIndex;
    const to = operation.source.index;
    if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    onReorder(next);
  };
  return <DragDropProvider onDragEnd={handleDragEnd}>
    <ul className={cn(orientation === "horizontal" && "flex flex-wrap gap-2", className)}>
      {items.map((item, index) => <SortableRow key={getId(item)} item={item} id={getId(item)} index={index}
        renderItem={renderItem} itemClassName={itemClassName} handleLabel={handleLabel} />)}
    </ul>
  </DragDropProvider>;
}
