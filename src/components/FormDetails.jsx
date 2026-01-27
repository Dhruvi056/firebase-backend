import { useState, useEffect, useCallback } from "react";
import { db } from "../firebase";
import { collection, query, onSnapshot, orderBy, doc, getDoc, updateDoc } from "firebase/firestore";

export default function FormDetails({ form }) {
  const [submissions, setSubmissions] = useState([]);
  const [copied, setCopied] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [customEmail, setCustomEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  
const loadCustomEmail = useCallback(async () => {
  try {
    if (!form?.formId) return;

    const formDocRef = doc(db, "forms", form.formId);
    const formDoc = await getDoc(formDocRef);

    if (formDoc.exists()) {
      const formData = formDoc.data();
      setCustomEmail(formData.notificationEmail || "");
    }
  } catch (error) {
    console.error("Error loading custom email:", error);
  }
}, [form?.formId]);

useEffect(() => {
  loadCustomEmail();
}, [loadCustomEmail]);


  const saveCustomEmail = async () => {
    if (!form?.formId) return;

    setEmailLoading(true);

    try {
      const formDocRef = doc(db, 'forms', form.formId);
      await updateDoc(formDocRef, {
        notificationEmail: customEmail
      });

      setEmailSaved(true);
      setTimeout(() => setEmailSaved(false), 2000);
      setShowEmailModal(false);
    } catch (error) {
      console.error('Error saving custom email:', error);
    } finally {
      setEmailLoading(false);
    }
  };

  const openEmailModal = () => {
    loadCustomEmail(); // Reload current email when opening modal
    setShowEmailModal(true);
  };

  useEffect(() => {
    if (!form) return;

    console.log("FormDetails: Loading submissions for formId:", form.formId);
    const ref = collection(db, `forms/${form.formId}/submissions`);

    let q;
    try {
      q = query(ref, orderBy("submittedAt", "desc"));
    } catch (error) {
      console.warn("Could not order by submittedAt, using default order:", error);
      q = query(ref);
    }

    const unsub = onSnapshot(
      q,
      (snap) => {
        console.log(`FormDetails: Received ${snap.docs.length} submissions`);
        const list = snap.docs.map((doc) => {
          const data = doc.data();
          console.log("Submission data:", { id: doc.id, data });
          // Format date in Indian Standard Time (IST)
          let formattedDate = "N/A";
          if (data.submittedAt?.toDate) {
            const date = data.submittedAt.toDate();
            formattedDate = date.toLocaleString("en-IN", {
              timeZone: "Asia/Kolkata",
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: true,
            });
          } else if (data.submittedAt) {
            formattedDate = data.submittedAt;
          }

          return {
            id: doc.id,
            ...data,
            submittedAt: formattedDate,
          };
        });
        setSubmissions(list);
      },
      (error) => {
        console.error("FormDetails: Error fetching submissions:", error);
        setSubmissions([]);
      }
    );

    return () => unsub();
  }, [form]);

  if (!form) {
    return (
      <section className="flex-1 h-full flex items-center justify-center">
        <h1>Select a form</h1>
      </section>
    );
  }

  const allFields = new Set();
  submissions.forEach((s) => {
    Object.keys(s.data || {}).forEach((f) => allFields.add(f));
  });

  const fields = Array.from(allFields).filter((f) => f !== "_gotcha");

  return (
    <section className="flex-1 h-full bg-white rounded-xl border overflow-hidden flex flex-col">
      <div className="p-6 border-b flex-shrink-0">
        <h1 className="text-2xl font-semibold">{form.name}</h1>
        <div className="mt-2 flex items-center gap-2">
          <p className="text-blue-600 break-all">{form.url}</p>
          <button
            onClick={() => copyToClipboard(form.url)}
            className="p-2 hover:bg-blue-50 rounded-lg transition-all duration-200 border border-transparent hover:border-blue-200 group"
            title={copied ? "Copied!" : "Copy URL"}
            aria-label="Copy URL"
          >
            {copied ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-green-600 animate-pulse"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-blue-600 group-hover:text-blue-700 transition-colors"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>

          {/* Notification Email Icon */}
          <button
            onClick={openEmailModal}
            className="ml-40 p-2 hover:bg-gray-100 rounded-lg transition-all duration-200 border border-transparent hover:border-gray-300 group"
            title="Set notification email"
            aria-label="Set notification email"
          >

            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-gray-600 group-hover:text-gray-800 transition-colors"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </button>

        </div>

        {/* Notification Email Modal */}
        {showEmailModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Notification Email</h3>
                <button
                  onClick={() => setShowEmailModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  placeholder="Enter email for notifications"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  You will receive an email notification whenever someone submits this form.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowEmailModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={saveCustomEmail}
                  disabled={emailLoading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {emailLoading ? 'Saving...' : 'Save'}
                </button>
              </div>

              {emailSaved && (
                <div className="mt-3 text-sm text-green-600 flex items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 mr-1"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Email saved successfully!
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden p-6">
        <h2 className="text-xl font-semibold mb-4 flex-shrink-0">
          Submissions {submissions.length > 0 && <span className="text-sm font-normal text-gray-500">({submissions.length})</span>}
        </h2>

        {submissions.length === 0 ? (
          <div className="flex-shrink-0">
            <p className="text-gray-600">No submissions yet...</p>
            <p className="text-sm text-gray-500 mt-2">
              Submit a form using the endpoint above to see data here.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto border rounded-lg" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 #f1f5f9' }}>
            <style>{`
              div::-webkit-scrollbar {
                width: 8px;
                height: 8px;
              }
              div::-webkit-scrollbar-track {
                background: #f1f5f9;
                border-radius: 4px;
              }
              div::-webkit-scrollbar-thumb {
                background: #cbd5e1;
                border-radius: 4px;
              }
              div::-webkit-scrollbar-thumb:hover {
                background: #94a3b8;
              }
            `}</style>
            <table className="w-full">
              <thead className="bg-gray-100 sticky top-0 z-10">
                <tr>
                  {fields.map((f) => (
                    <th key={f} className="px-4 py-2 text-left text-sm font-semibold text-gray-700">{f}</th>
                  ))}
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Date</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((sub) => (
                  <tr key={sub.id} className="border-t hover:bg-gray-50">
                    {fields.map((f) => {
                      const value = sub.data?.[f];
                      let displayValue = "-";
                      if (value !== undefined && value !== null && value !== "") {
                        if (Array.isArray(value)) {
                          displayValue = value.join(", ");
                        } else if (typeof value === "object") {
                          displayValue = JSON.stringify(value);
                        } else {
                          displayValue = String(value);
                        }
                      }
                      return (
                        <td key={f} className="px-4 py-2 text-sm">{displayValue}</td>
                      );
                    })}
                    <td className="px-4 py-2 text-gray-500 text-sm">{sub.submittedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}