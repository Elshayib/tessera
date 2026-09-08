import type { ReactElement } from "react";
import { useEffect, useRef, useState } from "react";
import { en } from "../i18n/en.js";
import { isKnownWidget } from "./fields.js";

/**
 * Props for a generated inspector control.
 *
 * @public
 */
export interface FieldControlProps {
  readonly fieldKey: string;
  readonly label: string;
  readonly widget: string;
  readonly value: unknown;
  readonly enumValues: readonly string[];
  readonly step: number;
  readonly onCommit: (value: unknown) => void;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asBool(value: unknown): boolean {
  return value === true;
}

function vec3(value: unknown): readonly [number, number, number] {
  if (!Array.isArray(value) || value.length < 3) {
    return [0, 0, 0];
  }
  return [asNumber(value[0], 0), asNumber(value[1], 0), asNumber(value[2], 0)];
}

function vec2(value: unknown): readonly [number, number] {
  if (!Array.isArray(value) || value.length < 2) {
    return [0, 0];
  }
  return [asNumber(value[0], 0), asNumber(value[1], 0)];
}

/**
 * One inspector widget. Unknown widgets render a visible fallback.
 *
 * @public
 */
export function FieldControl(props: FieldControlProps): ReactElement {
  if (!isKnownWidget(props.widget)) {
    return (
      <p data-widget="unknown">
        {en.inspector.unknownWidget}: {props.label}
      </p>
    );
  }
  if (props.widget === "slider") {
    return <SliderControl {...props} />;
  }
  if (props.widget === "asset" || props.widget === "entity") {
    return (
      <p data-widget={props.widget} data-field={props.fieldKey}>
        {props.label}: {en.inspector.pickerStub}
      </p>
    );
  }
  if (props.widget === "tags") {
    const text = Array.isArray(props.value) ? props.value.join(", ") : "";
    return (
      <label>
        {props.label}
        <input
          type="text"
          aria-label={props.label}
          data-field={props.fieldKey}
          defaultValue={text}
          onBlur={(event) => {
            const parts = event.target.value.split(",");
            props.onCommit(parts.map((part) => part.trim()));
          }}
        />
      </label>
    );
  }
  if (props.widget === "json" || props.widget === "textarea") {
    const text = typeof props.value === "string" ? props.value : JSON.stringify(props.value ?? {});
    return (
      <label>
        {props.label}
        <textarea
          aria-label={props.label}
          data-field={props.fieldKey}
          defaultValue={text}
          onBlur={(event) => {
            if (props.widget === "json") {
              try {
                const parsed: unknown = JSON.parse(event.target.value);
                props.onCommit(parsed);
              } catch {
                return;
              }
              return;
            }
            props.onCommit(event.target.value);
          }}
        />
      </label>
    );
  }
  if (props.widget === "color") {
    const hex = asString(props.value) || "#000000";
    return (
      <label>
        {props.label}
        <input
          type="color"
          aria-label={props.label}
          data-field={props.fieldKey}
          value={hex}
          onChange={(event) => props.onCommit(event.target.value)}
        />
      </label>
    );
  }
  if (props.widget === "toggle") {
    return (
      <label>
        {props.label}
        <input
          type="checkbox"
          aria-label={props.label}
          checked={asBool(props.value)}
          onChange={(event) => props.onCommit(event.target.checked)}
        />
      </label>
    );
  }
  if (props.widget === "select") {
    return (
      <label>
        {props.label}
        <select
          aria-label={props.label}
          value={asString(props.value)}
          onChange={(event) => props.onCommit(event.target.value)}
        >
          {props.enumValues.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (props.widget === "vec3") {
    const triple = vec3(props.value);
    return (
      <fieldset>
        <legend>{props.label}</legend>
        {([0, 1, 2] as const).map((index) => (
          <input
            key={index}
            type="number"
            aria-label={`${props.label} ${String(index)}`}
            defaultValue={triple[index]}
            onBlur={(event) => {
              const next: [number, number, number] = [triple[0], triple[1], triple[2]];
              next[index] = Number(event.target.value);
              props.onCommit(next);
            }}
          />
        ))}
      </fieldset>
    );
  }
  if (props.widget === "vec2") {
    const pair = vec2(props.value);
    return (
      <fieldset>
        <legend>{props.label}</legend>
        {([0, 1] as const).map((index) => (
          <input
            key={index}
            type="number"
            aria-label={`${props.label} ${String(index)}`}
            defaultValue={pair[index]}
            onBlur={(event) => {
              const next: [number, number] = [pair[0], pair[1]];
              next[index] = Number(event.target.value);
              props.onCommit(next);
            }}
          />
        ))}
      </fieldset>
    );
  }
  if (props.widget === "number") {
    return (
      <label>
        {props.label}
        <input
          type="number"
          aria-label={props.label}
          defaultValue={asNumber(props.value, 0)}
          onBlur={(event) => props.onCommit(Number(event.target.value))}
        />
      </label>
    );
  }
  return (
    <label>
      {props.label}
      <input
        type="text"
        aria-label={props.label}
        defaultValue={typeof props.value === "string" ? props.value : JSON.stringify(props.value)}
        onBlur={(event) => props.onCommit(event.target.value)}
      />
    </label>
  );
}

function SliderControl(props: FieldControlProps): ReactElement {
  const dragging = useRef(false);
  const [local, setLocal] = useState(asNumber(props.value, 0));
  useEffect(() => {
    if (!dragging.current) {
      setLocal(asNumber(props.value, 0));
    }
  }, [props.value]);
  return (
    <label>
      {props.label}
      <input
        type="range"
        aria-label={props.label}
        data-widget="slider"
        data-field={props.fieldKey}
        min={1}
        max={179}
        step={props.step}
        value={local}
        onPointerDown={() => {
          dragging.current = true;
        }}
        onChange={(event) => {
          const next = Number(event.target.value);
          setLocal(next);
          if (!dragging.current) {
            props.onCommit(next);
          }
        }}
        onPointerUp={(event) => {
          dragging.current = false;
          props.onCommit(Number(event.currentTarget.value));
        }}
      />
    </label>
  );
}
