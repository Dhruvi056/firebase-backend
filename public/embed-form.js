(() => {
  // Minimal embeddable form handler with toast. Usage:
  // Option 1: <form data-firebase-form-endpoint="https://your-domain/api/f/<formId>">
  // Option 2: <form action="https://your-domain/api/f/<formId>">
  //   ...inputs...
  // </form>
  // <script src="/embed-form.js"></script>

  const TOAST_ID = "__firebase_form_toast__";
  const FORMS_ATTACHED = new WeakSet();

  function ensureToastContainer() {
    let t = document.getElementById(TOAST_ID);
    if (!t) {
      t = document.createElement("div");
      t.id = TOAST_ID;
      t.style.position = "fixed";
      t.style.top = "20px";
      t.style.right = "20px";
      t.style.padding = "12px 16px";
      t.style.borderRadius = "8px";
      t.style.boxShadow = "0 8px 24px rgba(0,0,0,0.15)";
      t.style.background = "#e8f5e9";
      t.style.color = "#166534";
      t.style.zIndex = "9999";
      t.style.display = "none";
      t.style.maxWidth = "320px";
      t.style.fontFamily = "Arial, sans-serif";
      t.style.fontSize = "14px";
      document.body.appendChild(t);
    }
    return t;
  }

  function showToast(msg, success) {
    const t = ensureToastContainer();
    t.textContent = msg;
    t.style.background = success ? "#e8f5e9" : "#fee2e2";
    t.style.color = success ? "#166534" : "#991b1b";
    t.style.display = "block";
    clearTimeout(t._timer);
    t._timer = setTimeout(() => {
      t.style.display = "none";
    }, 4000);
  }

  async function handleSubmit(e) {
    const form = e.target;
    // Check both data attribute and action attribute
    const endpoint = form.getAttribute("data-firebase-form-endpoint") || form.getAttribute("action");
    if (!endpoint || !endpoint.includes("/api/f/")) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    const submitBtn = form.querySelector("[type=submit]");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.dataset.originalText = submitBtn.textContent;
      submitBtn.textContent = "Submitting...";
    }

    try {
      const body = new URLSearchParams(new FormData(form)).toString();
      
      console.log(" Submitting form to:", endpoint);
      
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
        },
        body,
        credentials: "omit",
        cache: "no-cache",
      });

      console.log("Form submission response:", res.status, res.statusText);

      const json = await res.json();
      const ok = res.ok;
      showToast(ok ? json.message || json.success || "Submitted!" : json.error || json.message || "Failed", ok);
      if (ok) form.reset();
    } catch (err) {
      console.error(" Form submission error:", err);
      showToast("Network error: " + err.message, false);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = submitBtn.dataset.originalText || "Submit";
      }
    }
  }

  function attachToForm(form) {
    // Skip if already attached
    if (FORMS_ATTACHED.has(form)) return;

    const endpoint = form.getAttribute("data-firebase-form-endpoint") || form.getAttribute("action");
    // Only attach if endpoint looks like our API endpoint
    if (endpoint && endpoint.includes("/api/f/")) {
      form.addEventListener("submit", handleSubmit, { capture: true });
      FORMS_ATTACHED.add(form);
      console.log("Form handler attached to:", endpoint);
    }
  }

  function attach() {
    // Attach to all existing forms
    document.querySelectorAll("form").forEach(attachToForm);
  }

  // Watch for dynamically added forms
  function setupMutationObserver() {
    if (typeof MutationObserver === "undefined") return;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            // Check if the added node is a form
            if (node.tagName === "FORM") {
              attachToForm(node);
            }
            // Check for forms inside the added node
            if (node.querySelectorAll) {
              node.querySelectorAll("form").forEach(attachToForm);
            }
          }
        });
      });
    });

    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  // Initialize
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      attach();
      setupMutationObserver();
    });
  } else {
    attach();
    setupMutationObserver();
  }

  // Also attach immediately for forms that might already exist
  attach();
})();

