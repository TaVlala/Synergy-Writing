import React, { useState, useRef, useEffect, useMemo, useImperativeHandle, forwardRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Highlight from '@tiptap/extension-highlight';
import BubbleMenuExtension from '@tiptap/extension-bubble-menu';
import { Comment } from '../extensions/Comment';
import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import * as PMView from '@tiptap/pm/view';
const { Decoration, DecorationSet } = PMView;

// ── Global registry so only ONE selectionchange listener is ever active ──────
// Maps each readonly instance's entry { containerRef, setMenu } so the single
// handler can show the right menu and hide all others atomically.
const readonlyRegistry = new Set();

// Show menu on mouseup (after drag ends) — stable position, no jumping during drag
function handleGlobalMouseUp() {
  const sel = window.getSelection();
  const hasSelection = sel && !sel.isCollapsed && sel.toString().trim();
  let matched = false;
  for (const entry of readonlyRegistry) {
    const container = entry.containerRef.current;
    if (!container) continue;
    if (!matched && hasSelection && container.contains(sel.anchorNode)) {
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      // position: fixed uses viewport coords — no scrollY/scrollX offset
      entry.setMenu({
        visible: true,
        top: rect.top - 44,
        left: rect.left + rect.width / 2,
      });
      matched = true;
    } else {
      entry.setMenu(m => m.visible ? { ...m, visible: false } : m);
    }
  }
}

// Hide menu when selection collapses (click away, Escape, etc.)
function handleGlobalSelectionChange() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.toString().trim()) {
    for (const entry of readonlyRegistry) {
      entry.setMenu(m => m.visible ? { ...m, visible: false } : m);
    }
  }
}

