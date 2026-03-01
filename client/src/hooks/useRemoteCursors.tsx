import { useRef, useCallback, useEffect } from "react";
import * as monaco from "monaco-editor";
import type {
  RemoteCursorData,
  RemoteSelectionData,
} from "../types/collabration";

const safeId = (id: string) => `u${id.replace(/[^a-zA-Z0-9]/g, "")}`;

const injectStyle = (userId: string, color: string, name: string) => {
  const id = safeId(userId);
  const styleId = `monaco-cursor-${id}`;
  if (document.getElementById(styleId)) return;

  const el = document.createElement("style");
  el.id = styleId;
  el.innerHTML = `
    /* The Cursor */
    .cursor-${id} { 
      background-color: ${color} !important; 
      width: 2px !important; 
    }
    /* The Label */
    .label-${id}::before { 
      content: "${name}" !important; 
      background-color: ${color} !important; 
      color: white;
      padding: 0 4px;
      font-size: 10px;
    }
    /* The Selection - Added 'z-index' and 'pointer-events' */
    /* Update your injectStyle innerHTML to this */
.selection-${id} { 
  background-color: ${color}40 !important; 
  /* Critical: prevents the decoration from capturing mouse events */
  pointer-events: none !important; 
  z-index: 1 !important; 
}
  `;
  document.head.appendChild(el);
};

const removeStyle = (userId: string) =>
  document.getElementById(`monaco-cursor-${safeId(userId)}`)?.remove();

export const useRemoteCursors = (
  editorRef: React.MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>,
) => {
  const cursorCollections = useRef<
    Map<string, monaco.editor.IEditorDecorationsCollection>
  >(new Map());
  const selectionCollections = useRef<
    Map<string, monaco.editor.IEditorDecorationsCollection>
  >(new Map());

  const getOrCreateCollection = (
    userId: string,
    map: React.MutableRefObject<
      Map<string, monaco.editor.IEditorDecorationsCollection>
    >,
    editor: monaco.editor.IStandaloneCodeEditor,
  ) => {
    if (!map.current.has(userId)) {
      map.current.set(userId, editor.createDecorationsCollection([]));
    }
    return map.current.get(userId)!;
  };

  const applyCursor = useCallback(
    (data: RemoteCursorData) => {
      const editor = editorRef.current;
      if (!editor) return;

      const id = safeId(data.userId);
      injectStyle(data.userId, data.color, data.name);

      const collection = getOrCreateCollection(
        data.userId,
        cursorCollections,
        editor,
      );

      collection.set([
        {
          range: new monaco.Range(
            data.position.lineNumber,
            data.position.column,
            data.position.lineNumber,
            data.position.column,
          ),
          options: {
            className: `remote-cursor cursor-${id}`,
            beforeContentClassName: `cursor-label label-${id}`,
            stickiness:
              monaco.editor.TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges,
          },
        },
      ]);
    },
    [editorRef],
  );

  const applySelection = useCallback(
    (data: RemoteSelectionData) => {
      const editor = editorRef.current;
      if (!editor) return;

      const id = safeId(data.userId);
      injectStyle(data.userId, data.color, data.name);

      const collection = getOrCreateCollection(
        data.userId,
        selectionCollections,
        editor,
      );
      const { startLineNumber, startColumn, endLineNumber, endColumn } =
        data.selection;

      if (startLineNumber === endLineNumber && startColumn === endColumn) {
        collection.set([]); 
        return;
      }

      collection.set([
        {
          range: new monaco.Range(
            startLineNumber,
            startColumn,
            endLineNumber,
            endColumn,
          ),
          options: {
            className: `selection-${id}`,
            showIfCollapsed: false,
            stickiness:
              monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          },
        },
      ]);
    },
    [editorRef],
  );

  const removeCursor = useCallback((userId: string) => {
    cursorCollections.current.get(userId)?.clear();
    cursorCollections.current.delete(userId);

    selectionCollections.current.get(userId)?.clear();
    selectionCollections.current.delete(userId);

    removeStyle(userId);
  }, []);

  useEffect(() => {
    const currentCursors = cursorCollections.current;
    const currentSelections = selectionCollections.current;

    return () => {
      currentCursors.forEach((collection) => {
        collection.clear();
      });
      currentCursors.clear();

      currentSelections.forEach((collection) => {
        collection.clear();
      });
      currentSelections.clear();
    };
  }, []);

  return {
    applyCursor,
    applySelection,
    removeCursor,
    injectUserStyle: injectStyle,
  };
};
