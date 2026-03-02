import { useEffect, useRef } from 'react';
import type { ChatMessage, ModelConfig } from '@viga/ai-integration';

interface AiPanelProps {
  modelDraft: ModelConfig;
  modelConfigs: ModelConfig[];
  chatHistory: ChatMessage[];
  chatInput: string;
  chatStreaming: boolean;
  chatError: string | null;
  testStatus: string;
  apiKeyDraft: string;
  onChatInputChange: (value: string) => void;
  onSelectModel: (modelId: string) => void;
  onPatchModelDraft: (patch: Partial<ModelConfig>) => void;
  onApiKeyDraftChange: (value: string) => void;
  onRun: () => void;
  onSaveModel: () => void;
  onTestModel: () => void;
}

export function AiPanel({
  modelDraft,
  modelConfigs,
  chatHistory,
  chatInput,
  chatStreaming,
  chatError,
  testStatus,
  apiKeyDraft,
  onChatInputChange,
  onSelectModel,
  onPatchModelDraft,
  onApiKeyDraftChange,
  onRun,
  onSaveModel,
  onTestModel,
}: AiPanelProps): JSX.Element {
  const logRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!logRef.current) {
      return;
    }
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [chatHistory, chatStreaming]);

  return (
    <section className="ai-panel">
      <div className="ai-panel-head">
        <div>
          <strong>AI Assistant</strong>
          <span>{chatStreaming ? 'Streaming response...' : 'Ready for prompts'}</span>
        </div>
        <button type="button" onClick={onRun} disabled={chatStreaming || !chatInput.trim()}>
          {chatStreaming ? 'Running...' : 'Run'}
        </button>
      </div>

      <div ref={logRef} className="ai-chat-log">
        {chatHistory.length === 0 ? <div className="ai-empty">Describe what to draw or edit.</div> : null}
        {chatHistory.map((msg, idx) => (
          <div key={`${msg.role}-${idx}`} className={`ai-msg ai-msg-${msg.role}`}>
            <div className="ai-msg-role">{msg.role === 'user' ? 'You' : 'Assistant'}</div>
            {msg.content}
          </div>
        ))}
        {chatStreaming ? <div className="ai-msg ai-msg-assistant ai-typing">Thinking...</div> : null}
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

      <details className="ai-model-settings">
        <summary>Model Settings</summary>
        <div className="ai-model-grid">
          <select value={modelDraft.id} onChange={(e) => onSelectModel(e.target.value)}>
            <option value={modelDraft.id}>{modelDraft.name || modelDraft.id}</option>
            {modelConfigs
              .filter((cfg) => cfg.id !== modelDraft.id)
              .map((cfg) => (
                <option key={cfg.id} value={cfg.id}>
                  {cfg.name}
                </option>
              ))}
          </select>

          <input
            placeholder="Base URL"
            value={modelDraft.baseUrl}
            onChange={(e) => onPatchModelDraft({ baseUrl: e.target.value })}
          />

          <input
            placeholder="Model"
            value={modelDraft.modelName}
            onChange={(e) => onPatchModelDraft({ modelName: e.target.value })}
          />

          <input
            placeholder="API Key"
            type="password"
            value={apiKeyDraft}
            onChange={(e) => onApiKeyDraftChange(e.target.value)}
          />

          <div className="ai-actions">
            <button type="button" onClick={onSaveModel}>Save</button>
            <button type="button" onClick={onTestModel}>Test</button>
          </div>

          {testStatus ? <div className="ai-status">{testStatus}</div> : null}
        </div>
      </details>

      {chatError ? <div className="ai-error">{chatError}</div> : null}
    </section>
  );
}
