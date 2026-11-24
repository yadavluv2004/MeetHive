import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

const ToastContext = createContext({ toast: () => {} });

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    const counter = useRef(0);

    const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

    const toast = useCallback(
        (message, { type = "info", duration = 3500 } = {}) => {
            const id = ++counter.current;
            setToasts((t) => [...t.slice(-3), { id, message, type }]);
            setTimeout(() => dismiss(id), duration);
        },
        [dismiss]
    );

    const value = useMemo(() => ({ toast }), [toast]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div className="toast-stack" role="status" aria-live="polite">
                {toasts.map((t) => (
                    <div key={t.id} className={`toast toast-${t.type}`} onClick={() => dismiss(t.id)}>
                        {t.message}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = () => useContext(ToastContext).toast;
