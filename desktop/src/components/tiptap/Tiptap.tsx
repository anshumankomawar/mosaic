import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Document from '@tiptap/extension-document';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from "@tiptap/extension-placeholder";
import { Extension } from '@tiptap/core';
import "./Tiptap.css";
import { EditorToolbar } from "@/tiptap/toolbar";
import { useEffect, useRef } from "react";
import { useTabStore } from "@/stores/tabStore";

const CustomDocument = Document.extend({
  content: 'heading block*',
})

const RequiredHeading = Extension.create({
  name: 'requiredHeading',

  addKeyboardShortcuts() {
    return {
      'Enter': ({ editor }) => {
        // Get the current selection position
        const { from } = editor.state.selection;
        
        // Determine if the selection is inside a heading
        const isInHeading = editor.isActive('heading');
        
        // If in heading and it's empty, prevent the Enter key behavior
        if (isInHeading) {
          const headingNode = editor.getJSON().content?.find(node => 
            node.type === 'heading'
          );
          
          const headingText = headingNode?.content?.[0]?.text || '';
          
          if (!headingText.trim()) {
            // Add a visual indicator that the heading is required
            const headingElement = document.querySelector('h1');
            if (headingElement) {
              headingElement.classList.add('required-heading-empty');
              setTimeout(() => {
                headingElement.classList.remove('required-heading-empty');
              }, 500);
            }
            return true; // Prevent default Enter behavior
          }
        }
        
        return false; // Allow default Enter behavior
      }
    }
  },
})

interface TiptapProps {
    placeholder?: string;
    titlePlaceholder?: string;
}

