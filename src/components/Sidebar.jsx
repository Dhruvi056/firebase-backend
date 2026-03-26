import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import AddFormPopup from "./AddFormPopup.jsx";

export default function Sidebar({
  onSelectForm,
  selectedForm,
  onClearAllNotifications,
  clearNotificationsToken,
  onSelectAdminSection,
  activeAdminSection,
}) {
  const [showPopup, setShowPopup] = useState(false);
  const [forms, setForms] = useState([]);
  const [folders, setFolders] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState({});
  const [newSubmissionCounts, setNewSubmissionCounts] = useState({});
  const [showLogoutMenu, setShowLogoutMenu] = useState(false);
  const { currentUser,userMeta} = useAuth();
  const { addToast } = useToast();
  const submissionUnsubsRef = useRef({});
  const initializedSubmissionListenersRef = useRef({});

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showLogoutMenu && !event.target.closest('.logout-menu-container')) {
        setShowLogoutMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLogoutMenu]);

  useEffect(() => {
    if (!currentUser) return;

    let qRef = collection(db, "forms");

    if (!userMeta || userMeta.role !== "super_admin") {
      qRef = query(qRef, where("userId", "==", currentUser.uid));
    }

    const unsub = onSnapshot(qRef, (snap) => {
      const arr = [];
      snap.forEach((docSnap) => {
        arr.push({
          formId: docSnap.id,
          ...docSnap.data(),
        });
      });
      setForms(arr);
    });
    return () => unsub();
  }, [currentUser, userMeta]);

  useEffect(() => {
    if (!currentUser) return;

    let qRef = collection(db, "folders");

    if (!userMeta || userMeta.role !== "super_admin") {
      qRef = query(qRef, where("userId", "==", currentUser.uid));
    }

    const unsub = onSnapshot(qRef, (snap) => {
      const arr = [];
      snap.forEach((docSnap) => {
        arr.push({
          id: docSnap.id,
          ...docSnap.data(),
        });
      });
      setFolders(arr);
    });
    return () => unsub();
  }, [currentUser, userMeta]);

  const homeActive = !selectedForm;
  const isSuperAdmin = userMeta?.role === "super_admin";

  const formsByFolder = {};
  
  forms.forEach((form) => {
    if (form.folderId) {
      const folderExists = folders.some(folder => folder.id === form.folderId);
      if (folderExists) {
        if (!formsByFolder[form.folderId]) {
          formsByFolder[form.folderId] = [];
        }
        formsByFolder[form.folderId].push(form);
      } else {
        console.warn(`Form "${form.name}" has folderId "${form.folderId}" but folder not found`);
      }
    }
  });

  const formsWithoutFolder = forms.filter(form => !form.folderId);

  useEffect(() => {
    const activeFormIds = new Set(forms.map((f) => f.formId));

    Object.keys(submissionUnsubsRef.current).forEach((formId) => {
      if (!activeFormIds.has(formId)) {
        submissionUnsubsRef.current[formId]();
        delete submissionUnsubsRef.current[formId];
        delete initializedSubmissionListenersRef.current[formId];
        setNewSubmissionCounts((prev) => {
          const next = { ...prev };
          delete next[formId];
          return next;
        });
      }
    });

    forms.forEach((form) => {
      if (submissionUnsubsRef.current[form.formId]) return;

      const submissionsRef = collection(db, `forms/${form.formId}/submissions`);
      const submissionsQuery = query(submissionsRef, orderBy("submittedAt", "desc"));

      submissionUnsubsRef.current[form.formId] = onSnapshot(
        submissionsQuery,
        (snap) => {
          if (!initializedSubmissionListenersRef.current[form.formId]) {
            initializedSubmissionListenersRef.current[form.formId] = true;
            return;
          }

          const addedCount = snap.docChanges().filter((change) => change.type === "added").length;

          if (addedCount <= 0) return;
          if (selectedForm?.formId === form.formId) return;

          setNewSubmissionCounts((prev) => ({
            ...prev,
            [form.formId]: (prev[form.formId] || 0) + addedCount,
          }));

          addToast(
            `${addedCount} new submission${addedCount > 1 ? "s" : ""} in ${form.name}`,
            "info"
          );
        },
        (err) => {
          console.warn(
            `Sidebar submission listener blocked for form ${form.formId}:`,
            err?.code || err
          );
        }
      );
    });
  }, [forms, selectedForm?.formId, addToast]);
  useEffect(() => {
    const activeFormId = selectedForm?.formId;
    if (!activeFormId) return;

    setNewSubmissionCounts((prev) => {
      if (!prev[activeFormId]) return prev;
      const next = { ...prev };
      delete next[activeFormId];
      return next;
    });
  }, [selectedForm?.formId]);
  useEffect(() => {
    setNewSubmissionCounts({});
  }, [clearNotificationsToken]);

  useEffect(() => {
    return () => {
      Object.values(submissionUnsubsRef.current).forEach((unsub) => unsub());
      submissionUnsubsRef.current = {};
      initializedSubmissionListenersRef.current = {};
    };
  }, []);

  const LucideIcon = ({ name, className = "" }) => {
    useEffect(() => {
      if (window.lucide) {
        window.lucide.createIcons();
      }
    }, [name]);
    
    return (
      <span 
        className="d-inline-flex align-items-center justify-content-center"
        dangerouslySetInnerHTML={{ __html: `<i data-lucide="${name}" class="${className}" stroke-width="2"></i>` }}
      />
    );
  };

  return (
    <nav className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand">
          CS <span>Formly</span>
        </div>
        <div className="sidebar-toggler" style={{ color: '#7987a1', display: 'flex' }} onClick={() => document.body.classList.toggle('sidebar-folded')}>
          <LucideIcon name="menu" className="icon-md" />
        </div>
      </div>
      <div className="sidebar-body">
        <ul className="nav" id="sidebarNav">
          {isSuperAdmin ? (
            <>
              <li className={`nav-item ${activeAdminSection === "dashboard" ? "active" : ""}`}>
                <button
                  type="button"
                  onClick={() => onSelectAdminSection?.("dashboard")}
                  className="nav-link btn btn-link w-100 text-start border-0 py-2 fs-14px d-flex align-items-center"
                  style={{
                    color: activeAdminSection === "dashboard" ? "var(--nobleui-primary)" : "#4d5969",
                    textDecoration: "none",
                  }}
                >
                  <LucideIcon name="home" className="link-icon" />
                  <span className="link-title">Dashboard</span>
                </button>
              </li>

              <li className="nav-item">
                <button
                  type="button"
                  onClick={() => setShowPopup(true)}
                  className="nav-link btn btn-link w-100 text-start border-0 d-flex align-items-center"
                  style={{ color: "inherit", textDecoration: "none" }}
                >
                  <LucideIcon name="plus-circle" className="link-icon" />
                  <span className="link-title">Create...</span>
                </button>
              </li>

              <li className={`nav-item ${activeAdminSection === "users" ? "active" : ""}`}>
                <button
                  type="button"
                  onClick={() => onSelectAdminSection?.("users")}
                  className="nav-link btn btn-link w-100 text-start border-0 py-2 fs-14px d-flex align-items-center"
                  style={{
                    color: activeAdminSection === "users" ? "var(--nobleui-primary)" : "#4d5969",
                    textDecoration: "none",
                  }}
                >
                  <LucideIcon name="users" className="link-icon" />
                  <span className="link-title">Vendor Admin</span>
                </button>
              </li>

              <li className={`nav-item ${activeAdminSection === "forms" ? "active" : ""}`}>
                <button
                  type="button"
                  onClick={() => onSelectAdminSection?.("forms")}
                  className="nav-link btn btn-link w-100 text-start border-0 py-2 fs-14px d-flex align-items-center"
                  style={{
                    color: activeAdminSection === "forms" ? "var(--nobleui-primary)" : "#4d5969",
                    textDecoration: "none",
                  }}
                >
                  <LucideIcon name="file-text" className="link-icon" />
                  <span className="link-title">All forms</span>
                </button>
              </li>
            </>
          ) : (
            <>
              <li className="nav-item nav-category">Forms & Folders</li>

              <li className="nav-item">
                <button
                  onClick={() => setShowPopup(true)}
                  className="nav-link btn btn-link w-100 text-start border-0 d-flex align-items-center"
                  style={{ color: "inherit", textDecoration: "none" }}
                >
                  <LucideIcon name="plus-circle" className="link-icon" />
                  <span className="link-title">Create...</span>
                </button>
              </li>

              <li className={`nav-item ${homeActive ? "active" : ""}`}>
                <button
                  onClick={() => onSelectForm(null)}
                  className="nav-link btn btn-link w-100 text-start border-0 d-flex align-items-center"
                  style={{
                    color: homeActive ? "var(--nobleui-primary)" : "inherit",
                    textDecoration: "none",
                  }}
                >
                  <LucideIcon name="home" className="link-icon" />
                  <span className="link-title">Home</span>
                </button>
              </li>

              {formsWithoutFolder.length > 0 && (
                <>
                  <li className="nav-item nav-category">Direct Forms</li>
                  {formsWithoutFolder.map((f) => {
                    const isSelected = selectedForm?.formId === f.formId;
                    const unreadCount = newSubmissionCounts[f.formId] || 0;
                    return (
                      <li key={f.formId} className={`nav-item ${isSelected ? "active" : ""}`}>
                        <button
                          onClick={() => onSelectForm(f)}
                          className="nav-link btn btn-link w-100 text-start border-0 py-2 fs-14px d-flex align-items-center justify-content-between"
                          style={{
                            color: isSelected ? "var(--nobleui-primary)" : "#4d5969",
                            textDecoration: "none",
                            paddingLeft: "45px",
                          }}
                        >
                          <span className="link-title text-truncate">{f.name}</span>
                          {unreadCount > 0 && (
                            <span
                              className="badge rounded-pill bg-primary ms-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                setNewSubmissionCounts({});
                                onClearAllNotifications?.();
                              }}
                              title="Clear all notifications"
                              role="button"
                              style={{ cursor: "pointer" }}
                            >
                              {unreadCount}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </>
              )}

              {folders.length > 0 && (
                <>
                  <li className="nav-item nav-category">Folders</li>
                  {folders.map((folder) => {
                    const folderForms = formsByFolder[folder.id] || [];
                    const isFolderExpanded = expandedFolders[folder.id];
                    const folderUnreadCount = folderForms.reduce(
                      (total, form) => total + (newSubmissionCounts[form.formId] || 0),
                      0
                    );

                    return (
                      <li key={folder.id} className="nav-item">
                        <button
                          className="nav-link btn btn-link w-100 text-start border-0 d-flex align-items-center justify-content-between"
                          onClick={() =>
                            setExpandedFolders((prev) => ({
                              ...prev,
                              [folder.id]: !isFolderExpanded,
                            }))
                          }
                          style={{ color: "#4d5969", textDecoration: "none" }}
                        >
                          <div className="d-flex align-items-center overflow-hidden">
                            <LucideIcon
                              name={isFolderExpanded ? "folder-open" : "folder"}
                              className="link-icon"
                            />
                            <span className="link-title text-truncate">{folder.name}</span>
                            {folderUnreadCount > 0 && (
                              <span
                                className="badge rounded-pill bg-primary ms-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setNewSubmissionCounts({});
                                  onClearAllNotifications?.();
                                }}
                                title="Clear all notifications"
                                role="button"
                                style={{ cursor: "pointer" }}
                              >
                                {folderUnreadCount}
                              </span>
                            )}
                          </div>
                          <div
                            className="link-arrow"
                            style={{
                              transform: isFolderExpanded ? "rotate(180deg)" : "rotate(0deg)",
                              transition: "transform 0.2s",
                              visibility: folderForms.length >= 0 ? "visible" : "hidden",
                              display: "inline-flex",
                              opacity: 1,
                              color: "#4d5969",
                              pointerEvents: "none",
                            }}
                          >
                            <LucideIcon name="chevron-down" />
                          </div>
                        </button>

                        {isFolderExpanded && (
                          <ul
                            className="nav sub-menu"
                            style={{
                              display: "block",
                              borderLeft: "none",
                              marginLeft: "25px",
                              padding: "5px 0",
                            }}
                          >
                            {folderForms.length === 0 ? (
                              <li className="nav-item">
                                <span className="nav-link disabled py-1 fs-12px text-muted italic">
                                  No forms
                                </span>
                              </li>
                            ) : (
                              folderForms.map((f) => {
                                const isSelected = selectedForm?.formId === f.formId;
                                const unreadCount = newSubmissionCounts[f.formId] || 0;
                                return (
                                  <li key={f.formId} className="nav-item">
                                    <button
                                      onClick={() => onSelectForm(f)}
                                      className={`nav-link btn btn-link w-100 text-start border-0 py-1 fs-13px d-flex align-items-center justify-content-between ${
                                        isSelected ? "text-primary fw-bold" : ""
                                      }`}
                                      style={{
                                        color: isSelected ? "var(--nobleui-primary)" : "#4d5969",
                                        textDecoration: "none",
                                      }}
                                    >
                                      <span className="text-truncate">{f.name}</span>
                                      {unreadCount > 0 && (
                                        <span
                                          className="badge rounded-pill bg-primary ms-2"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setNewSubmissionCounts({});
                                            onClearAllNotifications?.();
                                          }}
                                          title="Clear all notifications"
                                          role="button"
                                          style={{ cursor: "pointer" }}
                                        >
                                          {unreadCount}
                                        </span>
                                      )}
                                    </button>
                                  </li>
                                );
                              })
                            )}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </>
              )}
            </>
          )}
        </ul>
      </div>

      {showPopup && <AddFormPopup onClose={() => setShowPopup(false)} onSelectForm={onSelectForm} />}
    </nav>
  );
}
