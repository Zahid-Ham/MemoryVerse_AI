import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from '../store/chatStore';
import {
  Send,
  Sparkles,
  Bot,
  User,
  ArrowRight,
  BookOpen,
  HelpCircle,
  Clock,
  Trash2,
  Copy,
  Check,
  RotateCw,
  FileText
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function Chat() {
  const navigate = useNavigate();
  const {
    messages,
    suggestedFollowUps,
    addMessage,
    updateMessage,
    setSuggestedFollowUps,
    clearConversation
  } = useChatStore();

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const messagesEndRef = useRef(null);

  // Scroll to bottom when messages update
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSendMessage = async (textToSend) => {
    const question = textToSend || input;
    if (!question.trim()) return;

    // Reset input
    if (!textToSend) setInput('');

    // Append user message
    const userMsgId = Math.random().toString(36).substring(7);
    addMessage({ id: userMsgId, role: 'user', content: question });
    setIsTyping(true);

    // Placeholder assistant message for streaming
    const assistantMsgId = Math.random().toString(36).substring(7);
    addMessage({
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      citations: [],
      confidence: null,
      originalQuestion: question // save query to support regeneration
    });

    await streamResponse(question, assistantMsgId);
  };

  const streamResponse = async (question, assistantMsgId) => {
    setIsTyping(true);
    try {
      const response = await fetch(`${API_URL}/api/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question }),
      });

      if (!response.body) {
        throw new Error('Streaming failed to initiate.');
      }

      setIsTyping(false); // Remove typing indicator since streaming starts
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let buffer = '';

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          buffer += decoder.decode(value, { stream: !done });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const jsonStr = line.replace('data: ', '').trim();
                const packet = JSON.parse(jsonStr);

                if (packet.event === 'metadata') {
                  updateMessage(assistantMsgId, {
                    citations: packet.citations,
                    confidence: packet.confidence_score
                  });
                } else if (packet.event === 'token') {
                  // Find current message content to append token
                  const currentMsg = useChatStore.getState().messages.find(m => m.id === assistantMsgId);
                  const currentContent = currentMsg ? currentMsg.content : '';
                  updateMessage(assistantMsgId, {
                    content: currentContent + packet.token
                  });
                } else if (packet.event === 'suggested_follow_ups') {
                  setSuggestedFollowUps(packet.follow_ups);
                }
              } catch (e) {
                // Ignore parse errors on incomplete chunk boundaries
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Error during chat stream', err);
      setIsTyping(false);
      updateMessage(assistantMsgId, {
        content: 'I encountered an error connecting to the memory indexing service. Please try again.',
        citations: []
      });
    }
  };

  const renderMarkdown = (text) => {
    if (!text) return '';
    
    // Split by newlines
    const lines = text.split('\n');
    return lines.map((line, i) => {
      let content = line;
      
      // Parse bold **text**
      const boldRegex = /\*\*(.*?)\*\*/g;
      const parts = [];
      let lastIndex = 0;
      let match;
      
      while ((match = boldRegex.exec(content)) !== null) {
        if (match.index > lastIndex) {
          parts.push(content.substring(lastIndex, match.index));
        }
        parts.push(<strong key={match.index} className="font-bold text-foreground">{match[1]}</strong>);
        lastIndex = boldRegex.lastIndex;
      }
      
      if (lastIndex < content.length) {
        parts.push(content.substring(lastIndex));
      }
      
      const parsedContent = parts.length > 0 ? parts : content;
      
      // Parse bullet points starting with - or *
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const cleaned = line.trim().substring(2);
        const subParts = [];
        let subLast = 0;
        let subMatch;
        while ((subMatch = boldRegex.exec(cleaned)) !== null) {
          if (subMatch.index > subLast) {
            subParts.push(cleaned.substring(subLast, subMatch.index));
          }
          subParts.push(<strong key={subMatch.index} className="font-bold text-foreground">{subMatch[1]}</strong>);
          subLast = boldRegex.lastIndex;
        }
        if (subLast < cleaned.length) {
          subParts.push(cleaned.substring(subLast));
        }
        return (
          <li key={i} className="list-disc ml-5 mb-1.5 leading-relaxed text-sm">
            {subParts.length > 0 ? subParts : cleaned}
          </li>
        );
      }
      
      // Parse numbered lists like 1.
      const numListRegex = /^(\d+)\.\s(.*)/;
      const numMatch = line.trim().match(numListRegex);
      if (numMatch) {
        const cleaned = numMatch[2];
        const subParts = [];
        let subLast = 0;
        let subMatch;
        while ((subMatch = boldRegex.exec(cleaned)) !== null) {
          if (subMatch.index > subLast) {
            subParts.push(cleaned.substring(subLast, subMatch.index));
          }
          subParts.push(<strong key={subMatch.index} className="font-bold text-foreground">{subMatch[1]}</strong>);
          subLast = boldRegex.lastIndex;
        }
        if (subLast < cleaned.length) {
          subParts.push(cleaned.substring(subLast));
        }
        return (
          <li key={i} className="list-decimal ml-5 mb-1.5 leading-relaxed text-sm">
            {subParts.length > 0 ? subParts : cleaned}
          </li>
        );
      }
      
      return (
        <p key={i} className="mb-2 leading-relaxed text-sm min-h-[1rem]">
          {parsedContent}
        </p>
      );
    });
  };

  const handleRegenerate = async (msg) => {
    if (!msg.originalQuestion) return;
    setIsTyping(true);
    // Reset message content
    updateMessage(msg.id, {
      content: '',
      citations: [],
      confidence: null
    });
    await streamResponse(msg.originalQuestion, msg.id);
  };

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  // Predefined prompts (cards in empty state)
  const emptyPrompts = [
    { title: "Internships", text: "Show my internship documents." },
    { title: "Machine Learning", text: "When did I first mention machine learning?" },
    { title: "Mumbai", text: "Which documents involve Mumbai?" },
    { title: "React", text: "What project files discuss React?" }
  ];

  const isConversationEmpty = messages.length <= 1;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-5xl mx-auto p-4 md:p-6">
      
      {/* Top Header */}
      <div className="border-b border-border pb-4 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Sparkles className="w-4.5 h-4.5" />
          </div>
          <div>
            <h1 className="text-base font-bold">Memory Assistant</h1>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Connected to local ChromaDB & Llama 3
            </p>
          </div>
        </div>
        <button
          onClick={clearConversation}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-secondary text-destructive hover:bg-destructive/10 transition-all border border-border"
          title="Clear Conversation"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear conversation
        </button>
      </div>

      {/* Messages List Area */}
      <div className="flex-1 overflow-y-auto py-6 space-y-6 px-1 pr-3 scrollbar-thin" data-lenis-prevent>
        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-4 max-w-3xl ${isUser ? 'ml-auto flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 shadow-sm ${
                  isUser ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                }`}>
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4 text-primary" />}
                </div>

                {/* Bubble */}
                <div className="space-y-3 flex-1 min-w-0">
                  <div className={`relative group p-4 rounded-2xl text-sm leading-relaxed border ${
                    isUser
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-card text-foreground border-border shadow-sm'
                  }`}>
                    {msg.content === '' && !isUser ? (
                      // Shimmer typing placeholder
                      <div className="flex items-center gap-1.5 py-1">
                        <span className="w-2 h-2 bg-muted-foreground/45 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-muted-foreground/45 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-muted-foreground/45 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    ) : (
                      renderMarkdown(msg.content)
                    )}

                    {/* Copy and Regenerate overlay buttons for assistant bubble */}
                    {!isUser && msg.id !== 'welcome' && msg.content !== '' && (
                      <div className="absolute right-2.5 bottom-2.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 bg-card border border-border rounded-lg p-1 shadow-xs">
                        <button
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                          title="Copy response"
                        >
                          {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        {msg.originalQuestion && (
                          <button
                            onClick={() => handleRegenerate(msg)}
                            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                            title="Regenerate response"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Citations & Scores */}
                  {!isUser && msg.citations && msg.citations.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-2.5"
                    >
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold px-1">
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-3.5 h-3.5 text-primary" />
                          Source Citations ({msg.citations.length})
                        </span>
                        {msg.confidence !== null && (
                          <span className={`px-2 py-0.5 rounded-full ${
                            msg.confidence > 0.7 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600'
                          }`}>
                            Confidence: {Math.round(msg.confidence * 100)}%
                          </span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {msg.citations.map((cite) => (
                          <div
                            key={cite.id}
                            onClick={() => navigate(`/memories/${cite.document_id}?highlight=${encodeURIComponent(cite.text || '')}`)}
                            className="p-3.5 border border-border hover:border-primary/20 rounded-xl bg-card hover:bg-secondary/15 transition-all text-xs space-y-2.5 cursor-pointer relative group/cite shadow-xs flex flex-col justify-between"
                          >
                            <div className="space-y-2">
                              <div className="flex justify-between items-center text-[10px] text-muted-foreground font-bold">
                                <span className="flex items-center gap-1.5 truncate max-w-[130px]" title={cite.title}>
                                  <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                                  {cite.title}
                                </span>
                                <span className="shrink-0 bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider font-bold">
                                  Match {Math.round(cite.score * 100)}%
                                </span>
                              </div>
                              {cite.text && (
                                <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-3 bg-secondary/35 p-2 rounded-lg font-mono whitespace-pre-wrap select-all">
                                  {cite.text}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center justify-between pt-1 text-[9px] text-muted-foreground border-t border-border/40">
                              <span>Click to inspect source</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(cite.text || '');
                                  setCopiedId(cite.id);
                                  setTimeout(() => setCopiedId(null), 2000);
                                }}
                                className="p-1 rounded bg-secondary hover:text-foreground hover:bg-secondary/80 transition-colors flex items-center gap-1"
                                title="Copy citation text"
                              >
                                {copiedId === cite.id ? (
                                  <Check className="w-3 h-3 text-emerald-500 font-bold" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                                <span>{copiedId === cite.id ? 'Copied' : 'Copy'}</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            );
          })}

          {/* Typing Indicator */}
          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-4 max-w-lg"
            >
              <div className="w-8 h-8 rounded-full bg-secondary text-muted-foreground flex items-center justify-center text-sm shrink-0">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border flex items-center gap-1.5 shadow-sm">
                <span className="w-2 h-2 bg-muted-foreground/45 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-muted-foreground/45 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-muted-foreground/45 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state suggestion cards */}
        {isConversationEmpty && !isTyping && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-w-3xl pt-10 mx-auto">
            {emptyPrompts.map((prompt) => (
              <button
                key={prompt.text}
                onClick={() => handleSendMessage(prompt.text)}
                className="text-left p-4 rounded-xl border border-border bg-card hover:bg-secondary/20 hover:border-primary/20 transition-all flex flex-col justify-between group h-24"
              >
                <span className="text-[10px] font-bold text-primary uppercase tracking-wider">{prompt.title}</span>
                <span className="text-xs text-foreground font-semibold line-clamp-2 mt-1">{prompt.text}</span>
              </button>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Follow ups & Input Box */}
      <div className="border-t border-border pt-4 space-y-4 shrink-0 bg-background">
        
        {/* Suggested Follow ups */}
        {suggestedFollowUps.length > 0 && !isTyping && !isConversationEmpty && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1 mr-1">
              <HelpCircle className="w-3.5 h-3.5" />
              Suggested:
            </span>
            {suggestedFollowUps.map((q) => (
              <button
                key={q}
                onClick={() => handleSendMessage(q)}
                className="text-xs border border-border/80 hover:border-primary/30 hover:bg-secondary/35 text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-full transition-all flex items-center gap-1"
              >
                {q}
                <ArrowRight className="w-3 h-3 text-muted-foreground/60" />
              </button>
            ))}
          </div>
        )}

        {/* Input Bar */}
        <div className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Ask your second brain (e.g. 'Show me my Project Alpha memories')..."
            className="w-full pl-4 pr-12 py-3 bg-secondary/60 border border-border focus:border-primary focus:ring-1 focus:ring-primary rounded-xl text-sm focus:outline-none transition-all"
            disabled={isTyping}
          />
          <button
            onClick={() => handleSendMessage()}
            className="absolute right-2 p-2 bg-primary text-primary-foreground hover:bg-primary-hover rounded-lg transition-all shadow-sm disabled:opacity-50"
            disabled={!input.trim() || isTyping}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
