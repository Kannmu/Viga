import { useEffect, useRef } from 'react';
import type { ChatMessage, ToolCallingProgressEvent } from '@viga/ai-integration';

interface AiPanelProps {
  chatHistory: ChatMessage[];
  chatInput: string;
  chatStreaming: boolean;
  progressEvents: ToolCallingProgressEvent[];
  chatError: string | null;
  onChatInputChange: (value: string) => void;
  onRun: () => void;
}

export function AiPanel({
  chatHistory,
  chatInput,
  chatStreaming,
  progressEvents,
  chatError,
  onChatInputChange,
  onRun,
}: AiPanelProps): JSX.Element {
  const logRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!logRef.current) {
      return;
    }
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [chatHistory, chatStreaming, progressEvents]);

  const formatJsonLine = (raw: string): string => {
    try {
      return JSON.stringify(JSON.parse(raw));
    } catch {
      return raw;
    }
  };

  return (
    <section className="ai-panel">
      <div className="ai-panel-head">
        <div>
          <strong>AI Assistant</strong>
          <span>{chatStreaming ? 'Streaming response...' : 'Ready for prompts'}</span>
        </div>
      </div>

      <div ref={logRef} className="ai-chat-log">
        {chatHistory.length === 0 ? <div className="ai-empty">Describe what to draw or edit.</div> : null}
        {chatHistory.map((msg, idx) => (
          <div key={`${msg.role}-${idx}`} className={`ai-msg ai-msg-${msg.role}`}>
            <div className="ai-msg-role">{msg.role === 'user' ? 'You' : 'Assistant'}</div>
            {msg.content}
          </div>
        ))}
        {chatStreaming ? (
          <div className="ai-msg ai-msg-assistant ai-live-stream">
            <div className="ai-msg-role">Assistant</div>
            {progressEvents.length === 0 ? <div className="ai-typing">Thinking...</div> : null}
            {progressEvents.map((event, idx) => {
              if (event.type === 'status') {
                return <div key={`status-${idx}`} className="ai-stream-line ai-stream-status">[status] {event.message}</div>;
              }
              if (event.type === 'reasoning') {
                return <div key={`reasoning-${idx}`} className="ai-stream-line ai-stream-reasoning">[reasoning] {event.content}</div>;
              }
              if (event.type === 'assistant') {
                return <div key={`assistant-${idx}`} className="ai-stream-line ai-stream-assistant">[assistant] {event.content}</div>;
              }
              if (event.type === 'done') {
                return <div key={`done-${idx}`} className="ai-stream-line ai-stream-done">[done] {event.finalMessage || 'Completed'}</div>;
              }
              if (event.type === 'tool-call') {
                return (
                  <div key={`call-${event.id}-${idx}`} className="ai-stream-line ai-stream-tool-call">
                    [tool-call] {event.name} args={formatJsonLine(event.arguments)}
                  </div>
                );
              }
              return (
                <div key={`result-${event.id}-${idx}`} className="ai-stream-line ai-stream-tool-result">
                  [tool-result] {event.name} output={formatJsonLine(event.output)}
                </div>
              );
            })}
          </div>
        ) : null}
        {!chatStreaming && progressEvents.length > 0 ? (
          <div className="ai-msg ai-msg-assistant ai-live-stream ai-live-stream-complete">
            <div className="ai-msg-role">Last Run Trace</div>
            {progressEvents.map((event, idx) => {
              if (event.type === 'status') {
                return <div key={`hist-status-${idx}`} className="ai-stream-line ai-stream-status">[status] {event.message}</div>;
              }
              if (event.type === 'reasoning') {
                return <div key={`hist-reasoning-${idx}`} className="ai-stream-line ai-stream-reasoning">[reasoning] {event.content}</div>;
              }
              if (event.type === 'assistant') {
                return <div key={`hist-assistant-${idx}`} className="ai-stream-line ai-stream-assistant">[assistant] {event.content}</div>;
              }
              if (event.type === 'done') {
                return <div key={`hist-done-${idx}`} className="ai-stream-line ai-stream-done">[done] {event.finalMessage || 'Completed'}</div>;
              }
              if (event.type === 'tool-call') {
                return (
                  <div key={`hist-call-${event.id}-${idx}`} className="ai-stream-line ai-stream-tool-call">
                    [tool-call] {event.name} args={formatJsonLine(event.arguments)}
                  </div>
                );
              }
              return (
                <div key={`hist-result-${event.id}-${idx}`} className="ai-stream-line ai-stream-tool-result">
                  [tool-result] {event.name} output={formatJsonLine(event.output)}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="ai-chat-input-row">
        <textarea
          value={chatInput}
          onChange={(e) => onChatInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onRun();
            }
          }}
          placeholder="Create a simple landing hero with title and button"
          className="ai-chat-input"
        />
        <button type="button" onClick={onRun} disabled={chatStreaming || !chatInput.trim()}>
          {chatStreaming ? 'Running...' : 'Run'}
        </button>
      </div>

      {chatError ? <div className="ai-error">{chatError}</div> : null}
    </section>
  );
}
