import { useRef, useCallback } from "react";
import * as monaco from "monaco-editor";
import type { RemoteCursorData } from "../types/collabration";

const safeId = (id: string) => `u${id.replace(/[^a-zA-Z0-9]/g, "")}`;

const injectStyle = (userId: string, color: string, name: string) => {
  const id = safeId(userId);
  const styleId = `monaco-cursor-${id}`;
  if (document.getElementById(styleId)) return;

  const el = document.createElement("style");
  el.id = styleId;
  el.innerHTML = `
    .cursor-${id} { background-color: ${color} !important; box-shadow: 0 0 5px ${color}88; }
    .label-${id}::before { content: "${name}" !important; background-color: ${color} !important; }
  `;
  document.head.appendChild(el);
};

const removeStyle = (userId: string) =>
  document.getElementById(`monaco-cursor-${safeId(userId)}`)?.remove();

export const useRemoteCursors = (
  editorRef: React.MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>
) => {
  const decorations = useRef<Record<string, string[]>>({});

  const applyCursor = useCallback((data: RemoteCursorData) => {
    const editor = editorRef.current;
    if (!editor?.getModel()) return;

    const id = safeId(data.userId);
    injectStyle(data.userId, data.color, data.name);

    decorations.current[data.userId] = editor.deltaDecorations(
      decorations.current[data.userId] || [],
      [{
        range: new monaco.Range(
          data.position.lineNumber, data.position.column,
          data.position.lineNumber, data.position.column
        ),
        options: {
          className: `remote-cursor cursor-${id}`,
          beforeContentClassName: `cursor-label label-${id}`,
          stickiness: monaco.editor.TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges,
        },
      }]
    );
  }, [editorRef]);

  const removeCursor = useCallback((userId: string) => {
    const editor = editorRef.current;
    if (editor?.getModel() && decorations.current[userId]) {
      editor.getModel()?.deltaDecorations(decorations.current[userId], []);
      delete decorations.current[userId];
      removeStyle(userId);
    }
  }, [editorRef]);

  return { applyCursor, removeCursor, injectUserStyle: injectStyle };
};