export default (props: TiptapProps) => {
    const { 
      activeTabId, 
      getActiveTab, 
      setContent, 
      setTitle,
      updateActiveEditorState
    } = useTabStore();
    
    // Track scroll restoration
    const editorContainerRef = useRef<HTMLDivElement>(null);
    const initialScrollRestored = useRef(false);
    const prevTabIdRef = useRef<string | null>(null);
    
    // Get active tab and its content
    const activeTab = getActiveTab();
    const initialContent = activeTab?.content || '<h1></h1><p></p>';
    
    // Track tab changes for debugging
    useEffect(() => {
      if (prevTabIdRef.current !== activeTabId) {
        console.log(`Tab changed from ${prevTabIdRef.current} to ${activeTabId}`);
        initialScrollRestored.current = false;
        prevTabIdRef.current = activeTabId;
      }
    }, [activeTabId]);
    
    const editor = useEditor({
        extensions: [
            CustomDocument,
            StarterKit.configure({
                document: false,
            }),
            Placeholder.configure({
                placeholder: ({ node }) => {
                    if (node.type.name === 'heading') {
                        return props.titlePlaceholder || 'Untitled';
                    }
                    return props.placeholder || '';
                },
                emptyEditorClass: 'is-editor-empty',
                emptyNodeClass: 'is-node-empty',
            }),
            RequiredHeading,
            Underline,
            TextAlign.configure({
                types: ['heading', 'paragraph'],
                defaultAlignment: 'left',
            }),
            Image,
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'cursor-pointer text-blue-500 underline',
                },
            }),
        ],
        autofocus: 'start',
        editorProps: {
            attributes: {
              class: "h-full focus:outline-none prose-compact dark:prose-invert-compact max-w-none"
            },
        },
        content: initialContent,
        onUpdate({ editor }) {
            if (!activeTabId) return;
            
            const html = editor.getHTML();
            const plainText = editor.getText();
            
            // Extract title from the first heading
            const titleNode = editor.getJSON().content?.find(node => 
                node.type === 'heading'
            );
            
            const title = titleNode?.content?.[0]?.text || '';
            
            // Update tab content
            setContent(html);
            
            // Update title if it exists
            if (title) {
                setTitle(title);
            }
            
            // Track cursor position and selection
            const { from, to } = editor.state.selection;
            updateActiveEditorState({
                cursorPosition: from,
                selection: from !== to ? { from, to } : null
            });
        },
        onSelectionUpdate({ editor }) {
            if (!activeTabId) return;
            
            // Track formatting state
            let textStyle = '';
            if (editor.isActive('bold')) textStyle = 'bold';
            else if (editor.isActive('italic')) textStyle = 'italic';
            else if (editor.isActive('underline')) textStyle = 'underline';
            else if (editor.isActive('strike')) textStyle = 'strike';
            
            // Heading level
            let headingLevel = '';
            if (editor.isActive('heading', { level: 1 })) headingLevel = 'h1';
            else if (editor.isActive('heading', { level: 2 })) headingLevel = 'h2';
            else if (editor.isActive('heading', { level: 3 })) headingLevel = 'h3';
            
            // Alignment
            let alignment = 'left';
            if (editor.isActive({ textAlign: 'center' })) alignment = 'center';
            else if (editor.isActive({ textAlign: 'right' })) alignment = 'right';
            else if (editor.isActive({ textAlign: 'justify' })) alignment = 'justify';
            
            // List type
            let listType = null;
            if (editor.isActive('bulletList')) listType = 'bulletList';
            else if (editor.isActive('orderedList')) listType = 'orderedList';
            
            // Update format state
            updateActiveEditorState({
                activeFormats: {
                    textStyle,
                    headingLevel,
                    alignment,
                    listType
                }
            });
        }
    });

    // Restore editor state when switching tabs
    useEffect(() => {
        if (!editor || !activeTabId || !activeTab) return;
        
        // Set content when tab changes
        if (activeTab.content && editor.getHTML() !== activeTab.content) {
            // Use setTimeout to ensure editor is ready
            setTimeout(() => {
                editor.commands.setContent(activeTab.content);
                
                // Reset history to prevent cross-tab undo/redo
                if (editor.commands.clearHistory) {
                    editor.commands.clearHistory();
                }
            }, 0);
        }
        
        // Restore scroll position
        if (!initialScrollRestored.current && editor.view && editor.view.dom) {
            const scrollPosition = activeTab.editorState?.scrollPosition || 0;
            
            // Use requestAnimationFrame to ensure DOM is ready
            requestAnimationFrame(() => {
                editor.view.dom.scrollTop = scrollPosition;
                initialScrollRestored.current = true;
            });
        }
        
        // Restore selection/cursor if available
        // if (activeTab.editorState?.selection) {
        //     const { from, to } = activeTab.editorState.selection;
        //     editor.commands.setTextSelection({ from, to });
        // } else if (activeTab.editorState?.cursorPosition) {
        //     editor.commands.setTextSelection(activeTab.editorState.cursorPosition);
        // }
    }, [editor, activeTabId, activeTab]);
    
    // Track scroll position
    useEffect(() => {
        if (!editor || !editor.view || !editor.view.dom || !activeTabId) return;
        
        const handleScroll = () => {
            const scrollPosition = editor.view.dom.scrollTop;
            updateActiveEditorState({ scrollPosition });
        };
        
        // Add scroll event listener
        const editorDOM = editor.view.dom;
        editorDOM.addEventListener('scroll', handleScroll);
        
        // Clean up
        return () => {
            editorDOM.removeEventListener('scroll', handleScroll);
        };
    }, [editor, activeTabId, updateActiveEditorState]);
    
    // Add heading validation method
    useEffect(() => {
        if (editor) {
            const validateHeading = () => {
                const headingNode = editor.getJSON().content?.find(node => 
                    node.type === 'heading'
                );
                
                const headingText = headingNode?.content?.[0]?.text || '';
                
                if (!headingText.trim()) {
                    editor.commands.focus('start');
                    
                    const headingElement = document.querySelector('h1');
                    if (headingElement) {
                        headingElement.classList.add('required-heading-empty');
                        setTimeout(() => {
                            headingElement.classList.remove('required-heading-empty');
                        }, 800);
                    }
                    
                    return false;
                }
                
                return true;
            };
            
            editor.validateHeading = validateHeading;
        }
    }, [editor]);

    if (!editor) {
        return null;
    }
    
    return (
        <div 
            className="flex flex-col w-full h-full overflow-hidden"
            ref={editorContainerRef}
        >
            <div className="w-full">
                <div className="w-full overflow-x-scroll">
                    <div className="flex flex-nowrap min-w-max">
                        <EditorToolbar editor={editor} />
                    </div>
                </div>
            </div>
            
            <div className="flex-1 overflow-hidden">
                <div className="h-full px-2 py-4 overflow-y-auto">
                    <EditorContent editor={editor} className="h-full" />
                </div>
            </div>
        </div>
    );
};
