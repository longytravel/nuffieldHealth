"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Bot,
  X,
  Send,
  Sparkles,
  Filter,
  ArrowRight,
  Loader2,
} from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  filters?: TranslatedFilter[];
  timestamp: Date;
}

interface TranslatedFilter {
  field: string;
  operator: string;
  value: string;
}

const SUGGESTED_QUERIES = [
  "Show me all Bronze cardiologists in London",
  "What's the average score for Leeds Hospital?",
  "Which specialty has the most missing photos?",
  "Compare The Manor Hospital with Nuffield Brighton",
  "What would happen if all consultants added photos?",
  "Generate an executive summary for this month",
];

async function callCopilotApi(
  chatMessages: Message[]
): Promise<string> {
  const apiMessages = chatMessages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const res = await fetch("/api/copilot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: apiMessages }),
  });

  if (!res.ok) {
    throw new Error(`Copilot API returned ${res.status}`);
  }

  const data = await res.json();
  return data.content ?? "Sorry, I couldn't generate a response.";
}

export function AiCopilot() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  const panelRef = useRef<HTMLElement>(null);

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Focus trap when copilot is open
  useEffect(() => {
    if (!isOpen || !panelRef.current) return;

    function handleTab(e: KeyboardEvent) {
      if (e.key !== "Tab" || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleTab);
    return () => document.removeEventListener("keydown", handleTab);
  }, [isOpen]);

  async function handleSubmit(query?: string) {
    const text = query ?? input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    try {
      const content = await callCopilotApi(updatedMessages);
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error("Copilot error:", err);
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--sensai-teal)] text-[var(--bg-primary)] shadow-lg shadow-[var(--sensai-teal)]/25 transition-all duration-200 hover:scale-105 hover:shadow-xl hover:shadow-[var(--sensai-teal)]/30",
          isOpen && "pointer-events-none opacity-0"
        )}
        aria-label="Open AI Copilot (Ctrl+K)"
        title="AI Copilot (Ctrl+K)"
      >
        <Bot className="h-6 w-6" />
        {/* Pulsing teal dot */}
        <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--sensai-teal-light)] opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-[var(--sensai-teal-light)]" />
        </span>
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm transition-opacity"
          onClick={() => setIsOpen(false)}
          aria-hidden
        />
      )}

      {/* Slide-in panel */}
      <aside
        ref={panelRef}
        role="dialog"
        aria-label="AI Copilot"
        aria-modal={isOpen}
        className={cn(
          "fixed right-0 top-0 z-50 flex h-screen w-full flex-col border-l border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-2xl transition-transform duration-300 ease-in-out sm:w-[400px] sm:max-w-[90vw]",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-[var(--sensai-teal)]" />
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              SensAI Copilot
            </span>
            <span className="rounded-full bg-[var(--sensai-teal)]/15 px-2 py-0.5 text-[10px] font-medium text-[var(--sensai-teal)]">
              Beta
            </span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
            aria-label="Close AI Copilot"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-4" aria-live="polite" aria-relevant="additions">
          {messages.length === 0 ? (
            /* Empty state with suggestions */
            <div className="flex flex-col gap-4">
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--sensai-teal)]/10">
                  <Sparkles className="h-6 w-6 text-[var(--sensai-teal)]" />
                </div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Ask SensAI anything
                </h3>
                <p className="max-w-[280px] text-xs text-[var(--text-muted)]">
                  Query your consultant data in natural language. I can filter,
                  compare, and analyse profiles across all hospitals and
                  specialties.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  Try asking
                </span>
                {SUGGESTED_QUERIES.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSubmit(q)}
                    className="group flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-glass)] px-3 py-2 text-left text-xs text-[var(--text-secondary)] backdrop-blur-sm transition-all hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
                  >
                    <ArrowRight className="h-3 w-3 shrink-0 text-[var(--sensai-teal)] opacity-0 transition-opacity group-hover:opacity-100" />
                    <span className="line-clamp-1">{q}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Conversation */
            <div className="flex flex-col gap-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex flex-col gap-1.5",
                    msg.role === "user" ? "items-end" : "items-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[340px] rounded-xl px-3 py-2 text-xs leading-relaxed",
                      msg.role === "user"
                        ? "bg-[var(--sensai-teal)] text-[var(--bg-primary)]"
                        : "copilot-markdown border border-[var(--border-subtle)] bg-[var(--bg-glass)] text-[var(--text-primary)]"
                    )}
                  >
                    {msg.role === "assistant" ? (
                      <Markdown remarkPlugins={[remarkGfm]}>{msg.content}</Markdown>
                    ) : (
                      msg.content
                    )}
                  </div>

                  {/* Filter translation display */}
                  {msg.filters && msg.filters.length > 0 && (
                    <div className="flex max-w-[320px] flex-col gap-1 rounded-lg border border-[var(--sensai-teal)]/20 bg-[var(--sensai-teal)]/5 px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <Filter className="h-3 w-3 text-[var(--sensai-teal)]" />
                        <span className="text-[10px] font-medium text-[var(--sensai-teal)]">
                          Translated Filters
                        </span>
                      </div>
                      {msg.filters.map((f, i) => (
                        <span
                          key={i}
                          className="text-[10px] text-[var(--text-secondary)]"
                        >
                          {f.field} {f.operator} &quot;{f.value}&quot;
                        </span>
                      ))}
                      <button className="mt-1 flex items-center gap-1 text-[10px] font-medium text-[var(--sensai-teal)] transition-colors hover:text-[var(--sensai-teal-light)]">
                        Apply filters
                        <ArrowRight className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex items-start gap-2">
                  <div className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-glass)] px-3 py-2">
                    <Loader2 className="h-3 w-3 animate-spin text-[var(--sensai-teal)]" />
                    <span className="text-xs text-[var(--text-muted)]">
                      Analysing data...
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-[var(--border-subtle)] px-4 py-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask SensAI anything..."
              aria-label="Ask SensAI a question"
              className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--sensai-teal)] focus:outline-none focus:ring-1 focus:ring-[var(--sensai-teal)]/30"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--sensai-teal)] text-[var(--bg-primary)] transition-all hover:bg-[var(--sensai-teal-light)] disabled:opacity-40 disabled:hover:bg-[var(--sensai-teal)]"
              aria-label="Send message"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
          <p className="mt-1.5 text-center text-[9px] text-[var(--text-muted)]">
            Ctrl+K to toggle &middot; Esc to close
          </p>
        </div>
      </aside>
    </>
  );
}
