"use client";

import { ListBox, Select } from "@heroui/react";

type HeroSelectProps = {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
};

export function HeroSelect({ label, options, value, onChange }: HeroSelectProps) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-[#34302a]">
      {label}
      <Select
        aria-label={label}
        selectedKey={value}
        onSelectionChange={(key) => {
          if (key != null) onChange(String(key));
        }}
      >
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {options.map((option) => (
              <ListBox.Item id={option} key={option} textValue={option}>
                {option}
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
    </label>
  );
}
