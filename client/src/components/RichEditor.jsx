import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

const RichEditor = forwardRef(function RichEditor(
  { initialContent = '', onChange, onSubmit, placeholder },
  ref
) {
  const onChangeRef = useRef(onChange);
  const onSubmitRef = useRef(onSubmit);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { onSubmitRef.current = onSubmit; }, [onSubmit]);

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent,
    editorProps: {
      attributes: {
        spellcheck: 'true',
        'data-placeholder': placeholder || '',
      },
      handleKeyDown(_view, event) {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          onSubmitRef.current?.();
          return true;
        }
        return false;
      },
    },
    onUpdate({ editor }) {
      onChangeRef.current?.(editor.getHTML(), editor.isEmpty);
    },
  });

  useImperativeHandle(ref, () => ({
    clearContent() {
      editor?.commands.clearContent(true);
    },
    focus() {
      editor?.commands.focus();
    },
  }), [editor]);

  if (!editor) return null;

  return (
    <div className="rich-editor">
      <div className="rich-editor-toolbar">
        <button
          type="button"
          className={`toolbar-btn${editor.isActive('bold') ? ' toolbar-btn--active' : ''}`}
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}
          title="Bold (Ctrl+B)"
        ><b>B</b></button>

        <button
          type="button"
          className={`toolbar-btn${editor.isActive('italic') ? ' toolbar-btn--active' : ''}`}
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}
          title="Italic (Ctrl+I)"
        ><i>I</i></button>

        <div className="toolbar-divider" />

        <button
          type="button"
          className={`toolbar-btn${editor.isActive('heading', { level: 1 }) ? ' toolbar-btn--active' : ''}`}
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 1 }).run(); }}
          title="Heading 1"
        >H1</button>

        <button
          type="button"
          className={`toolbar-btn${editor.isActive('heading', { level: 2 }) ? ' toolbar-btn--active' : ''}`}
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 2 }).run(); }}
          title="Heading 2"
        >H2</button>

        <div className="toolbar-divider" />

        <button
          type="button"
          className={`toolbar-btn${editor.isActive('bulletList') ? ' toolbar-btn--active' : ''}`}
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBulletList().run(); }}
          title="Bullet list"
        >• List</button>

        <button
          type="button"
          className={`toolbar-btn${editor.isActive('orderedList') ? ' toolbar-btn--active' : ''}`}
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run(); }}
          title="Ordered list"
        >1. List</button>

        <div className="toolbar-divider" />

        <button
          type="button"
          className={`toolbar-btn${editor.isActive('blockquote') ? ' toolbar-btn--active' : ''}`}
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBlockquote().run(); }}
          title="Blockquote"
        >❝</button>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
});

export default RichEditor;
