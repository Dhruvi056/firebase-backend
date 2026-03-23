import { collection, doc, serverTimestamp, setDoc, query, where } from "firebase/firestore";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { generateFormId } from "../utils/generateFormId";
import { getFormUrl } from "../utils/getFormUrl";
import { onSnapshot } from "firebase/firestore";

export default function AddFormPopup({ onClose, onSelectForm }) {
  const [activeTab, setActiveTab] = useState("Form");
  const [formName, setFormName] = useState("");
  const [folderName, setFolderName] = useState("");
  const [selectedFolder, setSelectedFolder] = useState("");
  const [folders, setFolders] = useState([]);
  const [forms, setForms] = useState([]);
  const [formError, setFormError] = useState("");
  const [folderError, setFolderError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const { currentUser,userMeta } = useAuth( );

  // Helper component to render Lucide icons safely in React
  const LucideIcon = ({ name, className = "" }) => {
    useEffect(() => {
      if (window.lucide) {
        window.lucide.createIcons();
      }
    }, [name]);
    
    return (
      <span 
        className="d-inline-flex align-items-center justify-content-center"
        dangerouslySetInnerHTML={{ __html: `<i data-lucide="${name}" class="${className}" stroke-width="1.5"></i>` }}
      />
    );
  };

  // Fetch folders
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
  }, [currentUser,userMeta]);

  // Fetch forms for duplicate-name check
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
      snap.forEach((snapDoc) => arr.push({ id: snapDoc.id, ...snapDoc.data() }));
      setForms(arr);
    });
    return () => unsub();
  }, [currentUser, userMeta]);

  const isNameTaken = (name) => {
    const normalized = name.trim().toLowerCase();
    if (!normalized) return false;

    const formExists = forms.some((f) => (f.name || "").trim().toLowerCase() === normalized);
    const folderExists = folders.some((f) => (f.name || "").trim().toLowerCase() === normalized);
    return formExists || folderExists;
  };

  const handleCreate = async () => {
    if (isCreating) return;

    if (activeTab === "Form") {
      if (!formName.trim()) {
        setFormError("Please enter a form endpoint name.");
        return;
      }

      if (!selectedFolder) {
        setFormError("Please select a folder for your form.");
        return;
      }

      if (isNameTaken(formName)) {
        setFormError("This name already exists. Please use a different name.");
        return;
      }

      const id = generateFormId();
      const formUrl = getFormUrl(id);
      
      const newForm = {
        name: formName.trim(),
        formId: id,
        url: formUrl,
        folderId: selectedFolder, 
        userId: currentUser.uid,
        vendorId: userMeta?.vendorId || currentUser.uid,
        createdAt: serverTimestamp(),
      };

      
      try {
        setIsCreating(true);
        await setDoc(doc(collection(db, "forms"), id), newForm);


        if (onSelectForm) {
          onSelectForm({
            name: formName.trim(),
            formId: id,
            url: formUrl,
            folderId: selectedFolder, 
          });
        }
      } catch (error) {
        console.error("Error creating form:", error);
        setFormError("Error creating form: " + error.message);
        setIsCreating(false);
        return;
      }
    } else {
      if (!folderName.trim()) {
        setFolderError("Please enter a folder name.");
        return;
      }

      if (isNameTaken(folderName)) {
        setFolderError("This name already exists. Please use a different name.");
        return;
      }

      const folderId = generateFormId();
      const newFolder = {
        name: folderName.trim(),
        userId: currentUser.uid,
        vendorId: userMeta?.vendorId || currentUser.uid,
        createdAt: serverTimestamp(),
      };

      
      try {
        setIsCreating(true);
        await setDoc(doc(collection(db, "folders"), folderId), newFolder);

      } catch (error) {
        console.error("Error creating folder:", error);
        setFolderError("Error creating folder: " + error.message);
        setIsCreating(false);
        return;
      }
    }

    onClose();
  };

  const modalMarkup = (
    <div
      className="modal show d-block"
      tabIndex="-1"
      style={{
        backgroundColor: "rgba(0,0,0,0.5)",
        position: "fixed",
        inset: 0,
        zIndex: 9999,
      }}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 shadow-lg">
          <div className="modal-header border-bottom-0 pb-0 pt-4 px-4 bg-transparent">
            <div className="d-flex align-items-center">
              <div className="bg-primary p-2 rounded-circle me-3 d-flex align-items-center justify-content-center" style={{ width: '38px', height: '38px' }}>
                <LucideIcon name="plus" className="text-white icon-sm" />
              </div>
              <div>
                <h5 className="modal-title fw-bold text-body mb-0">Create New...</h5>
                <p className="text-muted fs-12px mb-0">Add a new endpoint or organize with folders</p>
              </div>
            </div>
            <button type="button" className="btn-close shadow-none" aria-label="Close" onClick={onClose}></button>
          </div>
          <div className="modal-body p-4 pt-4">
            <ul className="nav nav-tabs nav-tabs-line mb-4" id="lineTab" role="tablist">
              <li className="nav-item">
                <button 
                  className={`nav-link ${activeTab === "Form" ? "active" : ""}`} 
                  onClick={() => {
                    setActiveTab("Form");
                    setFormError("");
                  }}
                  type="button"
                  role="tab"
                >
                  Form Endpoint
                </button>
              </li>
              <li className="nav-item">
                <button 
                  className={`nav-link ${activeTab === "Folder" ? "active" : ""}`} 
                  onClick={() => {
                    setActiveTab("Folder");
                    setFolderError("");
                  }}
                  type="button"
                  role="tab"
                >
                  Folder
                </button>
              </li>
            </ul>

            <div className="tab-content mt-3">
              {activeTab === "Form" && (
                <div className="tab-pane fade show active">
                  <p className="text-muted mb-4 small">
                    Add a descriptive name and select a folder to create your form endpoint.
                  </p>
                  <form className="forms-sample">
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Folder</label>
                      <select
                        value={selectedFolder}
                        onChange={(e) => {
                          setSelectedFolder(e.target.value);
                          setFormError("");
                        }}
                        className="form-select"
                        required
                      >
                        <option value="">Select a Folder (required)</option>
                        {folders.map((folder) => (
                          <option key={folder.id} value={folder.id}>
                            {folder.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Form Endpoint Name</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. job-application"
                        value={formName}
                        onChange={(e) => {
                          setFormName(e.target.value);
                          setFormError("");
                        }}
                        required
                      />
                      {formError && (
                        <div className="text-danger mt-1 small">{formError}</div>
                      )}
                    </div>
                  </form>
                </div>
              )}

              {activeTab === "Folder" && (
                <div className="tab-pane fade show active">
                  <p className="text-muted mb-4 small">
                    Enter a folder name to organize your forms.
                  </p>
                  <form className="forms-sample">
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Folder Name</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Project Alpha"
                        value={folderName}
                        onChange={(e) => {
                          setFolderName(e.target.value);
                          setFolderError("");
                        }}
                        required
                      />
                      {folderError && (
                        <div className="text-danger mt-1 small">{folderError}</div>
                      )}
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
          <div className="modal-footer border-top-0 pt-0">
            <button type="button" className="btn btn-link text-secondary text-decoration-none me-2" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="btn btn-primary px-4 d-flex align-items-center"
              onClick={handleCreate}
              disabled={
                isCreating ||
                (activeTab === "Form" ? !formName.trim() || !selectedFolder : !folderName.trim())
              }
            >
              <LucideIcon name="plus" className="icon-sm me-1" />
              {isCreating ? "Creating..." : `Create ${activeTab}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalMarkup, document.body);
}