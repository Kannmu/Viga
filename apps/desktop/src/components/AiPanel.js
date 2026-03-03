import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from 'react';
export function AiPanel({ chatHistory, chatInput, chatStreaming, progressEvents, chatError, onChatInputChange, onRun, }) {
    const logRef = useRef(null);
    useEffect(() => {
        if (!logRef.current) {
            return;
        }
        logRef.current.scrollTop = logRef.current.scrollHeight;
    }, [chatHistory, chatStreaming, progressEvents]);
    const formatJsonLine = (raw) => {
        try {
            return JSON.stringify(JSON.parse(raw));
        }
        catch {
            return raw;
        }
    };
    return (_jsxs("section", { className: "ai-panel", children: [_jsx("div", { className: "ai-panel-head", children: _jsxs("div", { children: [_jsx("strong", { children: "AI Assistant" }), _jsx("span", { children: chatStreaming ? 'Streaming response...' : 'Ready for prompts' })] }) }), _jsxs("div", { ref: logRef, className: "ai-chat-log", children: [chatHistory.length === 0 ? _jsx("div", { className: "ai-empty", children: "Describe what to draw or edit." }) : null, chatHistory.map((msg, idx) => (_jsxs("div", { className: `ai-msg ai-msg-${msg.role}`, children: [_jsx("div", { className: "ai-msg-role", children: msg.role === 'user' ? 'You' : 'Assistant' }), msg.content] }, `${msg.role}-${idx}`))), chatStreaming ? (_jsxs("div", { className: "ai-msg ai-msg-assistant ai-live-stream", children: [_jsx("div", { className: "ai-msg-role", children: "Assistant" }), progressEvents.length === 0 ? _jsx("div", { className: "ai-typing", children: "Thinking..." }) : null, progressEvents.map((event, idx) => {
                                if (event.type === 'status') {
                                    return _jsxs("div", { className: "ai-stream-line ai-stream-status", children: ["[status] ", event.message] }, `status-${idx}`);
                                }
                                if (event.type === 'reasoning') {
                                    return _jsxs("div", { className: "ai-stream-line ai-stream-reasoning", children: ["[reasoning] ", event.content] }, `reasoning-${idx}`);
                                }
                                if (event.type === 'assistant') {
                                    return _jsxs("div", { className: "ai-stream-line ai-stream-assistant", children: ["[assistant] ", event.content] }, `assistant-${idx}`);
                                }
                                if (event.type === 'done') {
                                    return _jsxs("div", { className: "ai-stream-line ai-stream-done", children: ["[done] ", event.finalMessage || 'Completed'] }, `done-${idx}`);
                                }
                                if (event.type === 'tool-call') {
                                    return (_jsxs("div", { className: "ai-stream-line ai-stream-tool-call", children: ["[tool-call] ", event.name, " args=", formatJsonLine(event.arguments)] }, `call-${event.id}-${idx}`));
                                }
                                return (_jsxs("div", { className: "ai-stream-line ai-stream-tool-result", children: ["[tool-result] ", event.name, " output=", formatJsonLine(event.output)] }, `result-${event.id}-${idx}`));
                            })] })) : null, !chatStreaming && progressEvents.length > 0 ? (_jsxs("div", { className: "ai-msg ai-msg-assistant ai-live-stream ai-live-stream-complete", children: [_jsx("div", { className: "ai-msg-role", children: "Last Run Trace" }), progressEvents.map((event, idx) => {
                                if (event.type === 'status') {
                                    return _jsxs("div", { className: "ai-stream-line ai-stream-status", children: ["[status] ", event.message] }, `hist-status-${idx}`);
                                }
                                if (event.type === 'reasoning') {
                                    return _jsxs("div", { className: "ai-stream-line ai-stream-reasoning", children: ["[reasoning] ", event.content] }, `hist-reasoning-${idx}`);
                                }
                                if (event.type === 'assistant') {
                                    return _jsxs("div", { className: "ai-stream-line ai-stream-assistant", children: ["[assistant] ", event.content] }, `hist-assistant-${idx}`);
                                }
                                if (event.type === 'done') {
                                    return _jsxs("div", { className: "ai-stream-line ai-stream-done", children: ["[done] ", event.finalMessage || 'Completed'] }, `hist-done-${idx}`);
                                }
                                if (event.type === 'tool-call') {
                                    return (_jsxs("div", { className: "ai-stream-line ai-stream-tool-call", children: ["[tool-call] ", event.name, " args=", formatJsonLine(event.arguments)] }, `hist-call-${event.id}-${idx}`));
                                }
                                return (_jsxs("div", { className: "ai-stream-line ai-stream-tool-result", children: ["[tool-result] ", event.name, " output=", formatJsonLine(event.output)] }, `hist-result-${event.id}-${idx}`));
                            })] })) : null] }), _jsxs("div", { className: "ai-chat-input-row", children: [_jsx("textarea", { value: chatInput, onChange: (e) => onChatInputChange(e.target.value), onKeyDown: (e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                onRun();
                            }
                        }, placeholder: "Create a simple landing hero with title and button", className: "ai-chat-input" }), _jsx("button", { type: "button", onClick: onRun, disabled: chatStreaming || !chatInput.trim(), children: chatStreaming ? 'Running...' : 'Run' })] }), chatError ? _jsx("div", { className: "ai-error", children: chatError }) : null] }));
}
//# sourceMappingURL=AiPanel.js.map