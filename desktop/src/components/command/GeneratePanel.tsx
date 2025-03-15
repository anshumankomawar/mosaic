import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Panel, usePanelStore } from "@/stores/commandStore";
import { CaseSensitive, CircleCheck } from "lucide-react";
import * as React from "react";
import { DatePickerWithRange } from "../ui/datepicker";
import { Input } from "../ui/input";
import { useViewStore, View } from "@/stores/viewStore";

export function GeneratePanel() {
  const panel = usePanelStore((state) => state);
  const viewStore = useViewStore((state) => state);
  const [caseSensitive, setCaseSensitive] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      // Close the panel first
      panel.setPanel(Panel.GENERATE, false);
      
      // Then navigate using direct window location
      viewStore.setView(View.GENERATE);
    }
  };

  return (
    <CommandDialog
      open={panel.generate}
      onOpenChange={(open) => panel.setPanel(Panel.GENERATE, open)}
    >
      <CommandItem>
        <Input
          className="ring-0 border-0 focus-visible:ring-offset-0 focus-visible:ring-0"
          placeholder="Type your generation prompt..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
      </CommandItem>
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandSeparator />
        <CommandGroup heading="Generation Options">
          <CommandItem
            onSelect={() => setCaseSensitive(!caseSensitive)}
            className="flex justify-between items-center"
          >
            <div className="flex gap-2">
              <CaseSensitive />
              <span>Enable case sensitivity</span>
            </div>
            {caseSensitive && <CircleCheck />}
          </CommandItem>
          <CommandItem>
            <DatePickerWithRange />
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
