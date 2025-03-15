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

export function SearchPanel() {
  const panel = usePanelStore((state) => state);
  const viewStore = useViewStore((state) => state);
  const [caseSensitive, setCaseSensitive] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      console.log('Search triggered');
      panel.setPanel(Panel.SEARCH, false);
      viewStore.setView(View.SEARCH)
    }
  };

  return (
    <CommandDialog
      open={panel.search}
      onOpenChange={(open) => panel.setPanel(Panel.SEARCH, open)}
    >
      <CommandItem>
        <Input
          className="ring-0 border-0 focus-visible:ring-offset-0 focus-visible:ring-0"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
      </CommandItem>
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandSeparator />
        <CommandGroup heading="Search Options">
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
