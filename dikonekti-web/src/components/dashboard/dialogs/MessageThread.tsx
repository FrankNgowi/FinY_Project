"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSingleFlight } from "@/hooks/useSingleFlight";
import useSWR from "swr";
import { apiFetch, swrFetcher } from "@/lib/api-client";
import { fullName } from "@/lib/format";
import type { ChatMessage, UserProfile } from "@/lib/types";
import { POLL_INTERVAL_MS } from "../hooks/useDashboardData";

export function MessageThread({ patient, currentUsername, onBack }: { patient: UserProfile; currentUsername: string; onBack: () => void }) {
  const key = `messages/?patient=${encodeURIComponent(patient.username)}`;
  const { data, error, mutate } = useSWR(key, swrFetcher<ChatMessage[]>, {
    refreshInterval: POLL_INTERVAL_MS,
    refreshWhenHidden: false,
  });
  const [draft, setDraft] = useState("");
  const { pending: sending, run } = useSingleFlight();
  const [sendError, setSendError] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const messages = useMemo(
    () => [...(data ?? [])].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
    [data],
  );

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setSendError(null);
    const result = await run(async () => {
      const sent = await apiFetch<ChatMessage>("messages/", { method: "POST", body: { body, recipient_username: patient.username } });
      await mutate((current) => [...(current ?? []), sent], { revalidate: false });
    });
    if (!result) return;
    if (result.ok) setDraft("");
    else setSendError(result.error instanceof Error ? result.error.message : "Please try again.");
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} className="rounded-lg px-2 py-1 text-sm font-medium text-steel hover:bg-page">
          ← Back
        </button>
        <p className="font-bold break-words">{fullName(patient)}</p>
      </div>

      {error && !data ? (
        <p role="alert" className="rounded-xl bg-warn-soft p-4 text-sm text-orange-900">
          Could not load messages. {error instanceof Error ? error.message : ""}
        </p>
      ) : data === undefined ? (
        <p role="status" className="py-6 text-center text-muted">
          Loading messages…
        </p>
      ) : messages.length === 0 ? (
        <p className="py-6 text-center text-muted">No messages yet. Say hello.</p>
      ) : (
        <ul ref={listRef} aria-label="Conversation" className="flex max-h-72 flex-col gap-2 overflow-y-auto">
          {messages.map((m) => {
            const mine = m.sender_username === currentUsername;
            return (
              <li
                key={m.id}
                data-mine={mine}
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm break-words ${
                  mine ? "self-end bg-navy text-white" : "self-start bg-page text-ink"
                }`}
              >
                {m.body}
              </li>
            );
          })}
        </ul>
      )}

      {sendError && (
        <p role="alert" className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-orange-900">
          {sendError}
        </p>
      )}

      <form onSubmit={send} className="flex flex-col gap-2">
        <label htmlFor="message-draft" className="text-sm font-medium">
          Message
        </label>
        <textarea
          id="message-draft"
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="rounded-xl border border-line px-3 py-2 text-base"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="self-end rounded-xl bg-navy px-5 py-2 font-semibold text-white hover:bg-steel disabled:opacity-60"
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </form>
    </div>
  );
}
