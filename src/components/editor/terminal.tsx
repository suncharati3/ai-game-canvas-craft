
import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface TerminalProps {
  logs: string[];
  className?: string;
}

export function Terminal({ logs, className }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="flex justify-between items-center px-4 py-2 bg-[#1e1e1e] text-white">
        <h3 className="font-mono text-sm">Terminal</h3>
      </div>
      <div 
        ref={terminalRef}
        className="flex-1 bg-[#1e1e1e] text-white overflow-auto p-4 font-mono text-sm"
      >
        {logs.length === 0 ? (
          <p className="text-gray-400">No logs available</p>
        ) : (
          <pre className="whitespace-pre-wrap">
            {logs.join('\n')}
          </pre>
        )}
      </div>
    </div>
  );
}
