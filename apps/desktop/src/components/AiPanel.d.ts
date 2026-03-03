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
export declare function AiPanel({ chatHistory, chatInput, chatStreaming, progressEvents, chatError, onChatInputChange, onRun, }: AiPanelProps): JSX.Element;
export {};
