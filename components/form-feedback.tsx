"use client";

import { useEffect, useState } from "react";

const FLASH_KEY = "slop-cannon-flash";

export function FormFeedback() {
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    const storedFlash = window.sessionStorage.getItem(FLASH_KEY);
    if (storedFlash) {
      setToast(storedFlash);
      window.sessionStorage.removeItem(FLASH_KEY);
    }

    function handleToast(event: Event) {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      setToast(detail?.message ?? "Successfully saved");
    }

    function handleSubmit(event: SubmitEvent) {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;

      const successMessage = form.dataset.successMessage;

      if (successMessage) {
        window.sessionStorage.setItem(FLASH_KEY, successMessage);
      }
    }

    window.addEventListener("slop-cannon:toast", handleToast);
    document.addEventListener("submit", handleSubmit, true);
    return () => {
      window.removeEventListener("slop-cannon:toast", handleToast);
      document.removeEventListener("submit", handleSubmit, true);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  return (
    <>
      {toast ? <div className="toast">{toast}</div> : null}
      {loading ? (
        <div className="modal-backdrop" role="status" aria-live="polite">
          <div className="modal">
            <div className="spinner" aria-hidden="true" />
            <strong>{loading}</strong>
          </div>
        </div>
      ) : null}
    </>
  );
}
