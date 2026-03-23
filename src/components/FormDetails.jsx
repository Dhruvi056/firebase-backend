import { useState, useEffect, useCallback } from "react";
import { db } from "../firebase";
import { collection, query, onSnapshot, doc, getDoc, updateDoc } from "firebase/firestore";

function isFileField(fieldName, value) {
  if (!value || typeof value !== "string") return false;

  const lowerField = (fieldName || "").toLowerCase();
  const lowerValue = value.toLowerCase();

  const looksLikeFileField =
    lowerField.includes("file") ||
    lowerField.includes("attachment") ||
    lowerField.includes("resume") ||
    lowerField.includes("document");

  const looksLikeUrl = lowerValue.startsWith("http://") || lowerValue.startsWith("https://");

  const looksLikeFileExtension = /\.(pdf|doc|docx|xls|xlsx|csv|txt|png|jpe?g|gif|zip|rar|webp)$/i.test(
    value
  );

  return looksLikeFileField || looksLikeUrl || looksLikeFileExtension;
}

export default function FormDetails({ form }) {
  const [submissions, setSubmissions] = useState([]);
  const [copied, setCopied] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [customEmail, setCustomEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);
  const [viewingSubmission, setViewingSubmission] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

    const ref = collection(db, `forms/${form.formId}/submissions`);

    // Removed orderBy to avoid missing index errors that cause empty results
    const q = query(ref);

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((doc) => {
          const data = doc.data();
          
          // Filter out soft-deleted submissions
          if (data.isDeleted) return null;

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
            _rawSubmittedAt: data.submittedAt // Keep for sorting if needed
          };
        }).filter(Boolean); // Remove nulls (deleted items)
        
        // Manual sort by date since we removed it from the query
        list.sort((a, b) => {
          const dateA = a._rawSubmittedAt?.toDate ? a._rawSubmittedAt.toDate() : new Date(a._rawSubmittedAt || 0);
          const dateB = b._rawSubmittedAt?.toDate ? b._rawSubmittedAt.toDate() : new Date(b._rawSubmittedAt || 0);
          return dateB - dateA;
        });

        setSubmissions(list);
      },
      (error) => {
        console.error("FormDetails: Error fetching submissions:", error);
        // Fallback to empty only if it's a serious error, but log it
        setSubmissions([]);
      }
    );
    return () => unsub();
  }, [form]);

  const confirmDelete = async () => {
    if (!deleteId || !form?.formId) return;
    setIsDeleting(true);
    try {
      const docRef = doc(db, `forms/${form.formId}/submissions`, deleteId);
      await updateDoc(docRef, { 
        isDeleted: true,
        deletedAt: new Date()
      });
      setDeleteId(null);
    } catch (error) {
      console.error("Delete error:", error);
      alert("Failed to delete submission");
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper component to render Lucide icons safely in React
  const LucideIcon = ({ name, className = "", style = {} }) => {
    useEffect(() => {
      if (window.lucide) {
        window.lucide.createIcons();
      }
    }, [name]);
    
    return (
      <span 
        className={`d-inline-flex align-items-center justify-content-center ${className}`}
        style={style}
        dangerouslySetInnerHTML={{ __html: `<i data-lucide="${name}"></i>` }}
      />
    );
  };

  if (!form) {
    return (
      <section className="flex-1 h-full flex items-center justify-center py-5">
        <div className="text-center">
          <LucideIcon name="inbox" className="text-secondary opacity-25 mb-4" style={{ width: '64px', height: '64px' }} />
          <h4 className="text-secondary">Select a form to view submissions</h4>
        </div>
      </section>
    );
  }

  const allFields = new Set();
  const metaFields = ["id", "submittedAt", "folderId", "vendorId", "userId", "_rawSubmittedAt", "data"];
  
  submissions.forEach((s) => {
    // Collect from sub-object 'data' if it exists
    if (s.data && typeof s.data === 'object') {
      Object.keys(s.data).forEach((f) => allFields.add(f));
    }
    // Also collect from top level, excluding meta fields
    Object.keys(s).forEach((f) => {
      if (!metaFields.includes(f)) {
        allFields.add(f);
      }
    });
  });

  const fields = Array.from(allFields).filter((f) => f !== "_gotcha");

  return (
    <div className="row h-100 flex-column overflow-hidden">
      <div className="col-md-12 mb-4 flex-shrink-0">
        <div className="card shadow-sm border-0">
          <div className="card-body d-flex justify-content-between align-items-center">
            <div>
              <h4 className="card-title mb-1 fw-bold">{form.name}</h4>
              <div className="d-flex align-items-center">
                 <p className="text-primary mb-0 me-2 text-truncate d-inline-block" style={{ maxWidth: '300px' }}>{form.url}</p>
                 <button
                  onClick={() => copyToClipboard(form.url)}
                  className="btn btn-link link-primary p-1 ms-1 text-decoration-none"
                  title={copied ? "Copied!" : "Copy URL"}
                  style={{ borderRadius: '4px' }}
                >
                  <LucideIcon name={copied ? "check" : "copy"} className="icon-sm" />
                  {copied ? <span className="ms-1 fs-12px fw-medium">Copied</span> : ""}
                </button>
              </div>
            </div>
            <div>
              <button
                onClick={openEmailModal}
                className="btn btn-outline-secondary btn-icon-text d-flex align-items-center"
                title="Set notification email"
              >
                <LucideIcon name="mail" className="icon-sm me-2" />
                <span>Notification Email</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="col-md-12 flex-grow-1 overflow-hidden d-flex flex-column">
        <div className="card shadow-sm border-0 flex-grow-1 overflow-hidden">
          <div className="card-body d-flex flex-column h-100">
            <h6 className="card-title mb-4">
              Submissions {submissions.length > 0 && <span className="text-secondary fw-normal">({submissions.length})</span>}
            </h6>

            {submissions.length === 0 ? (
              <div className="text-center py-5">
                <LucideIcon name="inbox" className="text-secondary mb-3 opacity-25" style={{ width: '64px', height: '64px' }} />
                <h5 className="text-secondary">No submissions yet...</h5>
                <p className="text-muted small">Submit a form using the endpoint above to see data here.</p>
              </div>
            ) : (
              <div className="table-responsive flex-grow-1 overflow-auto">
                <table className="table table-hover mb-0 align-middle">
                  <thead className="bg-body-tertiary sticky-top" style={{ zIndex: 10 }}>
                    <tr className="border-bottom">
                      {fields.map((f) => (
                        <th key={f} className="text-uppercase fs-11px fw-bold text-secondary border-0">{f}</th>
                      ))}
                      <th className="text-uppercase fs-11px fw-bold text-secondary border-0">Date</th>
                      <th className="text-uppercase fs-11px fw-bold text-secondary border-0 text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map((sub) => (
                      <tr key={sub.id}>
                        {fields.map((f) => {
                          // Check top level first, then nested data
                          const value = sub[f] !== undefined ? sub[f] : sub.data?.[f];
                          let cellContent = <span className="text-muted opacity-25">-</span>;

                          if (value !== undefined && value !== null && value !== "") {
                            if (Array.isArray(value)) {
                              cellContent = value.join(", ");
                            } else if (typeof value === "object") {
                              cellContent = <code className="fs-12px text-truncate d-inline-block w-100px">{JSON.stringify(value)}</code>;
                            } else {
                              const stringValue = String(value);
                              if (isFileField(f, stringValue)) {
                                const fileName = stringValue.split("/").pop() || stringValue;
                                cellContent = (
                                  <a href={stringValue} target="_blank" rel="noopener noreferrer" className="btn btn-link p-0 text-primary text-decoration-none fs-13px d-flex align-items-center">
                                    <LucideIcon name="file-text" className="icon-sm me-1" />
                                    <span className="text-truncate d-inline-block w-100px">{fileName}</span>
                                  </a>
                                );
                              } else {
                                cellContent = <span className="fs-13px">{stringValue}</span>;
                              }
                            }
                          }
                          return <td key={f} className="align-middle">{cellContent}</td>;
                        })}
                        <td className="align-middle text-secondary fs-12px">{sub.submittedAt}</td>
                        <td className="align-middle text-end">
                          <button 
                            className="btn btn-icon btn-xs dropdown-toggle-after-none" 
                            style={{ color: '#05b6d3', background: 'rgba(5, 182, 211, 0.1)', border: 'none', padding: '6px' }}
                            onClick={() => setViewingSubmission(sub)}
                            title="View Details"
                          >
                            <LucideIcon name="eye" className="icon-sm" />
                          </button>
                          <button 
                            className="btn btn-icon btn-xs ms-2" 
                            style={{ color: '#ff3366', background: 'rgba(255, 51, 102, 0.1)', border: 'none', padding: '6px' }}
                            onClick={() => setDeleteId(sub.id)}
                            title="Delete Submission"
                          >
                            <LucideIcon name="trash-2" className="icon-sm" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Notification Email Modal (Restructured for Bootstrap) */}
      {showEmailModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header">
                <h5 className="modal-title">Notification Email</h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={() => setShowEmailModal(false)}></button>
              </div>
              <div className="modal-body p-4">
                <div className="mb-3">
                  <label className="form-label fw-bold">Email Address</label>
                  <input
                    type="email"
                    className="form-control"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    placeholder="Enter email for notifications"
                  />
                  <div className="form-text mt-2 fs-12px">
                    You will receive an email notification whenever someone submits this form.
                  </div>
                </div>

                {emailSaved && (
                  <div className="alert alert-success d-flex align-items-center py-2" role="alert">
                    <LucideIcon name="check-circle" className="icon-sm me-2" />
                    <div>Email saved successfully!</div>
                  </div>
                )}
              </div>
              <div className="modal-footer border-top-0 pt-0">
                <button type="button" className="btn btn-link text-secondary text-decoration-none me-2" onClick={() => setShowEmailModal(false)}>Cancel</button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={saveCustomEmail}
                  disabled={emailLoading}
                >
                  {emailLoading ? <span className="spinner-border spinner-border-sm me-2"></span> : null}
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Submission Details Modal */}
      {viewingSubmission && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow">
              <div className="modal-header">
                <h5 className="modal-title">Submission Details</h5>
                <button type="button" className="btn-close" onClick={() => setViewingSubmission(null)}></button>
              </div>
              <div className="modal-body p-4">
                <div className="row">
                  <div className="col-12 mb-3 text-center border-bottom pb-3">
                    <p className="text-muted small mb-1">Submitted At (IST)</p>
                    <p className="fw-bold mb-0">{viewingSubmission.submittedAt}</p>
                  </div>
                  {fields.map(f => {
                    const val = viewingSubmission[f] !== undefined ? viewingSubmission[f] : viewingSubmission.data?.[f];
                    if (val === undefined || val === null || val === "") return null;
                    
                    return (
                      <div className="col-md-6 mb-4" key={f}>
                        <p className="text-uppercase fs-10px fw-bold text-secondary mb-1 ls-1">{f}</p>
                        <div className="bg-light p-3 rounded">
                          {isFileField(f, String(val)) ? (
                            <a href={val} target="_blank" rel="noopener noreferrer" className="d-flex align-items-center text-primary text-decoration-none">
                              <LucideIcon name="external-link" className="icon-sm me-2" />
                              <span className="text-truncate">View File</span>
                            </a>
                          ) : (
                            <span className="fs-14px text-break">{String(val)}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="modal-footer border-top-0">
                <button type="button" className="btn btn-secondary px-4" onClick={() => setViewingSubmission(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1070 }}>
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-body p-4 text-center">
                <div className="mb-3 text-danger">
                  <LucideIcon name="alert-triangle" style={{ width: '56px', height: '56px' }} />
                </div>
                <h5 className="mb-2 fw-bold">Delete Submission?</h5>
                <p className="text-muted small mb-4">Are you sure you want to delete this submission? You will no longer see it in this list.</p>
                <div className="d-flex justify-content-center gap-2">
                  <button type="button" className="btn btn-light px-4" onClick={() => setDeleteId(null)}>No, Cancel</button>
                  <button type="button" className="btn btn-danger px-4" onClick={confirmDelete} disabled={isDeleting}>
                    {isDeleting ? "Deleting..." : "Yes, Delete"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}