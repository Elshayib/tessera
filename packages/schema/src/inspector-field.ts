/**
 * Inspector widgets from `docs/03-domain-model.md` §13.
 */
export const INSPECTOR_WIDGETS = [
  "number",
  "slider",
  "vec3",
  "vec2",
  "color",
  "toggle",
  "select",
  "asset",
  "entity",
  "text",
  "textarea",
  "tags",
  "json",
] as const;

export type InspectorWidget = (typeof INSPECTOR_WIDGETS)[number];

export type InspectorAssetKind = "geometry" | "material" | "texture" | "environment" | "script";

/**
 * Zod `.meta()` payload for inspector generation (`INV-DOC-09`).
 */
export interface InspectorFieldMeta {
  readonly label: string;
  readonly widget: InspectorWidget;
  readonly unit?: string;
  readonly step?: number;
  readonly group?: string;
  readonly order?: number;
  readonly description?: string;
  readonly assetKind?: InspectorAssetKind;
  readonly [key: string]: string | number | InspectorWidget | InspectorAssetKind | undefined;
}