const RichEditor = forwardRef(function RichEditor(
  { initialContent = '', onChange, onSubmit, placeholder, otherCursors = {}, onSelectionUpdate, onCommentClick, onInlineCommentCreate, onHighlightUpdate, editable = true, currentUserName = 'Anonymous' },
  ref
) {
  const onChangeRef = useRef(onChange);
  const onSubmitRef = useRef(onSubmit);
  const onSelectionUpdateRef = useRef(onSelectionUpdate);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { onSubmitRef.current = onSubmit; }, [onSubmit]);
  useEffect(() => { onSelectionUpdateRef.current = onSelectionUpdate; }, [onSelectionUpdate]);

  // Use a ref for otherCursors so the plugin always reads the latest value
  const otherCursorsRef = useRef(otherCursors);
  const containerRef = useRef(null);

  const [linkPopover, setLinkPopover] = useState({ visible: false, value: '' });
  const [readonlyMenu, setReadonlyMenu] = useState({ visible: false, top: 0, left: 0 });
  const [thesaurus, setThesaurus] = useState({ visible: false, word: '', synonyms: [], loading: false, pos: { top: 0, left: 0 } });

  const CursorExtension = useMemo(() => {
    return Extension.create({
      name: 'cursors',
      addProseMirrorPlugins() {
        return [
          new Plugin({
            props: {
              decorations(state) {
                const decos = [];
                const cursors = otherCursorsRef.current || {};

                Object.entries(cursors).forEach(([userId, data]) => {
                  if (!data) return;
                  const { position, color, name } = data;
                  if (position === null || position === undefined) return;

                  const docSize = state.doc.content.size;
                  const pos = Math.min(Math.max(0, position), docSize);

                  const widget = document.createElement('span');
                  widget.className = 'collaboration-cursor';
                  widget.style.borderLeftColor = color;

                  const label = document.createElement('span');
                  label.className = 'collaboration-cursor-label';
                  label.style.backgroundColor = color;
                  label.innerText = name || 'Anonymous';
                  widget.appendChild(label);

                  decos.push(Decoration.widget(pos, widget));
                });
                return DecorationSet.create(state.doc, decos);
              },
            },
          }),
        ];
      },
    });
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'rich-link',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'rich-image',
        },
      }),
      Highlight.configure({ multicolor: true }),
      BubbleMenuExtension,
      Comment,
      CursorExtension,
    ],
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
    onSelectionUpdate({ editor }) {
      onSelectionUpdateRef.current?.(editor.state.selection.head);
    },
  });

  // Update cursor ref and dispatch a no-op transaction to trigger decoration re-render
  useEffect(() => {
    otherCursorsRef.current = otherCursors;
    if (editor && !editor.isDestroyed) {
      editor.view.dispatch(editor.state.tr);
    }
  }, [editor, otherCursors]);

  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  // Register with the global registry when readonly; one shared listener handles all instances
  useEffect(() => {
    if (editable) return;
    const entry = { containerRef, setMenu: setReadonlyMenu };
    readonlyRegistry.add(entry);
    if (readonlyRegistry.size === 1) {
      document.addEventListener('mouseup', handleGlobalMouseUp);
      document.addEventListener('selectionchange', handleGlobalSelectionChange);
    }
    return () => {
      readonlyRegistry.delete(entry);
      if (readonlyRegistry.size === 0) {
        document.removeEventListener('mouseup', handleGlobalMouseUp);
        document.removeEventListener('selectionchange', handleGlobalSelectionChange);
      }
    };
  }, [editable]);

  useImperativeHandle(ref, () => ({
    clearContent() {
      editor?.commands.clearContent(true);
    },
    focus() {
      editor?.commands.focus();
    },
  }), [editor]);

  const applyLink = () => {
    if (linkPopover.value) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkPopover.value }).run();
    } else {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    }
    setLinkPopover({ visible: false, value: '' });
  };

  const fetchSynonyms = async (word, pos) => {
    if (!word) return;
    const clean = word.trim().toLowerCase();
    setThesaurus({ visible: true, word: word.trim(), synonyms: [], loading: true, pos });
    try {
      // Datamuse: rel_syn = synonyms, ml = means-like; fetch both for richness
      const [synRes, mlRes] = await Promise.all([
        fetch(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(clean)}&max=40`),
        fetch(`https://api.datamuse.com/words?ml=${encodeURIComponent(clean)}&max=20`),
      ]);
      const [synData, mlData] = await Promise.all([synRes.json(), mlRes.json()]);
      const seen = new Set();
      const syns = [];
      [...synData, ...mlData].forEach(({ word: w }) => {
        if (w && w !== clean && !seen.has(w)) { seen.add(w); syns.push(w); }
      });
      if (syns.length === 0) throw new Error('none');
      setThesaurus(prev => ({ ...prev, synonyms: syns.slice(0, 30), loading: false }));
    } catch {
      setThesaurus(prev => ({ ...prev, synonyms: [], loading: false }));
    }
  };

  const handleThesaurusClick = (e) => {
    e.preventDefault();
    const sel = window.getSelection();
    if (!sel.isCollapsed) {
      const word = sel.toString().trim();
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      // position relative to viewport
      fetchSynonyms(word, { top: rect.bottom + 10, left: rect.left });
    }
  };

  if (!editor) return null;

  return (
    <div
      ref={containerRef}
      className={`rich-editor${!editable ? ' rich-editor--readonly' : ''}`}
      style={{ position: 'relative' }}
      onClick={e => {
        const target = e.target.closest('.inline-comment');
        if (target) {
          const commentId = target.getAttribute('data-comment-id');
          if (commentId) onCommentClick?.(commentId);
        }
        // Hide thesaurus on click away
        if (!e.target.closest('.thesaurus-popover') && !e.target.closest('.bubble-menu-btn')) {
          setThesaurus(prev => ({ ...prev, visible: false }));
        }
      }}
    >
      {thesaurus.visible && (
        <div
          className="thesaurus-popover"
          style={{ position: 'fixed', top: thesaurus.pos.top, left: thesaurus.pos.left, zIndex: 1000 }}
        >
          <div className="thesaurus-header">
            <strong>{thesaurus.word}</strong>
            <button onClick={() => setThesaurus(prev => ({ ...prev, visible: false }))}>✕</button>
          </div>
          <div className="thesaurus-body">
            {thesaurus.loading ? <div className="spinner-sm" /> : (
              <div className="synonym-list">
                {thesaurus.synonyms.length > 0 ? thesaurus.synonyms.map(s => (
                  <button
                    key={s}
                    className="synonym-btn"
                    onClick={() => {
                      if (editable) {
                        editor.chain().focus().insertContent(s).run();
                      }
                      setThesaurus(prev => ({ ...prev, visible: false }));
                    }}
                  >
                    {s}
                  </button>
                )) : <span>No synonyms found for "{thesaurus.word}"</span>}
              </div>
            )}
          </div>
        </div>
      )}
      {/* Floating menu for readonly mode — rendered via fixed positioning to escape overflow:hidden parents */}
      {!editable && readonlyMenu.visible && (
        <div
          className="readonly-bubble-menu"
          style={{ position: 'fixed', top: readonlyMenu.top, left: readonlyMenu.left }}
        >
          <button
            className="bubble-menu-btn"
            onMouseDown={e => {
              e.preventDefault();
              const commentId = `comment-${Date.now()}`;
              editor.chain().setComment(commentId, currentUserName).run();
              onInlineCommentCreate?.(commentId, editor.getHTML());
              setReadonlyMenu(m => ({ ...m, visible: false }));
            }}
          >
            💬 Comment
          </button>
          <button
            className="bubble-menu-btn"
            onMouseDown={e => {
              e.preventDefault();
              editor.chain().toggleHighlight().run();
              onHighlightUpdate?.(editor.getHTML());
              setReadonlyMenu(m => ({ ...m, visible: false }));
            }}
          >
            🖍️ Highlight
          </button>
          <button
            className="bubble-menu-btn"
            onMouseDown={handleThesaurusClick}
          >
            📖 Thesaurus
          </button>
        </div>
      )}
      {editable && (
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

          <div className="toolbar-divider" />

          <button
            type="button"
            className={`toolbar-btn${editor.isActive({ textAlign: 'left' }) ? ' toolbar-btn--active' : ''}`}
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().setTextAlign('left').run(); }}
            title="Align left"
          >≡L</button>

          <button
            type="button"
            className={`toolbar-btn${editor.isActive({ textAlign: 'center' }) ? ' toolbar-btn--active' : ''}`}
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().setTextAlign('center').run(); }}
            title="Align center"
          >≡C</button>

          <button
            type="button"
            className={`toolbar-btn${editor.isActive({ textAlign: 'right' }) ? ' toolbar-btn--active' : ''}`}
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().setTextAlign('right').run(); }}
            title="Align right"
          >≡R</button>

          <button
            type="button"
            className={`toolbar-btn${editor.isActive({ textAlign: 'justify' }) ? ' toolbar-btn--active' : ''}`}
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().setTextAlign('justify').run(); }}
            title="Justify"
          >≡J</button>

          <div className="toolbar-divider" />

          <button
            type="button"
            className={`toolbar-btn${editor.isActive('link') ? ' toolbar-btn--active' : ''}`}
            onMouseDown={e => {
              e.preventDefault();
              const previousUrl = editor.getAttributes('link').href || '';
              setLinkPopover({ visible: true, value: previousUrl });
            }}
            title="Link"
          >🔗</button>

          {linkPopover.visible && (
            <div className="toolbar-link-popover">
              <input
                className="input input--sm"
                type="url"
                placeholder="https://..."
                value={linkPopover.value}
                autoFocus
                onChange={e => setLinkPopover(p => ({ ...p, value: e.target.value }))}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); applyLink(); }
                  if (e.key === 'Escape') setLinkPopover({ visible: false, value: '' });
                }}
              />
              <button type="button" className="btn btn-sm" onMouseDown={e => { e.preventDefault(); applyLink(); }}>Apply</button>
              <button type="button" className="btn btn-sm btn-ghost" onMouseDown={e => { e.preventDefault(); setLinkPopover({ visible: false, value: '' }); }}>✕</button>
            </div>
          )}

          <button
            type="button"
            className="toolbar-btn"
            onMouseDown={e => {
              e.preventDefault();
              const url = window.prompt('Image URL');
              if (url) {
                editor.chain().focus().setImage({ src: url }).run();
              }
            }}
            title="Image"
          >🖼️</button>

          <div className="toolbar-divider" />

          <button
            type="button"
            className={`toolbar-btn${editor.isActive('highlight') ? ' toolbar-btn--active' : ''}`}
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHighlight().run(); }}
            title="Highlight"
          >🖍️</button>

          <button
            type="button"
            className={`toolbar-btn${editor.isActive('comment') ? ' toolbar-btn--active' : ''}`}
            onMouseDown={e => {
              e.preventDefault();
              if (editor.isActive('comment')) {
                editor.chain().focus().unsetComment().run();
              } else {
                const text = editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to);
                if (!text.trim()) return;
                const commentId = `comment-${Date.now()}`;
                editor.chain().focus().setComment(commentId, currentUserName).run();
              }
            }}
            title="Inline Comment"
          >💬+</button>
        </div>
      )}

      <EditorContent editor={editor} />

      {editor && (
        <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }} shouldShow={({ editor, from, to }) => {
          return !editor.isDestroyed && editor.isEditable && from !== to;
        }}>
          <div className="bubble-menu">
            <button
              className="bubble-menu-btn"
              onClick={() => {
                const commentId = `comment-${Date.now()}`;
                editor.chain().focus().setComment(commentId, currentUserName).run();
                if (!editable) {
                  onInlineCommentCreate?.(commentId, editor.getHTML());
                }
              }}
            >
              💬 Comment
            </button>
            <button
              className="bubble-menu-btn"
              onClick={() => editor.chain().focus().toggleHighlight().run()}
            >
              🖍️ Highlight
            </button>
            <button
              className="bubble-menu-btn"
              onClick={handleThesaurusClick}
            >
              📖 Thesaurus
            </button>
          </div>
        </BubbleMenu>
      )}
    </div>
  );
});

export default RichEditor;
