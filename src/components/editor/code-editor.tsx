
import React from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import { Loader } from "lucide-react";

interface CodeEditorProps {
  value: string;
  onChange: (value: string | undefined) => void;
  path: string;
  readOnly?: boolean;
}

export function CodeEditor({
  value,
  onChange,
  path,
  readOnly = false
}: CodeEditorProps) {
  const handleEditorDidMount: OnMount = (editor) => {
    // Enable auto-save on Ctrl+S
    editor.addCommand(
      // Monaco.KeyMod.CtrlCmd | Monaco.KeyCode.KeyS,
      2051, // This is the keybinding for Ctrl+S
      () => {
        const value = editor.getValue();
        onChange(value);
      }
    );
  };

  const getLanguage = (path: string) => {
    if (!path) return "javascript";
    
    const extension = path.split('.').pop()?.toLowerCase();
    
    const languageMap: Record<string, string> = {
      js: "javascript",
      jsx: "javascript",
      ts: "typescript",
      tsx: "typescript",
      html: "html",
      css: "css",
      json: "json",
      md: "markdown"
    };
    
    return languageMap[extension || ""] || "javascript";
  };

  return (
    <div className="h-full w-full bg-background border rounded-md overflow-hidden">
      <Editor
        height="100%"
        value={value}
        language={getLanguage(path)}
        onChange={onChange}
        theme="vs-dark"
        loading={<div className="flex items-center justify-center h-full"><Loader className="h-6 w-6 animate-spin" /></div>}
        options={{
          minimap: { enabled: false },
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          readOnly,
          wordWrap: "on",
          automaticLayout: true
        }}
        onMount={handleEditorDidMount}
      />
    </div>
  );
}
