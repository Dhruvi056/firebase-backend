import { useState, useEffect, useCallback, useMemo } from "react";
import { db } from "../firebase";
import { collection, query, onSnapshot, doc, getDoc, updateDoc, where } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import "../styles/components/form-details-toolbar.css";

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

export default function FormDetails({ form, onFormUpdated, searchQuery = "" }) {
  const { currentUser, userMeta } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [copied, setCopied] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailsList, setEmailsList] = useState([]);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);
  const [viewingSubmission, setViewingSubmission] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const [folders, setFolders] = useState([]);
  const [allForms, setAllForms] = useState([]);
  const [moveFolderId, setMoveFolderId] = useState("");
  const [moveSaving, setMoveSaving] = useState(false);

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  useEffect(() => {
    if (!currentUser) return;

    let qRef = collection(db, "folders");

    if (userMeta?.role === "vendor_admin" && userMeta.vendorId) {
      qRef = query(qRef, where("vendorId", "==", userMeta.vendorId));
    } else if (!userMeta || userMeta.role !== "super_admin") {
      qRef = query(qRef, where("userId", "==", currentUser.uid));
    }

    const unsub = onSnapshot(qRef, (snap) => {
      const arr = [];
      snap.forEach((snapDoc) => arr.push({ id: snapDoc.id, ...snapDoc.data() }));
      setFolders(arr);
    });
    return () => unsub();
  }, [currentUser, userMeta]);

  useEffect(() => {
    if (!currentUser) return;

    let qRef = collection(db, "forms");

    if (userMeta?.role === "vendor_admin" && userMeta.vendorId) {
      qRef = query(qRef, where("vendorId", "==", userMeta.vendorId));
    } else if (!userMeta || userMeta.role !== "super_admin") {
      qRef = query(qRef, where("userId", "==", currentUser.uid));
    }

    const unsub = onSnapshot(qRef, (snap) => {
      const arr = [];
      snap.forEach((snapDoc) => arr.push({ formId: snapDoc.id, ...snapDoc.data() }));
      setAllForms(arr);
    });
    return () => unsub();
  }, [currentUser, userMeta]);

  useEffect(() => {
    if (!form) return;
    setRenameDraft(form.name || "");
    setMoveFolderId(form.folderId || "");
    setIsEditingName(false);
  }, [form]);

  const isNameTaken = (name, excludeFormId) => {
    const normalized = name.trim().toLowerCase();
    if (!normalized) return false;
    const formExists = allForms.some(
      (f) => f.formId !== excludeFormId && (f.name || "").trim().toLowerCase() === normalized
    );
    const folderExists = folders.some((f) => (f.name || "").trim().toLowerCase() === normalized);
    return formExists || folderExists;
  };

  const handleSaveRename = async () => {
    if (!form?.formId) return;
    const trimmed = renameDraft.trim();
    if (!trimmed) {
      toast.error("Please enter a form name.");
      return;
    }
    if (isNameTaken(trimmed, form.formId)) {
      toast.error("This name is already used by another form or folder.");
      return;
    }
    if (trimmed === (form.name || "").trim()) {
      setIsEditingName(false);
      return;
    }
    setRenameSaving(true);
    try {
      const formDocRef = doc(db, "forms", form.formId);
      await updateDoc(formDocRef, { name: trimmed });
      onFormUpdated?.({ name: trimmed });
      toast.success("Form name updated.");
      setIsEditingName(false);
    } catch (err) {
      console.error("Rename form failed:", err);
      toast.error("Could not update form name.");
    } finally {
      setRenameSaving(false);
    }
  };

  const handleSaveMove = async () => {
    if (!form?.formId) return;
    const nextId = moveFolderId || null;
    const currentId = form.folderId || null;
    if (nextId === currentId) {
      toast("Already in this folder.");
      return;
    }
    setMoveSaving(true);
    try {
      const formDocRef = doc(db, "forms", form.formId);
      await updateDoc(formDocRef, { folderId: nextId });
      onFormUpdated?.({ folderId: nextId });
      toast.success("Form moved to folder.");
    } catch (err) {
      console.error("Move form failed:", err);
      toast.error("Could not move form.");
    } finally {
      setMoveSaving(false);
    }
  };

  const loadCustomEmail = useCallback(async () => {
    try {
      if (!form?.formId) return;

      const formDocRef = doc(db, "forms", form.formId);
      const formDoc = await getDoc(formDocRef);

      if (formDoc.exists()) {
        const formData = formDoc.data();
        const emailStr = formData.notificationEmail || "";
        setEmailsList(emailStr ? emailStr.split(',').map(e => e.trim()).filter(Boolean) : []);
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
      const emailStr = emailsList.join(', ');
      const formDocRef = doc(db, 'forms', form.formId);
      await updateDoc(formDocRef, {
        notificationEmail: emailStr
      });

      setEmailSaved(true);
      setTimeout(() => setEmailSaved(false), 2000);
      setShowEmailModal(false);
    } catch (error) {
      console.error('Error saving custom email:', error);
      toast.error('Failed to save emails');
    } finally {
      setEmailLoading(false);
    }
  };

  const addEmail = () => {
    const trimmed = emailInput.trim().toLowerCase();
    if (!trimmed) return;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      toast.error("Please enter a valid email address");
      return;
    }
    
    if (emailsList.includes(trimmed)) {
      toast.error("Email already added");
      return;
    }
    
    setEmailsList([...emailsList, trimmed]);
    setEmailInput('');
  };

  const removeEmail = (index) => {
    setEmailsList(emailsList.filter((_, i) => i !== index));
  };

  const openEmailModal = () => {
    loadCustomEmail(); 
    setShowEmailModal(true);
  };

  useEffect(() => {
    if (!form) return;

    const ref = collection(db, `forms/${form.formId}/submissions`);
    const q = query(ref);

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((doc) => {
          const data = doc.data();
          if (data.isDeleted) return null;

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
            _rawSubmittedAt: data.submittedAt 
          };
        }).filter(Boolean); 
        
        list.sort((a, b) => {
          const dateA = a._rawSubmittedAt?.toDate ? a._rawSubmittedAt.toDate() : new Date(a._rawSubmittedAt || 0);
          const dateB = b._rawSubmittedAt?.toDate ? b._rawSubmittedAt.toDate() : new Date(b._rawSubmittedAt || 0);
          return dateB - dateA;
        });

        setSubmissions(list);
      },
      (error) => {
        if (error?.code === "permission-denied") {
          console.warn("FormDetails: submissions access denied by Firestore rules.");
        } else {
          console.error("FormDetails: Error fetching submissions:", error);
        }
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

  const allFields = new Set();
  const metaFields = ["id", "submittedAt", "folderId", "vendorId", "userId", "_rawSubmittedAt", "data"];
  
  submissions.forEach((s) => {
    if (s.data && typeof s.data === 'object') {
      Object.keys(s.data).forEach((f) => allFields.add(f));
    }
   
    Object.keys(s).forEach((f) => {
      if (!metaFields.includes(f)) {
        allFields.add(f);
      }
    });
  });

  const fields = Array.from(allFields).filter((f) => f !== "_gotcha");

  const filteredSubmissions = useMemo(() => {
    if (!searchQuery) return submissions;
    const s = searchQuery.toLowerCase();
    return submissions.filter((sub) => {
      const subDate = (sub.submittedAt || "").toLowerCase();
      const matchInFields = fields.some((f) => {
        const value = sub[f] !== undefined ? sub[f] : sub.data?.[f];
        return String(value || "").toLowerCase().includes(s);
      });
      return subDate.includes(s) || matchInFields;
    });
  }, [submissions, searchQuery, fields]);

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

  return (
    <div className="row h-100 flex-column">
      <div className="col-md-12 mb-4 flex-shrink-0">
        <div className="fd-form-toolbar">
          <div className="fd-form-toolbar-accent" aria-hidden />
          <div className="fd-form-toolbar-body">
            <div className="fd-toolbar-top">
              <div className="fd-form-meta">
                <span className="fd-id-chip" title="Form ID">
                  ID · {form.formId}
                </span>
              </div>
              <button
                type="button"
                onClick={openEmailModal}
                className="btn fd-btn-notify"
                title="Set notification email"
              >
                <LucideIcon name="mail" className="icon-sm" />
                <span>Notification email</span>
              </button>
            </div>

            <div className="fd-pro-grid">
              <div className="fd-pro-panel">
                <div className="fd-pro-panel-head">
                  <span className="fd-pro-panel-title">Display name</span>
                </div>
                {isEditingName ? (
                  <div className="fd-pro-rename-row">
                    <input
                      type="text"
                      className="form-control fd-pro-input"
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveRename();
                        if (e.key === "Escape") {
                          setRenameDraft(form.name || "");
                          setIsEditingName(false);
                        }
                      }}
                      autoFocus
                      disabled={renameSaving}
                      aria-label="Form display name"
                    />
                    <div className="fd-pro-rename-actions">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm fd-pro-btn-min"
                        onClick={handleSaveRename}
                        disabled={renameSaving}
                      >
                        {renameSaving ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm fd-pro-btn-min"
                        onClick={() => {
                          setRenameDraft(form.name || "");
                          setIsEditingName(false);
                        }}
                        disabled={renameSaving}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="fd-pro-heading-row">
                    <h4 className="fd-pro-heading mb-0">{form.name}</h4>
                    <button
                      type="button"
                      className="fd-pro-edit-btn"
                      title="Edit display name"
                      onClick={() => setIsEditingName(true)}
                      aria-label="Edit display name"
                    >
                      <LucideIcon name="pencil" className="icon-sm" />
                    </button>
                  </div>
                )}
              </div>

              <div className="fd-pro-panel">
                <div className="fd-pro-panel-head">
                  <span className="fd-pro-panel-title">Folder location</span>
                  <span className="fd-pro-panel-hint">Move this form to another folder</span>
                </div>
                <div className="fd-pro-folder-row">
                  <select
                    id="fd-form-folder-select"
                    className="form-select form-select-sm fd-pro-select"
                    value={moveFolderId}
                    onChange={(e) => setMoveFolderId(e.target.value)}
                    disabled={moveSaving}
                    aria-label="Select folder"
                  >
                    <option value="">None (direct)</option>
                    {folders.map((fol) => (
                      <option key={fol.id} value={fol.id}>
                        {fol.name || fol.id}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm fd-pro-apply-btn"
                    onClick={handleSaveMove}
                    disabled={moveSaving}
                  >
                    {moveSaving ? "…" : "Apply"}
                  </button>
                </div>
              </div>
            </div>

            <div className="fd-pro-url">
              <span className="fd-pro-url-label">Endpoint URL</span>
              <div className="fd-pro-url-inner">
                <code className="fd-pro-url-text">{form.url}</code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(form.url)}
                  className="btn fd-pro-url-copy"
                  title={copied ? "Copied" : "Copy URL"}
                  aria-label="Copy URL"
                >
                  <LucideIcon
                    name={copied ? "check" : "copy"}
                    className={`icon-sm ${copied ? "text-success" : "text-primary"}`}
                  />
                </button>
                <span className={`fd-pro-copied ${copied ? "is-on" : ""}`}>Copied</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="col-md-12 flex-grow-1 overflow-hidden d-flex flex-column">
        <div className="card shadow-sm border-0 flex-grow-1 overflow-hidden">
          <div className="card-body d-flex flex-column h-100">
            <h6 className="card-title mb-4">
              Submissions {filteredSubmissions.length > 0 && <span className="text-secondary fw-normal">({filteredSubmissions.length})</span>}
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
                    {filteredSubmissions.map((sub) => (
                      <tr key={sub.id}>
                        {fields.map((f) => {
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
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header border-bottom-0 pt-4 px-4">
                <div className="d-flex align-items-center">
                  <div className="bg-primary-subtle p-2 rounded-circle me-3 d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px' }}>
                    <LucideIcon name="mail" className="text-primary icon-sm" />
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold text-body mb-0">Notification Emails</h5>
                    <p className="text-muted fs-12px mb-0">Manage where you receive submission alerts</p>
                  </div>
                </div>
                <button type="button" className="btn-close shadow-none" aria-label="Close" onClick={() => setShowEmailModal(false)}></button>
              </div>
              <div className="modal-body p-4 pt-4">
                <div className="mb-4">
                  <label className="form-label fw-bold small text-uppercase ls-1 text-secondary mb-2">Recipient List</label>
                  <div className="d-flex flex-wrap gap-2 mb-3 min-h-50px p-3 bg-light rounded-3 border border-dashed">
                    {emailsList.length === 0 ? (
                      <span className="text-muted small italic py-1">No recipient emails added yet.</span>
                    ) : (
                      emailsList.map((email, idx) => (
                        <div key={idx} className="badge bg-white text-body border d-flex align-items-center py-2 px-3 rounded-pill shadow-sm animate-fadeIn">
                          <span className="fs-13px fw-medium">{email}</span>
                          <button 
                            type="button" 
                            className="btn-close ms-2 p-1" 
                            style={{ fontSize: '0.55rem' }} 
                            onClick={() => removeEmail(idx)}
                            aria-label="Remove"
                          ></button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-bold small text-uppercase ls-1 text-secondary mb-2">Add New Recipient</label>
                  <div className="input-group shadow-sm">
                    <input
                      type="email"
                      className="form-control py-2 fs-14px border-end-0"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addEmail();
                        }
                      }}
                      placeholder="e.g. notifications@company.com"
                    />
                    <button 
                      className="btn btn-primary px-3 d-flex align-items-center fw-bold" 
                      type="button" 
                      onClick={addEmail}
                    >
                      <LucideIcon name="plus" className="icon-xs me-1" />
                      Add
                    </button>
                  </div>
                  <div className="form-text mt-3 bg-primary-subtle p-2 rounded text-primary-emphasis fs-12px d-flex align-items-start">
                    <LucideIcon name="info" className="icon-xs mt-1 me-2" />
                    <span>Multiple emails are supported. You will receive an alert on all listed addresses for every new submission.</span>
                  </div>
                </div>

                {emailSaved && (
                  <div className="alert alert-success d-flex align-items-center py-2 border-0 shadow-sm mb-0 mt-3" role="alert">
                    <LucideIcon name="check-circle" className="icon-sm me-2" />
                    <div className="small fw-bold">Settings updated!</div>
                  </div>
                )}
              </div>
              <div className="modal-footer border-top-0 pt-0 px-4 pb-4">
                <button type="button" className="btn btn-link text-secondary text-decoration-none fw-medium me-2" onClick={() => setShowEmailModal(false)}>Cancel</button>
                <button
                  type="button"
                  className="btn btn-primary px-4 fw-bold shadow-sm"
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