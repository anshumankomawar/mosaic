import React, { useRef, useState } from 'react';
import { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
  Image as ImageIcon,
  Table,
  Code,
  Quote,
  RotateCcw,
  RotateCw,
  Highlighter,
  X,
  FileX
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface EditorToolbarProps {
  editor: Editor;
  showLinkMenu?: boolean;
  setShowLinkMenu?: (show: boolean) => void;
  linkUrl?: string;
  setLinkUrl?: (url: string) => void;
  isSaving?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  editor,
  showLinkMenu = false,
  setShowLinkMenu = () => {},
  linkUrl = '',
  setLinkUrl = () => {},
  isSaving = false,
  canUndo = false,
  canRedo = false,
}) => {
  const linkMenuRef = useRef<HTMLDivElement>(null);
  const linkButtonRef = useRef<HTMLButtonElement>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [showImageMenu, setShowImageMenu] = useState(false);
  const imageMenuRef = useRef<HTMLDivElement>(null);
  const imageButtonRef = useRef<HTMLButtonElement>(null);
  const [showTableMenu, setShowTableMenu] = useState(false);
  const tableMenuRef = useRef<HTMLDivElement>(null);
  const tableButtonRef = useRef<HTMLButtonElement>(null);

  //// Close link menu when clicking outside
  //useClickAway([linkMenuRef, linkButtonRef], () => {
    //setShowLinkMenu(false);
  //});

  //// Close image menu when clicking outside
  //useClickAway([imageMenuRef, imageButtonRef], () => {
    //setShowImageMenu(false);
  //});

  //// Close table menu when clicking outside
  //useClickAway([tableMenuRef, tableButtonRef], () => {
    //setShowTableMenu(false);
  //});

  // Handle link submission
  const handleLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Only set link if we have a URL
    if (linkUrl) {
      // Make sure URL has protocol
      let url = linkUrl;
      if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
      }
      
      editor.chain().focus().setLink({ href: url }).run();
    } else {
      // If URL is empty, unset the link
      editor.chain().focus().unsetLink().run();
    }
    
    setShowLinkMenu(false);
  };

  // Handle image submission
  const handleImageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (imageUrl) {
      editor.chain().focus().setImage({ src: imageUrl }).run();
      setImageUrl('');
    }
    
    setShowImageMenu(false);
  };

  // Handle image file upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        editor.chain().focus().setImage({ src: result }).run();
      }
    };
    reader.readAsDataURL(file);
    setShowImageMenu(false);
    e.target.value = '';
  };

  // Insert table with specified dimensions
  const insertTable = (rows: number, cols: number) => {
    editor.chain().focus().insertTable({ rows, cols }).run();
    setShowTableMenu(false);
  };

  return (
    <div className="flex items-center p-1 border-border bg-background scroll-m-0">
      <TooltipProvider delayDuration={300}>
        {/* History controls */}
        <div className="flex mr-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8" 
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!canUndo}
              >
                <RotateCcw className="h-4 w-4" />
                <span className="sr-only">Undo</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8" 
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!canRedo}
              >
                <RotateCw className="h-4 w-4" />
                <span className="sr-only">Redo</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Redo</TooltipContent>
          </Tooltip>
        </div>

        <Separator />

        {/* Text formatting */}
        <div className="flex mr-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant={editor.isActive('bold') ? 'secondary' : 'ghost'} 
                size="icon" 
                className="h-8 w-8" 
                onClick={() => editor.chain().focus().toggleBold().run()}
              >
                <Bold className="h-4 w-4" />
                <span className="sr-only">Bold</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Bold</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant={editor.isActive('italic') ? 'secondary' : 'ghost'} 
                size="icon" 
                className="h-8 w-8" 
                onClick={() => editor.chain().focus().toggleItalic().run()}
              >
                <Italic className="h-4 w-4" />
                <span className="sr-only">Italic</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Italic</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant={editor.isActive('underline') ? 'secondary' : 'ghost'} 
                size="icon" 
                className="h-8 w-8" 
                onClick={() => editor.chain().focus().toggleUnderline().run()}
              >
                <Underline className="h-4 w-4" />
                <span className="sr-only">Underline</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Underline</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant={editor.isActive('strike') ? 'secondary' : 'ghost'} 
                size="icon" 
                className="h-8 w-8" 
                onClick={() => editor.chain().focus().toggleStrike().run()}
              >
                <Strikethrough className="h-4 w-4" />
                <span className="sr-only">Strikethrough</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Strikethrough</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant={editor.isActive('highlight') ? 'secondary' : 'ghost'} 
                size="icon" 
                className="h-8 w-8" 
                onClick={() => editor.chain().focus().toggleHighlight().run()}
              >
                <Highlighter className="h-4 w-4" />
                <span className="sr-only">Highlight</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Highlight</TooltipContent>
          </Tooltip>
        </div>

        <Separator />

        {/* Heading controls */}
        <div className="flex mr-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant={editor.isActive('heading', { level: 1 }) ? 'secondary' : 'ghost'} 
                size="icon" 
                className="h-8 w-8" 
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              >
                <Heading1 className="h-4 w-4" />
                <span className="sr-only">Heading 1</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Heading 1</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant={editor.isActive('heading', { level: 2 }) ? 'secondary' : 'ghost'} 
                size="icon" 
                className="h-8 w-8" 
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              >
                <Heading2 className="h-4 w-4" />
                <span className="sr-only">Heading 2</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Heading 2</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant={editor.isActive('heading', { level: 3 }) ? 'secondary' : 'ghost'} 
                size="icon" 
                className="h-8 w-8" 
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              >
                <Heading3 className="h-4 w-4" />
                <span className="sr-only">Heading 3</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Heading 3</TooltipContent>
          </Tooltip>
        </div>

        <Separator />

        {/* List controls */}
        <div className="flex mr-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant={editor.isActive('bulletList') ? 'secondary' : 'ghost'} 
                size="icon" 
                className="h-8 w-8" 
                onClick={() => editor.chain().focus().toggleBulletList().run()}
              >
                <List className="h-4 w-4" />
                <span className="sr-only">Bullet List</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Bullet List</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant={editor.isActive('orderedList') ? 'secondary' : 'ghost'} 
                size="icon" 
                className="h-8 w-8" 
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
              >
                <ListOrdered className="h-4 w-4" />
                <span className="sr-only">Ordered List</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Ordered List</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant={editor.isActive('taskList') ? 'secondary' : 'ghost'} 
                size="icon" 
                className="h-8 w-8" 
                onClick={() => editor.chain().focus().toggleTaskList().run()}
              >
                <CheckSquare className="h-4 w-4" />
                <span className="sr-only">Task List</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Task List</TooltipContent>
          </Tooltip>
        </div>

        <Separator />

        {/* Alignment controls */}
        <div className="flex mr-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant={editor.isActive({ textAlign: 'left' }) ? 'secondary' : 'ghost'} 
                size="icon" 
                className="h-8 w-8" 
                onClick={() => editor.chain().focus().setTextAlign('left').run()}
              >
                <AlignLeft className="h-4 w-4" />
                <span className="sr-only">Align Left</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Align Left</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant={editor.isActive({ textAlign: 'center' }) ? 'secondary' : 'ghost'} 
                size="icon" 
                className="h-8 w-8" 
                onClick={() => editor.chain().focus().setTextAlign('center').run()}
              >
                <AlignCenter className="h-4 w-4" />
                <span className="sr-only">Align Center</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Align Center</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant={editor.isActive({ textAlign: 'right' }) ? 'secondary' : 'ghost'} 
                size="icon" 
                className="h-8 w-8" 
                onClick={() => editor.chain().focus().setTextAlign('right').run()}
              >
                <AlignRight className="h-4 w-4" />
                <span className="sr-only">Align Right</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Align Right</TooltipContent>
          </Tooltip>
        </div>

        <Separator />

        {/* Special elements */}
        <div className="flex mr-1">
          {/* Link */}
          <div className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  ref={linkButtonRef}
                  variant={editor.isActive('link') ? 'secondary' : 'ghost'} 
                  size="icon" 
                  className="h-8 w-8" 
                  onClick={() => setShowLinkMenu(!showLinkMenu)}
                >
                  <LinkIcon className="h-4 w-4" />
                  <span className="sr-only">Link</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Link</TooltipContent>
            </Tooltip>
            
            {/* Link menu popup */}
            {showLinkMenu && (
              <div 
                ref={linkMenuRef} 
                className="absolute left-0 top-full mt-1 p-3 bg-popover rounded-md shadow-md border border-border z-50 w-64"
              >
                <form onSubmit={handleLinkSubmit} className="flex flex-col gap-2">
                  <Input
                    type="text"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="text-sm"
                    autoFocus
                  />
                  <div className="flex justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        editor.chain().focus().unsetLink().run();
                        setShowLinkMenu(false);
                      }}
                      disabled={!editor.isActive('link')}
                    >
                      Remove
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                    >
                      Save
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </div>
          
          {/* Image */}
          <div className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  ref={imageButtonRef}
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8" 
                  onClick={() => setShowImageMenu(!showImageMenu)}
                >
                  <ImageIcon className="h-4 w-4" />
                  <span className="sr-only">Image</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Image</TooltipContent>
            </Tooltip>
            
            {/* Image menu popup */}
            {showImageMenu && (
              <div 
                ref={imageMenuRef} 
                className="absolute left-0 top-full mt-1 p-3 bg-popover rounded-md shadow-md border border-border z-50 w-64"
              >
                <div className="flex flex-col gap-3">
                  <div className="text-sm font-medium">Insert Image</div>
                  
                  <form onSubmit={handleImageSubmit} className="flex flex-col gap-2">
                    <Input
                      type="text"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://example.com/image.jpg"
                      className="text-sm"
                    />
                    <Button
                      type="submit"
                      size="sm"
                    >
                      Insert URL
                    </Button>
                  </form>
                  
                  <div className="flex items-center">
                    <div className="flex-grow h-px bg-border"></div>
                    <span className="px-2 text-xs text-muted-foreground">OR</span>
                    <div className="flex-grow h-px bg-border"></div>
                  </div>
                  
                  <label className="flex justify-center border border-dashed border-border rounded-md p-3 hover:bg-accent cursor-pointer">
                    <div className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
                      <ImageIcon className="h-4 w-4" />
                      <span>Upload from computer</span>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
          
          {/* Table */}
          <div className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  ref={tableButtonRef}
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8" 
                  onClick={() => setShowTableMenu(!showTableMenu)}
                >
                  <Table className="h-4 w-4" />
                  <span className="sr-only">Table</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Table</TooltipContent>
            </Tooltip>
            
            {/* Table menu popup */}
            {showTableMenu && (
              <div 
                ref={tableMenuRef} 
                className="absolute left-0 top-full mt-1 p-3 bg-popover rounded-md shadow-md border border-border z-50"
              >
                <div className="text-sm font-medium mb-2">Insert Table</div>
                <div className="grid grid-cols-5 gap-1 w-40">
                  {Array.from({ length: 25 }).map((_, i) => {
                    const row = Math.floor(i / 5) + 1;
                    const col = (i % 5) + 1;
                    return (
                      <button 
                        key={i}
                        className="w-6 h-6 border border-border hover:bg-accent flex items-center justify-center text-xs text-muted-foreground"
                        onClick={() => insertTable(row, col)}
                        title={`${row}×${col} table`}
                      />
                    );
                  })}
                </div>
                <div className="mt-2 text-xs text-muted-foreground text-center">
                  Select dimensions
                </div>
              </div>
            )}
          </div>
          
          {/* Code block */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant={editor.isActive('codeBlock') ? 'secondary' : 'ghost'} 
                size="icon" 
                className="h-8 w-8" 
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              >
                <Code className="h-4 w-4" />
                <span className="sr-only">Code Block</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Code Block</TooltipContent>
          </Tooltip>
          
          {/* Blockquote */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant={editor.isActive('blockquote') ? 'secondary' : 'ghost'} 
                size="icon" 
                className="h-8 w-8" 
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
              >
                <Quote className="h-4 w-4" />
                <span className="sr-only">Blockquote</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Blockquote</TooltipContent>
          </Tooltip>
        </div>

        <Separator />

        {/* Clear formatting */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8" 
              onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
            >
              <FileX className="h-4 w-4" />
              <span className="sr-only">Clear Formatting</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Clear Formatting</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

const Separator = () => {
  return <div className="h-6 w-px bg-border mx-1" />;
};

export default EditorToolbar;
