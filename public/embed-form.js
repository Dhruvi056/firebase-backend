(() => {
  // Minimal embeddable form handler with toast. Usage:
  // Option 1: <form data-firebase-form-endpoint="https://your-domain/api/f/<formId>">
  // Option 2: <form action="https://your-domain/api/f/<formId>">
  //   ...inputs...
  // </form>
  // <script src="/embed-form.js"></script>

  const TOAST_ID = "__firebase_form_toast__";

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
    if (!endpoint) {
      console.log("[Firebase Form] No endpoint found, skipping");
      return; // Not our form
    }

    // CRITICAL: Prevent default form submission (no navigation)
    e.preventDefault();
    e.stopPropagation();
    
    console.log("[Firebase Form] Submitting to:", endpoint);
    
    const submitBtn = form.querySelector("[type=submit]");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.dataset.originalText = submitBtn.textContent;
      submitBtn.textContent = "Submitting...";
    }

    try {
      const formData = new FormData(form);
      const body = new URLSearchParams(formData).toString();
      
      console.log("[Firebase Form] Request body:", body);
      
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json", // Request JSON to prevent HTML response
        },
        body,
      });
      
      console.log("[Firebase Form] Response status:", res.status);
      console.log("[Firebase Form] Response headers:", res.headers);
      
      if (!res.ok) {
        // Try to get error message
        let errorMsg = `Server error: ${res.status}`;
        try {
          const errorJson = await res.json();
          errorMsg = errorJson.error || errorJson.message || errorMsg;
        } catch(e) {
          const text = await res.text();
          errorMsg = text || errorMsg;
        }
        showToast(errorMsg, false);
        return;
      }
      
      const json = await res.json();
      console.log("[Firebase Form] Response JSON:", json);
      
      // Show toast message
      const message = json.message || json.success ? "Form submitted successfully!" : (json.error || "Failed");
      showToast(message, json.success !== false);
      
      // Reset form after successful submission
      if (json.success !== false) {
        form.reset();
        // Reset all form fields including checkboxes and radio buttons
        form.querySelectorAll("input[type=checkbox], input[type=radio]").forEach(input => {
          input.checked = false;
        });
        form.querySelectorAll("select").forEach(select => {
          select.selectedIndex = 0;
        });
      }
    } catch (err) {
      console.error("[Firebase Form] Error:", err);
      showToast("Network error: " + err.message, false);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = submitBtn.dataset.originalText || "Submit";
      }
    }
  }

  function attach() {
    // Attach to forms with either data-firebase-form-endpoint or action attribute
    const forms = document.querySelectorAll("form[data-firebase-form-endpoint], form[action]");
    console.log("[Firebase Form] Found", forms.length, "forms");
    
    forms.forEach((form) => {
      const endpoint = form.getAttribute("data-firebase-form-endpoint") || form.getAttribute("action");
      console.log("[Firebase Form] Checking form with endpoint:", endpoint);
      
      // Only attach if endpoint looks like our API endpoint
      if (endpoint && endpoint.includes("/api/f/")) {
        // Remove any existing listeners to prevent duplicates
        form.removeEventListener("submit", handleSubmit);
        // Add our handler
        form.addEventListener("submit", handleSubmit, { capture: true });
        // Also prevent default on form element
        form.setAttribute("data-firebase-handled", "true");
        console.log("[Firebase Form] Attached handler to form");
      } else {
        console.log("[Firebase Form] Skipping form - endpoint doesn't match /api/f/");
      }
    });
  }
  
  // Also handle dynamically added forms
  const observer = new MutationObserver(() => {
    attach();
  });
  
  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Run now and on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attach);
  } else {
    attach();
  }
})();

