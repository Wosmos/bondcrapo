"use client";

import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/shadcn/select";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectFieldProps {
  /** Id of the trigger, so an external `<label htmlFor>` names it. */
  id: string;
  /** Options, or labelled groups of options. */
  options: SelectOption[] | { label: string; options: SelectOption[] }[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Submits the value with a plain form (a hidden native select carries it). */
  name?: string;
  /** Shown while nothing is chosen. */
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const isGrouped = (o: SelectFieldProps["options"]): o is { label: string; options: SelectOption[] }[] =>
  o.length > 0 && "options" in o[0]!;

/**
 * Every dropdown in the app: shadcn/ui Select, 44 px tall like the text inputs. Radix keeps it
 * keyboard and screen reader accessible, and `name` keeps plain form submission working.
 */
export function SelectField({ id, options, value, defaultValue, onValueChange, name, placeholder, disabled, className }: SelectFieldProps) {
  const item = (o: SelectOption) => (
    <SelectItem key={o.value} value={o.value} className="min-h-10">
      {o.label}
    </SelectItem>
  );
  return (
    <Select value={value} defaultValue={defaultValue} onValueChange={onValueChange} name={name} disabled={disabled}>
      <SelectTrigger id={id} className={cn("h-11 w-full bg-surface text-base data-[size=default]:h-11", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent position="popper" className="max-h-80">
        {isGrouped(options)
          ? options.map((g, i) => (
              <SelectGroup key={g.label}>
                {i > 0 ? <SelectSeparator /> : null}
                <SelectLabel>{g.label}</SelectLabel>
                {g.options.map(item)}
              </SelectGroup>
            ))
          : options.map(item)}
      </SelectContent>
    </Select>
  );
}
