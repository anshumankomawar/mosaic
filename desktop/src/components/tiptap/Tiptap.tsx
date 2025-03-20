import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Document from '@tiptap/extension-document';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from "@tiptap/extension-placeholder";
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
import { Extension } from '@tiptap/core';
import "./Tiptap.css";
import { EditorToolbar } from "@/tiptap/toolbar";
import { useEffect, useRef } from "react";
import { useTabStore } from "@/stores/tabStore";

// Custom Document extension with required heading
const CustomDocument = Document.extend({
  content: 'heading block*',
})

// Extension to enforce heading requirement
const RequiredHeading = Extension.create({
  name: 'requiredHeading',

  addKeyboardShortcuts() {
    return {
      'Enter': ({ editor }) => {
        // Only capture Enter in empty headings
        if (editor.isActive('heading')) {
          const headingNode = editor.getJSON().content?.find(node => 
            node.type === 'heading'
          );
          
          const headingText = headingNode?.content?.[0]?.text || '';
          
          if (!headingText.trim()) {
            // Provide visual feedback
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
});

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
  
  // Get active tab and its content
  const activeTab = getActiveTab();
  const initialContent = activeTab?.content || '<h1></h1><p></p>';
  
  const editor = useEditor({
    extensions: [
      CustomDocument,
      StarterKit.configure({
        document: false,
        // Configure code block without lowlight
        codeBlock: {
          HTMLAttributes: {
            class: 'code-block',
          },
        },
      }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === 'heading') {
            return props.titlePlaceholder || 'Untitled';
          }
          return props.placeholder || 'Start writing...';
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
      Image.configure({
        allowBase64: true,
        HTMLAttributes: {
          class: 'max-w-full h-auto',
          loading: 'lazy',
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'cursor-pointer text-blue-500 underline',
          rel: 'noopener noreferrer',
          target: '_blank',
        },
        validate: url => /^https?:\/\//.test(url),
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'min-w-full border-collapse border border-gray-300 dark:border-gray-700',
        }
      }),
      TableRow.configure({
        HTMLAttributes: {
          class: 'border-b border-gray-300 dark:border-gray-700',
        }
      }),
      TableHeader.configure({
        HTMLAttributes: {
          class: 'border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 font-medium p-2 text-left',
        }
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: 'border border-gray-300 dark:border-gray-700 p-2',
        }
      }),
      TaskList.configure({
        HTMLAttributes: {
          class: 'task-list',
        }
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'task-item',
        }
      }),
      Highlight.configure({
        HTMLAttributes: {
          class: 'bg-yellow-200 dark:bg-yellow-800 px-1 rounded',
        }
      }),
      Typography,
    ],
    autofocus: 'start',
    editorProps: {
      attributes: {
        class: "h-full focus:outline-none prose-compact dark:prose-invert-compact max-w-none",
        spellcheck: 'true',
      },
    },
    content: initialContent,
    onUpdate({ editor }) {
      if (!activeTabId) return;
      
      const html = editor.getHTML();
      
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
    },
    onSelectionUpdate({ editor }) {
      if (!activeTabId) return;
      
      // Track formatting state
      let textStyle = '';
      if (editor.isActive('bold')) textStyle = 'bold';
      else if (editor.isActive('italic')) textStyle = 'italic';
      else if (editor.isActive('underline')) textStyle = 'underline';
      else if (editor.isActive('strike')) textStyle = 'strike';
      else if (editor.isActive('highlight')) textStyle = 'highlight';
      
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
      else if (editor.isActive('taskList')) listType = 'taskList';
      
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
      editor.commands.setContent(activeTab.content);
    }
  }, [editor, activeTabId, activeTab]);
  
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
      
      // @ts-ignore - Add custom method to editor
      editor.validateHeading = validateHeading;
    }
  }, [editor]);

  if (!editor) {
    return null;
  }
  
  return (
    <div className="flex flex-col w-full h-full overflow-hidden">
      <div className="w-full">
        <div className="w-full overflow-x-auto">
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
