import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { BubbleMenu } from '@tiptap/react/menus';
import { EditorContent, useEditor } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import Color from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import { Plugin } from '@tiptap/pm/state';
import * as PMView from '@tiptap/pm/view';
import StarterKit from '@tiptap/starter-kit';
import { Comment } from '../extensions/Comment';

const CaseToggle = Extension.create({
  name: 'caseToggle',
  addCommands() {
    return {
      toggleCase: () => ({ state, commands }) => {
        const { from, to, empty } = state.selection;
        if (empty) return false;
        const text = state.doc.textBetween(from, to);
        let nextText = '';
        if (text === text.toUpperCase()) nextText = text.toLowerCase();
        else if (text === text.toLowerCase()) nextText = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
        else nextText = text.toUpperCase();
        return commands.insertContentAt({ from, to }, nextText);
      },
    };
  },
});

const readonlyRegistry = new Set();

function handleGlobalMouseUp() {
  const selection = window.getSelection();
  const hasSelection = selection && !selection.isCollapsed && selection.toString().trim();
  let matched = false;

  for (const entry of readonlyRegistry) {
    const container = entry.containerRef.current;
    if (!container) continue;
    if (!matched && hasSelection && container.contains(selection.anchorNode)) {
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      entry.setMenu({ visible: true, top: rect.top - 44, left: rect.left + rect.width / 2 });
      matched = true;
    } else {
      entry.setMenu(current => (current.visible ? { ...current, visible: false } : current));
    }
  }
}

function handleGlobalSelectionChange() {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.toString().trim()) {
    for (const entry of readonlyRegistry) {
      entry.setMenu(current => (current.visible ? { ...current, visible: false } : current));
    }
  }
}

