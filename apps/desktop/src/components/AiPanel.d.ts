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
export declare function AiPanel({ modelDraft, modelConfigs, chatHistory, chatInput, chatStreaming, chatError, testStatus, apiKeyDraft, onChatInputChange, onSelectModel, onPatchModelDraft, onApiKeyDraftChange, onRun, onSaveModel, onTestModel, }: AiPanelProps): JSX.Element;
export {};
