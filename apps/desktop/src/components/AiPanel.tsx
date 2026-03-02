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
  return (
    <section className="ai-panel">
      <div className="ai-panel-head">AI Assistant</div>

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

      <div className="ai-chat-log">
        {chatHistory.length === 0 ? <div className="ai-empty">Describe what to draw or edit.</div> : null}
        {chatHistory.map((msg, idx) => (
          <div key={`${msg.role}-${idx}`} className={`ai-msg ai-msg-${msg.role}`}>
            {msg.content}
          </div>
        ))}
      </div>

      <div className="ai-chat-input-row">
        <textarea
          value={chatInput}
          onChange={(e) => onChatInputChange(e.target.value)}
          placeholder="Create a simple landing hero with title and button"
          className="ai-chat-input"
        />
        <button type="button" onClick={onRun} disabled={chatStreaming}>
          {chatStreaming ? 'Running...' : 'Run'}
        </button>
      </div>

      {chatError ? <div className="ai-error">{chatError}</div> : null}
    </section>
  );
}