const RichEditor = forwardRef(function RichEditor(
  {
    initialContent = '',
    onChange,
    onSubmit,
    placeholder,
    otherCursors = {},
    onSelectionUpdate,
    onCommentClick,
    onInlineCommentCreate,
    onHighlightUpdate,
    editable = true,
    currentUserName = 'Anonymous',
    showCommentBubble = true,
  },
  ref
) {
  const onChangeRef = useRef(onChange);
  const onSubmitRef = useRef(onSubmit);
  const onSelectionUpdateRef = useRef(onSelectionUpdate);
  const otherCursorsRef = useRef(otherCursors);
  const containerRef = useRef(null);
  const thesaurusAbortRef = useRef(null);
  const lastTextSelectionRef = useRef(null);

  const [linkPopover, setLinkPopover] = useState({ visible: false, value: '' });
  const [imagePopover, setImagePopover] = useState({ visible: false, value: '' });
  const [readonlyMenu, setReadonlyMenu] = useState({ visible: false, top: 0, left: 0 });
  const [thesaurus, setThesaurus] = useState({
    visible: false,
    word: '',
    synonyms: [],
    loading: false,
    pos: { top: 0, left: 0 },
    selFrom: null,
    selTo: null,
    message: '',
  });

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { onSubmitRef.current = onSubmit; }, [onSubmit]);
  useEffect(() => { onSelectionUpdateRef.current = onSelectionUpdate; }, [onSelectionUpdate]);

  const CursorExtension = useMemo(() => Extension.create({
    name: 'cursors',
    addProseMirrorPlugins() {
      return [
        new Plugin({
          props: {
            decorations(state) {
              const decorations = [];
              const cursors = otherCursorsRef.current || {};

              Object.values(cursors).forEach(data => {
                if (!data) return;
                const { position, color, name } = data;
                if (position === null || position === undefined) return;
                const pos = Math.min(Math.max(0, position), state.doc.content.size);
                const widget = document.createElement('span');
                widget.className = 'collaboration-cursor';
                widget.style.borderLeftColor = color;

                const label = document.createElement('span');
                label.className = 'collaboration-cursor-label';
                label.style.backgroundColor = color;
                label.innerText = name || 'Anonymous';
                widget.appendChild(label);
                decorations.push(PMView.Decoration.widget(pos, widget));
              });

              return PMView.DecorationSet.create(state.doc, decorations);
            },
          },
        }),
      ];
    },
  }), []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      FontFamily,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Image.configure({ HTMLAttributes: { class: 'rich-image' } }),
      Link.configure({ openOnClick: false, autolink: true, defaultProtocol: 'https' }),
      Underline,
      Highlight.configure({ multicolor: true }),
      Comment,
      CursorExtension,
      CaseToggle,
    ],
    content: initialContent,
    editorProps: {
      attributes: { spellcheck: 'true', 'data-placeholder': placeholder || '' },
      handleKeyDown(_view, event) {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          onSubmitRef.current?.();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: current }) => {
      onChangeRef.current?.(current.getHTML(), current.isEmpty);
    },
    onSelectionUpdate: ({ editor: current }) => {
      const { from, to, empty } = current.state.selection;
      if (!empty) {
        const selectedText = current.state.doc.textBetween(from, to, ' ');
        lastTextSelectionRef.current = { from, to, selectedText };
      }
      onSelectionUpdateRef.current?.(current.state.selection.head);
    },
  });

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
  }, [editable, editor]);

  useEffect(() => {
    if (editable) return undefined;
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

  useEffect(() => () => thesaurusAbortRef.current?.abort(), []);

  useImperativeHandle(ref, () => ({
    clearContent() {
      editor?.commands.clearContent(true);
    },
    focus() {
      editor?.commands.focus();
    },
  }), [editor]);

  const closePopover = setter => setter({ visible: false, value: '' });

  const applyLink = () => {
    if (!editor) return;
    if (linkPopover.value) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkPopover.value }).run();
    } else {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    }
    closePopover(setLinkPopover);
  };

  const applyImage = () => {
    if (!editor) return;
    if (imagePopover.value) {
      editor.chain().focus().setImage({ src: imagePopover.value }).run();
    }
    closePopover(setImagePopover);
  };

  const fetchSynonyms = async (word, pos, selFrom, selTo) => {
    if (!word) return;
    const clean = word.trim().toLowerCase();
    let contextStr = '';

    if (editor && selFrom !== null && selTo !== null) {
      const doc = editor.state.doc;
      const start = Math.max(0, selFrom - 50);
      const end = Math.min(doc.content.size, selTo + 50);
      contextStr = doc.textBetween(start, end, ' ');
    }

    thesaurusAbortRef.current?.abort();
    const controller = new AbortController();
    thesaurusAbortRef.current = controller;
    setThesaurus({ visible: true, word: clean, synonyms: [], loading: true, pos, selFrom, selTo, message: '' });

    try {
      const query = new URLSearchParams({ word: clean });
      if (contextStr) query.set('context', contextStr);
      const response = await fetch(`/api/thesaurus?${query.toString()}`, { signal: controller.signal });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || 'Thesaurus lookup failed');
      }

      const synonyms = Array.isArray(data.synonyms) ? data.synonyms.slice(0, 30) : [];

      setThesaurus(current => ({
        ...current,
        synonyms,
        loading: false,
        message: '',
      }));
    } catch (err) {
      if (err.name === 'AbortError') return;
      setThesaurus(current => ({
        ...current,
        synonyms: [],
        loading: false,
        message: 'Could not load synonyms right now.',
      }));
    }
  };

  const handleThesaurusClick = event => {
    event.preventDefault();
    event.stopPropagation();
    if (!editor) return;

    const liveSelection = editor.state.selection;
    const rememberedSelection = lastTextSelectionRef.current;
    const browserSelection = window.getSelection();
    const browserSelectedText = browserSelection?.toString() || '';
    const triggerRect = event.currentTarget.getBoundingClientRect();
    const from = !liveSelection.empty ? liveSelection.from : rememberedSelection?.from;
    const to = !liveSelection.empty ? liveSelection.to : rememberedSelection?.to;
    const selectedText = !liveSelection.empty
      ? editor.state.doc.textBetween(liveSelection.from, liveSelection.to, ' ')
      : rememberedSelection?.selectedText || browserSelectedText;
    const word = selectedText.trim();
    const rect = browserSelection && !browserSelection.isCollapsed && browserSelection.rangeCount > 0
      ? browserSelection.getRangeAt(0).getBoundingClientRect()
      : null;
    const pos = rect
      ? { top: rect.bottom + 10, left: rect.left }
      : { top: triggerRect.bottom + 10, left: triggerRect.left };

    if (!word) {
      setThesaurus({ visible: true, word: '', synonyms: [], loading: false, pos, selFrom: null, selTo: null, message: 'Select a word first.' });
      return;
    }

    const leadingSpaces = selectedText.length - selectedText.trimStart().length;
    const trailingSpaces = selectedText.length - selectedText.trimEnd().length;
    const trimmedFrom = from !== undefined && from !== null ? from + leadingSpaces : null;
    const trimmedTo = to !== undefined && to !== null ? (trailingSpaces > 0 ? to - trailingSpaces : to) : null;

    fetchSynonyms(word, pos, trimmedFrom, trimmedTo);
  };

  if (!editor) return null;

  return (
    <div
      ref={containerRef}
      className={`rich-editor${!editable ? ' rich-editor--readonly' : ''}`}
      style={{ position: 'relative' }}
      onClick={event => {
        const target = event.target.closest?.('.inline-comment');
        if (target) {
          const commentId = target.getAttribute('data-comment-id');
          if (commentId) onCommentClick?.(commentId);
        }
        if (
          !event.target.closest?.('.thesaurus-popover') &&
          !event.target.closest?.('.bubble-menu-btn') &&
          !event.target.closest?.('.rich-editor-toolbar') &&
          !event.target.closest?.('.toolbar-link-popover')
        ) {
          setThesaurus(current => ({ ...current, visible: false }));
        }
      }}
    >
      {thesaurus.visible && (
        <div className="thesaurus-popover" style={{ position: 'fixed', top: thesaurus.pos.top, left: thesaurus.pos.left, zIndex: 1000 }}>
          <div className="thesaurus-header">
            <strong>{thesaurus.word || 'Thesaurus'}</strong>
            <button type="button" onClick={() => setThesaurus(current => ({ ...current, visible: false }))}>x</button>
          </div>
          <div className="thesaurus-body">
            {thesaurus.loading ? <div className="spinner-sm" /> : (
              <div className="synonym-list">
                {thesaurus.message ? <span>{thesaurus.message}</span> : (
                  thesaurus.synonyms.length > 0 ? thesaurus.synonyms.map(synonym => (
                    <button
                      key={synonym}
                      type="button"
                      className="synonym-btn"
                      onClick={() => {
                        if (editable && thesaurus.selFrom !== null && thesaurus.selTo !== null) {
                          editor.chain().focus().deleteRange({ from: thesaurus.selFrom, to: thesaurus.selTo }).insertContentAt(thesaurus.selFrom, synonym).run();
                        }
                        setThesaurus(current => ({ ...current, visible: false }));
                      }}
                    >
                      {synonym}
                    </button>
                  )) : <span>No synonyms found for "{thesaurus.word}"</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {!editable && readonlyMenu.visible && (
        <div className="readonly-bubble-menu" style={{ position: 'fixed', top: readonlyMenu.top, left: readonlyMenu.left }}>
          {showCommentBubble && (
            <button
              type="button"
              className="bubble-menu-btn"
              onMouseDown={event => {
                event.preventDefault();
                const commentId = `comment-${Date.now()}`;
                editor.chain().focus().setComment(commentId, currentUserName).run();
                onInlineCommentCreate?.(commentId, editor.getHTML());
                setReadonlyMenu(current => ({ ...current, visible: false }));
              }}
            >
              Comment
            </button>
          )}
          <button
            type="button"
            className="bubble-menu-btn"
            onMouseDown={event => {
              event.preventDefault();
              editor.chain().focus().toggleHighlight().run();
              onHighlightUpdate?.(editor.getHTML());
              setReadonlyMenu(current => ({ ...current, visible: false }));
            }}
          >
            Highlight
          </button>
        </div>
      )}

      {editable && (
        <div className="rich-editor-toolbar">
          <button type="button" className={`toolbar-btn${editor.isActive('bold') ? ' toolbar-btn--active' : ''}`} onMouseDown={event => { event.preventDefault(); editor.chain().focus().toggleBold().run(); }} title="Bold (Ctrl+B)"><b>B</b></button>
          <button type="button" className={`toolbar-btn${editor.isActive('italic') ? ' toolbar-btn--active' : ''}`} onMouseDown={event => { event.preventDefault(); editor.chain().focus().toggleItalic().run(); }} title="Italic (Ctrl+I)"><i>I</i></button>
          <button type="button" className={`toolbar-btn${editor.isActive('underline') ? ' toolbar-btn--active' : ''}`} onMouseDown={event => { event.preventDefault(); editor.chain().focus().toggleUnderline().run(); }} title="Underline (Ctrl+U)"><u>U</u></button>
          <div className="toolbar-divider" />
          <button type="button" className={`toolbar-btn${editor.isActive('heading', { level: 1 }) ? ' toolbar-btn--active' : ''}`} onMouseDown={event => { event.preventDefault(); editor.chain().focus().toggleHeading({ level: 1 }).run(); }} title="Heading 1">H1</button>
          <button type="button" className={`toolbar-btn${editor.isActive('heading', { level: 2 }) ? ' toolbar-btn--active' : ''}`} onMouseDown={event => { event.preventDefault(); editor.chain().focus().toggleHeading({ level: 2 }).run(); }} title="Heading 2">H2</button>
          <div className="toolbar-divider" />
          <button type="button" className={`toolbar-btn${editor.isActive('bulletList') ? ' toolbar-btn--active' : ''}`} onMouseDown={event => { event.preventDefault(); editor.chain().focus().toggleBulletList().run(); }} title="Bullet list">List</button>
          <button type="button" className={`toolbar-btn${editor.isActive('orderedList') ? ' toolbar-btn--active' : ''}`} onMouseDown={event => { event.preventDefault(); editor.chain().focus().toggleOrderedList().run(); }} title="Ordered list">1.</button>
          <div className="toolbar-divider" />
          <button type="button" className={`toolbar-btn${editor.isActive('blockquote') ? ' toolbar-btn--active' : ''}`} onMouseDown={event => { event.preventDefault(); editor.chain().focus().toggleBlockquote().run(); }} title="Blockquote">Quote</button>
          <div className="toolbar-divider" />
          <button type="button" className={`toolbar-btn${editor.isActive({ textAlign: 'left' }) ? ' toolbar-btn--active' : ''}`} onMouseDown={event => { event.preventDefault(); editor.chain().focus().setTextAlign('left').run(); }} title="Align left">L</button>
          <button type="button" className={`toolbar-btn${editor.isActive({ textAlign: 'center' }) ? ' toolbar-btn--active' : ''}`} onMouseDown={event => { event.preventDefault(); editor.chain().focus().setTextAlign('center').run(); }} title="Align center">C</button>
          <button type="button" className={`toolbar-btn${editor.isActive({ textAlign: 'right' }) ? ' toolbar-btn--active' : ''}`} onMouseDown={event => { event.preventDefault(); editor.chain().focus().setTextAlign('right').run(); }} title="Align right">R</button>
          <button type="button" className={`toolbar-btn${editor.isActive({ textAlign: 'justify' }) ? ' toolbar-btn--active' : ''}`} onMouseDown={event => { event.preventDefault(); editor.chain().focus().setTextAlign('justify').run(); }} title="Justify">J</button>
          <div className="toolbar-divider" />
          <button type="button" className={`toolbar-btn${editor.isActive('link') ? ' toolbar-btn--active' : ''}`} onMouseDown={event => { event.preventDefault(); event.stopPropagation(); setLinkPopover({ visible: true, value: editor.getAttributes('link').href || '' }); }} title="Link">Link</button>
          {linkPopover.visible && (
            <div className="toolbar-link-popover" onClick={event => event.stopPropagation()}>
              <input className="input input--sm" type="url" placeholder="https://..." value={linkPopover.value} autoFocus onChange={event => setLinkPopover(current => ({ ...current, value: event.target.value }))} onKeyDown={event => {
                if (event.key === 'Enter') { event.preventDefault(); applyLink(); }
                if (event.key === 'Escape') closePopover(setLinkPopover);
              }} />
              <button type="button" className="btn btn-sm" onMouseDown={event => { event.preventDefault(); applyLink(); }}>Apply</button>
              <button type="button" className="btn btn-sm btn-ghost" onMouseDown={event => { event.preventDefault(); closePopover(setLinkPopover); }}>x</button>
            </div>
          )}
          <button type="button" className="toolbar-btn" onMouseDown={event => { event.preventDefault(); event.stopPropagation(); setImagePopover({ visible: true, value: '' }); }} title="Image">Image</button>
          {imagePopover.visible && (
            <div className="toolbar-link-popover" onClick={event => event.stopPropagation()}>
              <input className="input input--sm" type="url" placeholder="https://image-url" value={imagePopover.value} autoFocus onChange={event => setImagePopover(current => ({ ...current, value: event.target.value }))} onKeyDown={event => {
                if (event.key === 'Enter') { event.preventDefault(); applyImage(); }
                if (event.key === 'Escape') closePopover(setImagePopover);
              }} />
              <button type="button" className="btn btn-sm" onMouseDown={event => { event.preventDefault(); applyImage(); }}>Insert</button>
              <button type="button" className="btn btn-sm btn-ghost" onMouseDown={event => { event.preventDefault(); closePopover(setImagePopover); }}>x</button>
            </div>
          )}
          <div className="toolbar-divider" />
          <select className="toolbar-select" onChange={event => editor.chain().focus().setFontFamily(event.target.value).run()} value={editor.getAttributes('textStyle').fontFamily || ''}>
            <option value="">Default Font</option>
            <option value="Inter, sans-serif">Sans-serif</option>
            <option value="Merriweather, serif">Serif</option>
            <option value="JetBrains Mono, monospace">Mono</option>
          </select>
          <div className="toolbar-divider" />
          <div className="toolbar-color-wrap">
            <input type="color" className="toolbar-color-input" onInput={event => editor.chain().focus().setColor(event.target.value).run()} value={editor.getAttributes('textStyle').color || '#000000'} title="Font color" />
            <span className="toolbar-color-icon">A</span>
          </div>
          <div className="toolbar-divider" />
          <button type="button" className="toolbar-btn" onMouseDown={event => { event.preventDefault(); editor.chain().focus().toggleCase().run(); }} title="Toggle Case">Aa</button>
          <div className="toolbar-divider" />
          <button type="button" className="toolbar-btn" onMouseDown={handleThesaurusClick} onClick={event => event.stopPropagation()} title="Thesaurus">Syn</button>
        </div>
      )}

      <EditorContent editor={editor} />

      <BubbleMenu editor={editor} shouldShow={({ editor: current, from, to }) => (!current.isDestroyed && current.isEditable && from !== to && showCommentBubble)}>
        <div className="bubble-menu">
          <button
            type="button"
            className="bubble-menu-btn"
            onClick={() => {
              const commentId = `comment-${Date.now()}`;
              editor.chain().focus().setComment(commentId, currentUserName).run();
              onInlineCommentCreate?.(commentId, editor.getHTML());
            }}
          >
            Comment
          </button>
          <button type="button" className="bubble-menu-btn" onClick={() => editor.chain().focus().toggleHighlight().run()}>Highlight</button>
        </div>
      </BubbleMenu>
    </div>
  );
});

export default RichEditor;