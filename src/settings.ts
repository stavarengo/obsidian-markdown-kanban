import type { HistoryScope } from "./model/types";

export interface KanbanSettings {
  boardPath: string;
  detailPresentation: "side" | "modal";
  sidePanelMode: "split" | "float";
  detailWidth: number;
  addCardFlow: "inline" | "inline-edit" | "detail";
  addCardOpenMode: "default" | "modal" | "side-float" | "side-split";
  cardNextTodos: number;
  historyScope: HistoryScope;
}

export const DEFAULT_SETTINGS: KanbanSettings = {
  boardPath: "",
  detailPresentation: "side",
  sidePanelMode: "split",
  detailWidth: 380,
  addCardFlow: "inline",
  addCardOpenMode: "default",
  cardNextTodos: 0,
  historyScope: "moves",
};

export const DETAIL_WIDTH_MIN = 280;
export const DETAIL_WIDTH_MAX = 720;
