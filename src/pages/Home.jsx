import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getDoc, doc, collection, onSnapshot, query, where, orderBy, limit, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import FormDetails from "../components/FormDetails.jsx";
import Sidebar from "../components/Sidebar.jsx";
import toast from "react-hot-toast";
import AdminUsersTable from "../components/AdminUsersTable.jsx";
import AdminFormsTable from "../components/AdminFormsTable.jsx";

export default function Home() {
  const { formId } = useParams();
  const navigate = useNavigate();
  const [selectedForm, setSelectedForm] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showProfileView, setShowProfileView] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editJoined, setEditJoined] = useState("");
  const [editLives, setEditLives] = useState("");
  const [editWebsite, setEditWebsite] = useState("");
  const [editAbout, setEditAbout] = useState("");
  const [editPhotoURL, setEditPhotoURL] = useState("");
  const [editCoverURL, setEditCoverURL] = useState("");
  const [showNotificationMenu, setShowNotificationMenu] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [superAdminSection, setSuperAdminSection] = useState("dashboard");
  const [superAdminMetrics, setSuperAdminMetrics] = useState({
    users: 0,
    folders: 0,
    forms: 0,
  });
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [useSubmissionFallbackNotifications, setUseSubmissionFallbackNotifications] = useState(false);
  const [clearNotificationsToken, setClearNotificationsToken] = useState(0);
  const [clearBeforeMs, setClearBeforeMs] = useState(0);
  const { currentUser, userMeta, logout, updateUserMeta } = useAuth();
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const photoInputRef = useRef(null);
  const coverInputRef = useRef(null);
  const hasInitializedNotificationsRef = useRef(false);
  const notificationFormUnsubsRef = useRef({});
  const initializedNotificationListenersRef = useRef({});
  const clearBeforeMsRef = useRef(0);

  const getNotificationTimeMs = (value) => {
    if (value?.toDate) return value.toDate().getTime();
    const parsed = new Date(value || 0).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  useEffect(() => {
    if (!currentUser) return;
    hasInitializedNotificationsRef.current = false;
    setUseSubmissionFallbackNotifications(false);

    const notificationsRef = collection(db, "notifications");
    const notificationsQ = query(notificationsRef, where("userId", "==", currentUser.uid));

    const notificationsUnsub = onSnapshot(
      notificationsQ,
      (snap) => {
        const list = snap.docs.map((n) => {
          const data = n.data() || {};
          return {
            id: n.id,
            formId: data.formId || "",
            formName: data.formName || data.formId || "Form",
            dataSnippet: data.dataSnippet || "New submission",
            createdAt: data.createdAt || new Date(),
            read: !!data.read,
          };
        }).filter((n) => getNotificationTimeMs(n.createdAt) > clearBeforeMsRef.current).sort((a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
          return dateB - dateA;
        }).slice(0, 20);

        setNotifications(list);
        setUnreadCount(list.filter((n) => !n.read).length);

        if (!hasInitializedNotificationsRef.current) {
          hasInitializedNotificationsRef.current = true;
        }
      },
      (err) => {
        console.error("Notifications listener error:", err);
        if (err?.code === "permission-denied") {
          setUseSubmissionFallbackNotifications(true);
        }
      }
    );

    return () => notificationsUnsub();
  }, [currentUser, clearBeforeMs]);

  useEffect(() => {
    if (!currentUser || userMeta?.role !== "super_admin") {
      setMetricsLoading(false);
      return;
    }

    setMetricsLoading(true);
    let settledStreams = 0;
    const markSettled = () => {
      settledStreams += 1;
      if (settledStreams >= 3) setMetricsLoading(false);
    };

    const usersUnsub = onSnapshot(
      collection(db, "users"),
      (snap) => {
        const vendorAdmins = snap.docs.filter(d => (d.data()?.role || "vendor_admin") === "vendor_admin").length;
        setSuperAdminMetrics((prev) => ({ ...prev, users: vendorAdmins }));
        markSettled();
      },
      (err) => {
        console.warn("Super admin users metrics error:", err);
        markSettled();
      }
    );

    const foldersUnsub = onSnapshot(
      collection(db, "folders"),
      (snap) => {
        setSuperAdminMetrics((prev) => ({ ...prev, folders: snap.size }));
        markSettled();
      },
      (err) => {
        console.warn("Super admin folders metrics error:", err);
        markSettled();
      }
    );

    const formsUnsub = onSnapshot(
      collection(db, "forms"),
      (snap) => {
        setSuperAdminMetrics((prev) => ({ ...prev, forms: snap.size }));
        markSettled();
      },
      (err) => {
        console.warn("Super admin forms metrics error:", err);
        markSettled();
      }
    );

    return () => {
      usersUnsub();
      foldersUnsub();
      formsUnsub();
    };
  }, [currentUser, userMeta?.role]);
  useEffect(() => {
    if (!currentUser || !useSubmissionFallbackNotifications) return;

    let formsQ = collection(db, "forms");
    if (userMeta?.role === "vendor_admin" && userMeta.vendorId) {
      formsQ = query(formsQ, where("vendorId", "==", userMeta.vendorId));
    } else if (!userMeta || userMeta.role !== "super_admin") {
      formsQ = query(formsQ, where("userId", "==", currentUser.uid));
    }

    const formsUnsub = onSnapshot(
      formsQ,
      (formsSnap) => {
        const formIds = new Set();
        const formNameById = {};

        formsSnap.forEach((formDoc) => {
          formIds.add(formDoc.id);
          formNameById[formDoc.id] = formDoc.data()?.name || formDoc.id;
        });

        Object.keys(notificationFormUnsubsRef.current).forEach((trackedFormId) => {
          if (!formIds.has(trackedFormId)) {
            notificationFormUnsubsRef.current[trackedFormId]();
            delete notificationFormUnsubsRef.current[trackedFormId];
            delete initializedNotificationListenersRef.current[trackedFormId];
          }
        });

        formIds.forEach((trackedFormId) => {
          if (notificationFormUnsubsRef.current[trackedFormId]) return;

          const submissionsRef = collection(db, `forms/${trackedFormId}/submissions`);
          const submissionsQuery = query(submissionsRef, orderBy("submittedAt", "desc"), limit(20));

          notificationFormUnsubsRef.current[trackedFormId] = onSnapshot(
            submissionsQuery,
            (submissionsSnap) => {
              if (!initializedNotificationListenersRef.current[trackedFormId]) {
                initializedNotificationListenersRef.current[trackedFormId] = true;
                const initial = submissionsSnap.docs.map((d) => {
                  const submission = d.data() || {};
                  const payload = submission.data || {};
                  const snippet =
                    payload.email ||
                    payload.name ||
                    Object.values(payload)[0] ||
                    "New submission";

                  return {
                    id: `fallback-initial-${trackedFormId}-${d.id}`,
                    formId: trackedFormId,
                    formName: formNameById[trackedFormId] || trackedFormId,
                    dataSnippet: String(snippet),
                    createdAt: submission.submittedAt || new Date(),
                    read: true,
                  };
                });

                setNotifications((prev) =>
                  [...initial, ...prev]
                    .filter((n) => getNotificationTimeMs(n.createdAt) > clearBeforeMsRef.current)
                    .sort((a, b) => {
                      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                      return dateB - dateA;
                    })
                    .slice(0, 20)
                );
                return;
              }

              const addedDocs = submissionsSnap.docChanges().filter((c) => c.type === "added");
              if (addedDocs.length === 0) return;

              const fresh = addedDocs.map((change) => {
                const submission = change.doc.data() || {};
                const payload = submission.data || {};
                const snippet =
                  payload.email ||
                  payload.name ||
                  Object.values(payload)[0] ||
                  "New submission";

                return {
                  id: `fallback-${trackedFormId}-${change.doc.id}-${Date.now()}-${Math.random()}`,
                  formId: trackedFormId,
                  formName: formNameById[trackedFormId] || trackedFormId,
                  dataSnippet: String(snippet),
                  createdAt: submission.submittedAt || new Date(),
                  read: false,
                };
              });

              setNotifications((prev) =>
                [...fresh, ...prev]
                  .filter((n) => getNotificationTimeMs(n.createdAt) > clearBeforeMsRef.current)
                  .sort((a, b) => {
                    const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                    const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                    return dateB - dateA;
                  })
                  .slice(0, 20)
              );
              setUnreadCount((prev) => prev + fresh.length);
            },
            (err) => {
              console.warn(`Fallback submission listener blocked for form ${trackedFormId}:`, err?.code || err);
            }
          );
        });
      },
      (err) => {
        console.error("Fallback forms listener error for notifications:", err);
      }
    );

    return () => {
      formsUnsub();
      Object.values(notificationFormUnsubsRef.current).forEach((unsub) => unsub());
      notificationFormUnsubsRef.current = {};
      initializedNotificationListenersRef.current = {};
    };
  }, [currentUser, userMeta, useSubmissionFallbackNotifications]);

  const clearAllNotifications = async () => {
    const now = Date.now();
    clearBeforeMsRef.current = now;
    setClearBeforeMs(now);

    const current = [...notifications];
    const firestoreBacked = current.filter((n) => !String(n.id).startsWith("fallback-"));

    try {
      await Promise.all(
        firestoreBacked.map((n) => deleteDoc(doc(db, "notifications", n.id)).catch(() => null))
      );
    } catch (err) {
      console.error("Failed clearing all notifications:", err);
    }

    setNotifications([]);
    setUnreadCount(0);
    setShowNotificationMenu(false);
    setClearNotificationsToken((prev) => prev + 1);
  };

  const handleNotificationClick = async (notif) => {
    try {
      setShowProfileView(false);
      if (notif.formId) {
        navigate(`/forms/${notif.formId}`, { replace: true });
      }
      await clearAllNotifications();
    } catch (err) {
      console.error("Failed to open/remove notification:", err);
    }
  };

  const handleNotificationBellClick = async () => {
    if (showNotificationMenu) {
      await clearAllNotifications();
      return;
    }
    setShowNotificationMenu(true);
  };

  const handleNotificationMenuBackdropClick = async () => {
    await clearAllNotifications();
  };
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (showEditProfile) return;
    if (userMeta?.name) {
      const parts = userMeta.name.split(" ");
      setEditFirstName(parts.shift() || "");
      setEditLastName(parts.join(" ") || "");
    }
  }, [userMeta, showEditProfile]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const profileName = userMeta?.name || "User";
  const profileEmail = userMeta?.email || currentUser?.email || "";
  const profileAvatarSrc = userMeta?.photoURL || currentUser?.photoURL || "";
  const profileCoverSrc = userMeta?.coverURL || "";

  const initials = profileName
    .split(" ")
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  const getCoverStyle = () => {
    if (profileCoverSrc) {
      return {
        backgroundImage: `url(${profileCoverSrc})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      };
    }

    return {
      backgroundImage: "linear-gradient(135deg, rgba(101,113,255,1), rgba(102,209,209,0.9))",
    };
  };

  const openProfileView = () => {
    setShowProfileMenu(false);
    setShowEditProfile(false);
    setShowProfileView(true);
    setSelectedForm(null);
    if (userMeta?.role === "super_admin") setSuperAdminSection("dashboard");
  };

  const openEditProfile = () => {
    setShowProfileMenu(false);
    setShowProfileView(true);
    setShowEditProfile(true);

    const nameParts = (userMeta?.name || "").split(" ");
    setEditFirstName(nameParts.shift() || "");
    setEditLastName(nameParts.join(" ") || "");
    setEditEmail(userMeta?.email || currentUser?.email || "");
    setEditJoined(userMeta?.joined || "");
    setEditLives(userMeta?.lives || "");
    setEditWebsite(userMeta?.website || "");
    setEditAbout(userMeta?.about || "");
    setEditPhotoURL(userMeta?.photoURL || currentUser?.photoURL || "");
    setEditCoverURL(userMeta?.coverURL || "");
  };

  const LucideIcon = ({ name, className = "icon-md", style = {} }) => {
    useEffect(() => {
      if (window.lucide) {
        window.lucide.createIcons();
      }
    }, [name]);
    
    return (
      <span 
        className={`d-inline-flex align-items-center justify-content-center ${className}`}
        style={style}
        dangerouslySetInnerHTML={{ __html: `<i data-lucide="${name}" stroke-width="2"></i>` }}
      />
    );
  };

  useEffect(() => {
    if (!formId || !currentUser) {
      setSelectedForm(null);
      return;
    }

    const loadForm = async () => {
      setLoading(true);
      setShowProfileView(false);
      try {
        const ref = doc(db, "forms", formId);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          navigate("/", { replace: true });
          return;
        }

        const data = snap.data();
        if (userMeta?.role === "vendor_admin" && userMeta.vendorId && data.vendorId && data.vendorId !== userMeta.vendorId) {
          console.warn("Access denied: vendor mismatch");
          navigate("/", { replace: true });
          return;
        }

        setSelectedForm({ formId: snap.id, ...data });
      } catch (error) {
        console.error("Error loading form:", error);
        navigate("/", { replace: true });
      } finally {
        setLoading(false);
      }
    };

    loadForm();
  }, [formId, currentUser, userMeta, navigate]);

  const handleSelectForm = (form) => {
    setShowProfileView(false);
    if (form) {
      setSuperAdminSection("dashboard");
      navigate(`/forms/${form.formId}`, { replace: true });
    } else {
      if (userMeta?.role === "super_admin") setSuperAdminSection("dashboard");
      navigate("/", { replace: true });
    }
  };

  const handleFormUpdated = (updates) => {
    setSelectedForm((prev) => (prev ? { ...prev, ...updates } : null));
  };

  const handleSelectAdminSection = (section) => {
    setShowProfileView(false);
    setSelectedForm(null);
    setSuperAdminSection(section);
    navigate("/", { replace: true });
  };

  const handleImageUpload = async (file, type) => {
    if (!file) return;
    const isPhoto = type === "photo";
    
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File is too large (max 10MB)");
      return;
    }

    try {
      if (isPhoto) setIsUploadingPhoto(true);
      else setIsUploadingCover(true);

      console.log(`Starting ${type} upload to Cloudinary...`);
      
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`);
      }

      const data = await response.json();
      console.log(`${type} uploaded successfully to Cloudinary:`, data.url);

      if (isPhoto) setEditPhotoURL(data.url);
      else setEditCoverURL(data.url);
      
      toast.success(`${type} uploaded! Remember to save changes.`, { icon: "📸" });
    } catch (err) {
      console.error(`${type} upload error:`, err);
      toast.error(`${type} upload failed. Check your Cloudinary config.`);
    } finally {
      if (isPhoto) setIsUploadingPhoto(false);
      else setIsUploadingCover(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      await updateUserMeta({
        name: `${editFirstName} ${editLastName}`.trim(),
        email: editEmail,
        joined: editJoined,
        lives: editLives,
        website: editWebsite,
        about: editAbout,
        photoURL: editPhotoURL,
        coverURL: editCoverURL,
      });
      setShowEditProfile(false);
      toast.success("Profile updated successfully.", { position: "top-right" });
    } catch (err) {
      console.error("Update profile failed:", err);
      toast.error("Profile update failed. Please try again.", { position: "top-right" });
    }
  };

  return (
    <div className="main-wrapper">
      <Sidebar
        onSelectForm={handleSelectForm}
        selectedForm={selectedForm}
        onClearAllNotifications={clearAllNotifications}
        clearNotificationsToken={clearNotificationsToken}
        onSelectAdminSection={handleSelectAdminSection}
        activeAdminSection={superAdminSection}
      />
      <div className="page-wrapper">
        <nav className="navbar" style={{ zIndex: 1000 }}>
          <div className="navbar-content">
            <div className="logo-mini-wrapper">
            </div>
            <form 
              className="search-form flex-grow-1 mx-4 d-none d-md-block" 
              style={{ maxWidth: '600px' }}
              onSubmit={(e) => e.preventDefault()}
            >
              <style>
                {`
                  .custom-search-input:focus {
                    box-shadow: none !important;
                  }
                  .input-group:focus-within {
                    border-color: #e9ecef !important;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05) !important;
                    transition: all 0.2s ease-in-out;
                  }
                `}
              </style>
              <div className="input-group shadow-none border rounded-pill overflow-hidden bg-white">
                <div className="input-group-text border-0 bg-transparent ps-3">
                  <LucideIcon name="search" className="icon-sm text-secondary" />
                </div>
                <input 
                  type="text" 
                  className="form-control border-0 bg-transparent fs-14px py-2 shadow-none custom-search-input" 
                  id="navbarForm" 
                  placeholder="Search submissions, forms..." 
                  value={globalSearchQuery}
                  onChange={(e) => setGlobalSearchQuery(e.target.value)}
                />
              </div>
            </form>
            <ul className="navbar-nav ms-auto flex-row align-items-center">

              <li className="nav-item me-3">
                <button 
                  className="nav-link p-0 d-flex align-items-center border-0 bg-transparent shadow-none" 
                  title="Messages" 
                  type="button"
                >
                  <LucideIcon name="mail" className="icon-md" />
                </button>
              </li>
              <li className="nav-item me-3 d-none d-md-block">
                <button 
                  className="nav-link p-0 border-0 bg-transparent shadow-none" 
                  title={theme === 'light' ? "Dark Mode" : "Light Mode"}
                  onClick={() => toggleTheme()}
                  type="button"
                >
                  <LucideIcon name={theme === 'light' ? "moon" : "sun"} className="icon-md" />
                </button>
              </li>
              <li className="nav-item me-3 dropdown px-0" style={{ position: 'relative' }}>
                <button 
                  className="nav-link position-relative p-0 d-flex align-items-center border-0 bg-transparent shadow-none" 
                  title="Notifications" 
                  onClick={handleNotificationBellClick}
                  type="button"
                >
                  <LucideIcon name="bell" className="icon-md" />
                  {unreadCount > 0 && (
                    <span
                      className="position-absolute badge rounded-pill bg-success text-white"
                      style={{ top: "-6px", right: "-10px", fontSize: "10px", minWidth: "18px" }}
                    >
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>
                {showNotificationMenu && (
                  <>
                    <div className="dropdown-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1099 }} onClick={handleNotificationMenuBackdropClick}></div>
                    <div className="dropdown-menu show dropdown-menu-end p-0 shadow-lg border-0 animate-fadeIn" style={{ position: 'absolute', top: '50px', right: '-10px', width: '320px', zIndex: 1100, backgroundColor: 'var(--bs-body-bg)', borderRadius: '12px', border: '1px solid var(--bs-border-color)' }}>
                      <div className="p-3 border-bottom d-flex align-items-center justify-content-between bg-body-tertiary rounded-top">
                        <div className="d-flex align-items-center">
                          <LucideIcon name="bell" className="icon-sm me-2 text-primary" />
                          <h6 className="mb-0 fw-bold">Notifications</h6>
                        </div>
                        <span className="badge bg-success text-white rounded-pill small px-2 py-1" style={{ fontSize: "10px" }}>
                          {unreadCount} New
                        </span>
                      </div>
                      <div className="px-3 py-2 border-bottom bg-body-tertiary">
                        <span className="small text-muted">
                          Total: <strong>{notifications.length}</strong>
                        </span>
                      </div>
                      <div className="p-0" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                        {notifications.length === 0 ? (
                          <div className="p-4 text-center">
                            <LucideIcon name="bell-off" className="text-secondary mb-2 opacity-50" style={{ width: '30px', height: '30px' }} />
                            <p className="small text-muted mb-0">No notifications yet</p>
                          </div>
                        ) : (
                          notifications.map(notif => (
                            <button
                              key={notif.id}
                              className="w-100 text-start p-3 border-bottom d-flex align-items-start border-0 bg-transparent"
                              style={{
                                transition: "background 0.2s",
                                background: notif.read ? "transparent" : "rgba(25, 135, 84, 0.10)",
                                borderLeft: notif.read ? "3px solid transparent" : "3px solid #198754",
                              }}
                              onClick={() => handleNotificationClick(notif)}
                              type="button"
                            >
                              <div className="bg-primary-subtle p-2 rounded-circle me-3">
                                <LucideIcon name="mail" className="icon-sm text-primary" />
                              </div>
                              <div className="flex-grow-1">
                                <p className="mb-0 fs-13px fw-bold text-body">{notif.formName}</p>
                                <p className="mb-1 fs-12px text-muted text-truncate" style={{ maxWidth: '180px' }}>{notif.dataSnippet}</p>
                                <p className="mb-0 fs-11px text-secondary">{notif.createdAt?.toDate ? notif.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now"}</p>
                                {!notif.read && <span className="position-absolute end-0 top-50 translate-middle-y me-3 bg-primary rounded-circle" style={{ width: '6px', height: '6px' }}></span>}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                      <div className="p-2 text-center border-top">
                        <button
                          className="btn btn-link text-primary fs-12px fw-bold p-0 text-decoration-none"
                          onClick={clearAllNotifications}
                          type="button"
                        >
                          View all notifications
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </li>
              <li className="nav-item dropdown px-0" style={{ position: 'relative' }}>
                <button 
                  className="nav-link p-0 d-flex align-items-center border-0 bg-transparent shadow-none" 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowProfileMenu(!showProfileMenu);
                  }}
                  type="button"
                >
                  <div className="rounded-circle bg-primary-subtle d-flex align-items-center justify-content-center border" style={{ width: '38px', height: '38px', overflow: 'hidden' }}>
                    {profileAvatarSrc ? (
                      <img src={profileAvatarSrc} alt="profile" className="w-100 h-100 object-fit-cover" />
                    ) : (
                      <LucideIcon name="user" className="icon-sm text-primary" />
                    )}
                  </div>
                </button>
                {showProfileMenu && (
                  <>
                    <div 
                      className="dropdown-backdrop" 
                      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1099 }} 
                      onClick={() => setShowProfileMenu(false)}
                    ></div>
                    <div 
                      className="dropdown-menu show dropdown-menu-end p-0 shadow-lg border-0 animate-fadeIn" 
                      style={{ 
                        position: 'absolute', 
                        top: '50px', 
                        right: '0', 
                        width: '280px',
                        zIndex: 1100,
                        backgroundColor: 'var(--bs-body-bg)',
                        borderRadius: '12px',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.1) !important',
                        border: '1px solid var(--bs-border-color)'
                      }}
                    >
                      <div className="p-4 border-bottom text-center bg-body-tertiary rounded-top">
                        <div className="mb-3 d-inline-block">
                          <div className="rounded-circle bg-primary-subtle d-flex align-items-center justify-content-center border border-4 border-body shadow-sm mx-auto" style={{ width: '80px', height: '80px', overflow: 'hidden' }}>
                            {profileAvatarSrc ? (
                              <img src={profileAvatarSrc} alt="profile" className="w-100 h-100 object-fit-cover" />
                            ) : (
                              <LucideIcon name="user" style={{ width: '40px', height: '40px' }} className="text-primary" />
                            )}
                          </div>
                        </div>
                        <h6 className="fw-bold mb-1 text-body">{userMeta?.name || "User"}</h6>
                        <p className="small text-muted mb-0">{currentUser?.email}</p>
                        <div className="badge bg-primary-subtle text-primary mt-2 px-3 rounded-pill text-uppercase" style={{ fontSize: '10px', letterSpacing: '0.5px' }}>
                          {userMeta?.role?.replace('_', ' ') || "Admin"}
                        </div>
                      </div>
                      <div className="p-2">
                        <button
                          className="dropdown-item py-2 px-3 rounded d-flex align-items-center border-0 bg-transparent w-100 mb-1"
                          onClick={() => openProfileView()}
                          type="button"
                        >
                          <LucideIcon name="user" className="icon-sm me-3 text-secondary" />
                          <span className="fs-14px fw-medium">Profile</span>
                        </button>
                        <button 
                          className="dropdown-item py-2 px-3 rounded d-flex align-items-center border-0 bg-transparent w-100 mb-1"
                          onClick={() => openEditProfile()}
                          type="button"
                        >
                          <LucideIcon name="settings" className="icon-sm me-3 text-secondary" />
                          <span className="fs-14px fw-medium">Edit Profile</span>
                        </button>
                        <button 
                          className="dropdown-item py-2 px-3 rounded d-flex align-items-center border-0 bg-transparent w-100"
                          onClick={async () => {
                            try {
                              toast.success("Goodbye! Signed out successfully.", { position: 'top-right' });
                              await logout();
                              navigate('/login');
                            } catch (err) {
                              console.error("Logout failed:", err);
                            }
                          }}
                        >
                          <LucideIcon name="log-out" className="icon-sm me-3 text-danger" />
                          <span className="fs-14px fw-medium text-danger">Log Out</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </li>
            </ul>
            <button 
              className="sidebar-toggler border-0 bg-transparent shadow-none" 
              type="button"
              style={{ color: '#7987a1', marginLeft: '15px' }} 
              onClick={() => {
                document.body.classList.toggle('sidebar-folded');
              }}
            >
              <LucideIcon name="menu" className="icon-md" />
            </button>
          </div>
        </nav>

        <div className="page-content container-xxl">
          {loading ? (
            <div className="d-flex align-items-center justify-content-center h-100 py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : showProfileView ? (
            <div className="py-3">
              <div className="row">
                <div className="col-12 grid-margin">
                  <div className="card">
                    <div className="position-relative">
                      <figure className="overflow-hidden mb-0 d-flex justify-content-center">
                        <div
                          className="w-100 rounded-top"
                          style={{ height: 180, ...getCoverStyle() }}
                          aria-label="Profile cover"
                        />
                      </figure>

                      <div className="d-flex justify-content-between align-items-center position-absolute top-90 w-100 px-2 px-md-4 mt-n4">
                        <div className="d-flex align-items-center">
                          <div
                            className="w-70px rounded-circle overflow-hidden border border-3 border-body bg-white d-flex align-items-center justify-content-center"
                            style={{ width: 70, height: 70 }}
                            aria-label="Profile photo"
                          >
                            {profileAvatarSrc ? (
                              <img
                                src={profileAvatarSrc}
                                alt="profile"
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              />
                            ) : (
                              <span className="fw-bold text-secondary">{initials || "U"}</span>
                            )}
                          </div>
                          <span className="h4 ms-3 mb-0 text-white fw-bold" style={{ textShadow: "0 2px 4px rgba(0,0,0,0.3)" }}>{profileName}</span>
                        </div>

                        <div className="d-none d-md-block">
                          <button
                            className="btn btn-primary d-inline-flex align-items-center"
                            type="button"
                            onClick={openEditProfile}
                          >
                            <LucideIcon name="edit" className="icon-sm me-2" />
                            <span>Edit profile</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="d-flex justify-content-center p-3 rounded-bottom border-top bg-white">
                      <ul className="d-flex align-items-center m-0 p-0" style={{ listStyle: "none" }}>
                        <li className="d-flex align-items-center mx-3">
                          <LucideIcon name="columns" className="me-1 icon-md text-primary" />
                          <button type="button" className="pt-1px d-none d-md-block text-primary fw-bold border-0 bg-transparent" onClick={(e) => e.preventDefault()}>
                            Timeline
                          </button>
                        </li>
                        <li className="d-flex align-items-center mx-3 ps-3 border-start">
                          <LucideIcon name="user" className="me-1 icon-md text-secondary" />
                          <button type="button" className="pt-1px d-none d-md-block text-secondary border-0 bg-transparent" onClick={(e) => e.preventDefault()}>
                            About
                          </button>
                        </li>
                        <li className="d-flex align-items-center mx-3 ps-3 border-start">
                          <LucideIcon name="users" className="me-1 icon-md text-secondary" />
                          <button type="button" className="pt-1px d-none d-md-block text-secondary border-0 bg-transparent" onClick={(e) => e.preventDefault()}>
                            Friends <span className="text-muted small ms-1">3,765</span>
                          </button>
                        </li>
                        <li className="d-flex align-items-center mx-3 ps-3 border-start">
                          <LucideIcon name="image" className="me-1 icon-md text-secondary" />
                          <button type="button" className="pt-1px d-none d-md-block text-secondary border-0 bg-transparent" onClick={(e) => e.preventDefault()}>
                            Photos
                          </button>
                        </li>
                        <li className="d-flex align-items-center mx-3 ps-3 border-start">
                          <LucideIcon name="video" className="me-1 icon-md text-secondary" />
                          <button type="button" className="pt-1px d-none d-md-block text-secondary border-0 bg-transparent" onClick={(e) => e.preventDefault()}>
                            Videos
                          </button>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="row profile-body">
                <div className="d-none d-md-block col-md-4 col-xl-3 left-wrapper">
                  <div className="card rounded">
                    <div className="card-body">
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <h6 className="card-title mb-0">About</h6>
                      </div>

                      <p>
                        {userMeta?.about
                          ? userMeta.about
                          : "Hi! Update your profile details, and they will appear here."}
                      </p>

                      <div className="mt-3">
                        <label className="fs-11px fw-bolder mb-0 text-uppercase">Joined:</label>
                        <p className="text-secondary">{userMeta?.joined || "—"}</p>
                      </div>
                      <div className="mt-3">
                        <label className="fs-11px fw-bolder mb-0 text-uppercase">Lives:</label>
                        <p className="text-secondary">{userMeta?.lives || "—"}</p>
                      </div>
                      <div className="mt-3">
                        <label className="fs-11px fw-bolder mb-0 text-uppercase">Email:</label>
                        <p className="text-secondary">{profileEmail || "—"}</p>
                      </div>
                      <div className="mt-3">
                        <label className="fs-11px fw-bolder mb-0 text-uppercase">Website:</label>
                        <p className="text-secondary">{userMeta?.website || "—"}</p>
                      </div>

                      <div className="mt-3 d-flex social-links" aria-label="Social links">
                        <button type="button" className="btn btn-icon border btn-xs me-2" onClick={(e) => e.preventDefault()}>
                          <LucideIcon name="github" className="icon-md" />
                        </button>
                        <button type="button" className="btn btn-icon border btn-xs me-2" onClick={(e) => e.preventDefault()}>
                          <LucideIcon name="twitter" className="icon-md" />
                        </button>
                        <button type="button" className="btn btn-icon border btn-xs me-2" onClick={(e) => e.preventDefault()}>
                          <LucideIcon name="instagram" className="icon-md" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-md-8 col-xl-6 middle-wrapper">
                  <div className="row">
                    <div className="col-md-12 grid-margin">
                      <div className="card rounded">
                        <div className="card-header">
                          <div className="d-flex align-items-center justify-content-between">
                            <div className="d-flex align-items-center">
                              <div
                                className="img-xs rounded-circle overflow-hidden bg-body d-flex align-items-center justify-content-center"
                                style={{ width: 38, height: 38 }}
                              >
                                {profileAvatarSrc ? (
                                  <img
                                    src={profileAvatarSrc}
                                    alt=""
                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                  />
                                ) : (
                                  <span className="fw-bold text-secondary">{initials || "U"}</span>
                                )}
                              </div>
                              <div className="ms-2">
                                <p className="mb-0">{profileName}</p>
                                <p className="fs-11px text-secondary mb-0">Profile</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="card-body">
                          <p className="mb-3 fs-14px">
                            {userMeta?.about
                              ? userMeta.about
                              : "This is your profile space. Click “Edit profile” to update all your details."}
                          </p>
                          <div
                            className="img-fluid rounded"
                            style={{ height: 190, background: "rgba(101,113,255,0.10)" }}
                          />
                        </div>
                        <div className="card-footer">
                          <div className="d-flex post-actions">
                            <button type="button" className="d-flex align-items-center text-secondary me-4" onClick={(e) => e.preventDefault()}>
                              <LucideIcon name="heart" className="icon-md" />
                              <p className="d-none d-md-block ms-2">Like</p>
                            </button>
                            <button type="button" className="d-flex align-items-center text-secondary me-4" onClick={(e) => e.preventDefault()}>
                              <LucideIcon name="message-square" className="icon-md" />
                              <p className="d-none d-md-block ms-2">Comment</p>
                            </button>
                            <button type="button" className="d-flex align-items-center text-secondary" onClick={(e) => e.preventDefault()}>
                              <LucideIcon name="share" className="icon-md" />
                              <p className="d-none d-md-block ms-2">Share</p>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="d-none d-xl-block col-xl-3">
                  <div className="row">
                    <div className="col-md-12 grid-margin">
                      <div className="card rounded">
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : userMeta?.role === "super_admin" && !selectedForm ? (
            superAdminSection === "users" ? (
              <div className="py-3">
                <AdminUsersTable searchQuery={globalSearchQuery} />
              </div>
            ) : superAdminSection === "forms" ? (
              <div className="py-3">
                <AdminFormsTable searchQuery={globalSearchQuery} />
              </div>
            ) : (
              <div className="py-3">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-4">
                  <div>
                    <h4 className="mb-1 fw-bold">Super Admin Dashboard</h4>
                    <p className="text-muted mb-0 fs-14px">Global platform snapshot across users, folders, and forms.</p>
                  </div>
                  <span className="badge bg-primary-subtle text-primary px-3 py-2 rounded-pill text-uppercase" style={{ letterSpacing: "0.4px" }}>
                    Live Metrics
                  </span>
                </div>

                <div className="row g-3">
                  <div className="col-md-4">
                    <div 
                      className="card border-0 shadow-sm h-100" 
                      role="button" 
                      style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
                      onClick={() => handleSelectAdminSection("users")}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-5px)';
                        e.currentTarget.style.boxShadow = '0 10px 20px rgba(0,0,0,0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div className="card-body p-4">
                        <div className="d-flex align-items-center justify-content-between mb-3">
                          <span className="text-muted fw-semibold fs-14px">Total Vendors</span>
                          <span className="rounded-circle bg-primary-subtle d-inline-flex align-items-center justify-content-center" style={{ width: "40px", height: "40px" }}>
                            <LucideIcon name="users" className="icon-sm text-primary" />
                          </span>
                        </div>
                        <h2 className="fw-bold mb-1">{metricsLoading ? "..." : superAdminMetrics.users.toLocaleString()}</h2>
                        <p className="text-muted mb-0 fs-12px">All registered vendor accounts</p>
                      </div>
                    </div>
                  </div>

                  <div className="col-md-4">
                    <div 
                      className="card border-0 shadow-sm h-100" 
                      role="button" 
                      style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
                      onClick={() => handleSelectAdminSection("forms")}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-5px)';
                        e.currentTarget.style.boxShadow = '0 10px 20px rgba(0,0,0,0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div className="card-body p-4">
                        <div className="d-flex align-items-center justify-content-between mb-3">
                          <span className="text-muted fw-semibold fs-14px">Total Forms</span>
                          <span className="rounded-circle bg-success-subtle d-inline-flex align-items-center justify-content-center" style={{ width: "40px", height: "40px" }}>
                            <LucideIcon name="file-text" className="icon-sm text-success" />
                          </span>
                        </div>
                        <h2 className="fw-bold mb-1">{metricsLoading ? "..." : superAdminMetrics.forms.toLocaleString()}</h2>
                        <p className="text-muted mb-0 fs-12px">Published and draft forms combined</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          ) : (
            <FormDetails form={selectedForm} onFormUpdated={handleFormUpdated} searchQuery={globalSearchQuery} />
          )}
        </div>
      </div>

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1200 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header">
                <h5 className="modal-title">Edit Profile</h5>
                <button type="button" className="btn-close" onClick={() => setShowEditProfile(false)}></button>
              </div>
              <form onSubmit={handleUpdateProfile}>
                <div className="modal-body p-4">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label fw-bold">Photo URL</label>
                      <input
                        type="text"
                        className="form-control"
                        value={editPhotoURL}
                        onChange={(e) => setEditPhotoURL(e.target.value)}
                        placeholder="Paste image URL or click below to upload"
                      />
                      <input
                        type="file"
                        className="d-none"
                        ref={photoInputRef}
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e.target.files[0], "photo")}
                      />
                      <div className="mt-2 d-flex align-items-center">
                        <div
                          className="rounded-circle overflow-hidden border d-flex align-items-center justify-content-center position-relative cursor-pointer hover-opacity"
                          style={{ width: 44, height: 44, background: "rgba(0,0,0,0.04)", cursor: "pointer" }}
                          onClick={() => photoInputRef.current?.click()}
                          title="Click to upload photo"
                        >
                          {isUploadingPhoto ? (
                            <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
                          ) : editPhotoURL ? (
                            <img
                              src={editPhotoURL}
                              alt="profile"
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          ) : (
                            <span className="fw-bold text-secondary">{initials || "U"}</span>
                          )}
                        </div>
                        <span className="ms-2 small text-muted">Click image to upload or paste URL above</span>
                      </div>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label fw-bold">Cover URL</label>
                      <input
                        type="text"
                        className="form-control"
                        value={editCoverURL}
                        onChange={(e) => setEditCoverURL(e.target.value)}
                        placeholder="Paste cover URL or click upload"
                      />
                      <input
                        type="file"
                        className="d-none"
                        ref={coverInputRef}
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e.target.files[0], "cover")}
                      />
                      <div className="mt-2">
                         <button 
                           type="button" 
                           className="btn btn-outline-primary btn-xs"
                           onClick={() => coverInputRef.current?.click()}
                           disabled={isUploadingCover}
                         >
                           {isUploadingCover ? "Uploading..." : "Upload Cover Image"}
                         </button>
                      </div>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label fw-bold">First Name</label>
                      <input
                        type="text"
                        className="form-control"
                        value={editFirstName}
                        onChange={(e) => setEditFirstName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label fw-bold">Last Name</label>
                      <input
                        type="text"
                        className="form-control"
                        value={editLastName}
                        onChange={(e) => setEditLastName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label fw-bold">Email</label>
                      <input
                        type="email"
                        className="form-control"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label fw-bold">Joined</label>
                      <input
                        type="text"
                        className="form-control"
                        value={editJoined}
                        onChange={(e) => setEditJoined(e.target.value)}
                        placeholder="e.g., November 15, 2015"
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label fw-bold">Lives</label>
                      <input
                        type="text"
                        className="form-control"
                        value={editLives}
                        onChange={(e) => setEditLives(e.target.value)}
                        placeholder="e.g., New York, USA"
                      />
                    </div>

                    <div className="col-md-12">
                      <label className="form-label fw-bold">Website</label>
                      <input
                        type="text"
                        className="form-control"
                        value={editWebsite}
                        onChange={(e) => setEditWebsite(e.target.value)}
                        placeholder="e.g., www.nobleui.com"
                      />
                    </div>

                    <div className="col-md-12">
                      <label className="form-label fw-bold">About</label>
                      <textarea
                        className="form-control"
                        rows={4}
                        value={editAbout}
                        onChange={(e) => setEditAbout(e.target.value)}
                        placeholder="Write something about yourself..."
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-top-0 pt-0">
                  <button type="button" className="btn btn-light px-4" onClick={() => setShowEditProfile(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary px-4">Save Changes</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
