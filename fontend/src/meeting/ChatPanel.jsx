import { Fragment, useEffect, useRef, useState } from "react";
import SendIcon from "@mui/icons-material/Send";
import CloseIcon from "@mui/icons-material/Close";
import { formatTime } from "../utils/format";

const URL_RE = /(https?:\/\/[^\s]+)/g;

const Linkified = ({ text }) =>
    text.split(URL_RE).map((part, i) =>
        i % 2 === 1 ? (
            <a key={i} href={part} target="_blank" rel="noopener noreferrer">
                {part}
            </a>
        ) : (
            <Fragment key={i}>{part}</Fragment>
        )
    );

export default function ChatPanel({ messages, selfId, onSend, onClose }) {
    const [text, setText] = useState("");
    const listRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    useEffect(() => {
        const el = listRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [messages.length]);

    const submit = (e) => {
        e?.preventDefault();
        if (onSend(text)) setText("");
    };

    return (
        <aside className="side-panel" aria-label="In-call messages">
            <header className="panel-head">
                <h3>In-call messages</h3>
                <button className="icon-btn" onClick={onClose} aria-label="Close chat">
                    <CloseIcon />
                </button>
            </header>
            <div className="panel-note">Messages are visible to everyone in the call and are deleted when the call ends.</div>

            <div className="chat-list" ref={listRef}>
                {messages.length === 0 ? (
                    <div className="chat-empty">No messages yet. Say hi 👋</div>
                ) : (
                    messages.map((m, i) => {
                        const mine = m.from === selfId;
                        const grouped = i > 0 && messages[i - 1].from === m.from && m.ts - messages[i - 1].ts < 60_000;
                        return (
                            <div key={m.id} className={`chat-msg ${mine ? "mine" : ""} ${grouped ? "grouped" : ""}`}>
                                {!grouped && (
                                    <div className="chat-meta">
                                        <b>{mine ? "You" : m.name}</b>
                                        <span>{formatTime(m.ts)}</span>
                                    </div>
                                )}
                                <div className="chat-bubble">
                                    <Linkified text={m.text} />
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <form className="chat-input" onSubmit={submit}>
                <textarea
                    ref={inputRef}
                    rows={1}
                    value={text}
                    maxLength={1000}
                    placeholder="Send a message"
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            submit();
                        }
                    }}
                />
                <button type="submit" className="icon-btn send-btn" disabled={!text.trim()} aria-label="Send message">
                    <SendIcon fontSize="small" />
                </button>
            </form>
        </aside>
    );
}
