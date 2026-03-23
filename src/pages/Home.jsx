import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getDoc, doc, collection, onSnapshot, query, where, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import FormDetails from "../components/FormDetails.jsx";
import Sidebar from "../components/Sidebar.jsx";
import toast from "react-hot-toast";

export default function Home() {
  const { formId } = useParams();
  const navigate = useNavigate();
  const [selectedForm, setSelectedForm] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [showNotificationMenu, setShowNotificationMenu] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { currentUser, userMeta, logout, updateUserMeta } = useAuth();
  const notificationFormUnsubsRef = useRef({});
  const initializedNotificationListenersRef = useRef({});

  // Live notifications from new submissions across all accessible forms
  useEffect(() => {
    if (!currentUser) return;

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

        // Remove stale listeners
        Object.keys(notificationFormUnsubsRef.current).forEach((trackedFormId) => {
          if (!formIds.has(trackedFormId)) {
            notificationFormUnsubsRef.current[trackedFormId]();
            delete notificationFormUnsubsRef.current[trackedFormId];
            delete initializedNotificationListenersRef.current[trackedFormId];
          }
        });

        // Add listeners for each form submissions
        formIds.forEach((trackedFormId) => {
          if (notificationFormUnsubsRef.current[trackedFormId]) return;

          const submissionsRef = collection(db, `forms/${trackedFormId}/submissions`);
          const submissionsQuery = query(submissionsRef, orderBy("submittedAt", "desc"));

          notificationFormUnsubsRef.current[trackedFormId] = onSnapshot(
            submissionsQuery,
            (submissionsSnap) => {
              if (!initializedNotificationListenersRef.current[trackedFormId]) {
                initializedNotificationListenersRef.current[trackedFormId] = true;
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
                  id: `local-${trackedFormId}-${change.doc.id}-${Date.now()}-${Math.random()}`,
                  formId: trackedFormId,
                  formName: formNameById[trackedFormId] || trackedFormId,
                  dataSnippet: String(snippet),
                  createdAt: submission.submittedAt || new Date(),
                  read: false,
                  isLocal: true,
                };
              });

              setNotifications((prev) => [...fresh, ...prev].slice(0, 20));
              setUnreadCount((prev) => prev + fresh.length);
            },
            (err) => {
              console.error(`Submission listener error for form ${trackedFormId}:`, err);
            }
          );
        });
      },
      (err) => {
        console.error("Forms listener error for notifications:", err);
      }
    );

    return () => {
      formsUnsub();
      Object.values(notificationFormUnsubsRef.current).forEach((unsub) => unsub());
      notificationFormUnsubsRef.current = {};
      initializedNotificationListenersRef.current = {};
    };
  }, [currentUser, userMeta]);

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  // Initialize and update theme
  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Sync editName with userMeta
  useEffect(() => {
    if (userMeta?.name) setEditName(userMeta.name);
  }, [userMeta]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Helper component to render Lucide icons safely in React
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

  // Load form from URL parameter
  useEffect(() => {
    if (!formId || !currentUser) {
      setSelectedForm(null);
      return;
    }

    const loadForm = async () => {
      setLoading(true);
      try {
        const ref = doc(db, "forms", formId);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          navigate("/", { replace: true });
          return;
        }

        const data = snap.data();

        // Vendor access control
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
    if (form) {
      navigate(`/forms/${form.formId}`, { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      await updateUserMeta({ name: editName });
      setShowEditProfile(false);
    } catch (err) {
      console.error("Update profile failed:", err);
    }
  };

  return (
    <div className="main-wrapper">
      <Sidebar onSelectForm={handleSelectForm} selectedForm={selectedForm} />
      <div className="page-wrapper">
        <nav className="navbar" style={{ zIndex: 1000 }}>
          <div className="navbar-content">
            <div className="logo-mini-wrapper">
            </div>
            <form className="search-form flex-grow-1 mx-4 d-none d-md-block" style={{ maxWidth: '600px' }}>
              <div className="input-group shadow-none border rounded-pill overflow-hidden bg-body-tertiary">
                <div className="input-group-text border-0 bg-transparent ps-3">
                  <LucideIcon name="search" className="icon-sm text-secondary" />
                </div>
                <input 
                  type="text" 
                  className="form-control border-0 bg-transparent fs-14px py-2" 
                  id="navbarForm" 
                  placeholder="Search submissions, forms..." 
                />
              </div>
            </form>
            <ul className="navbar-nav ms-auto flex-row align-items-center">
              <li className="nav-item me-3">
                <button 
                  className="nav-link p-0 d-flex align-items-center border-0 bg-transparent shadow-none" 
                  title="Apps" 
                  type="button"
                >
                  <LucideIcon name="grid-2x2" className="icon-md" />
                </button>
              </li>
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
                  onClick={() => {
                    setShowNotificationMenu(!showNotificationMenu);
                    if (!showNotificationMenu) markAllAsRead();
                  }}
                  type="button"
                >
                  <LucideIcon name="bell" className="icon-md" />
                  {unreadCount > 0 && (
                    <span className="position-absolute translate-middle-y translate-middle-x bg-primary border border-2 border-body rounded-circle" style={{ top: '8px', right: '-4px', width: '9px', height: '9px' }}></span>
                  )}
                </button>
                {showNotificationMenu && (
                  <>
                    <div className="dropdown-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1099 }} onClick={() => setShowNotificationMenu(false)}></div>
                    <div className="dropdown-menu show dropdown-menu-end p-0 shadow-lg border-0 animate-fadeIn" style={{ position: 'absolute', top: '50px', right: '-10px', width: '320px', zIndex: 1100, backgroundColor: 'var(--bs-body-bg)', borderRadius: '12px', border: '1px solid var(--bs-border-color)' }}>
                      <div className="p-3 border-bottom d-flex align-items-center justify-content-between bg-body-tertiary rounded-top">
                        <div className="d-flex align-items-center">
                          <LucideIcon name="bell" className="icon-sm me-2 text-primary" />
                          <h6 className="mb-0 fw-bold">Notifications</h6>
                        </div>
                        <span className="badge bg-primary text-white rounded-pill small px-2 py-1" style={{ fontSize: '10px' }}>{unreadCount} New</span>
                      </div>
                      <div className="p-0" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                        {notifications.length === 0 ? (
                          <div className="p-4 text-center">
                            <LucideIcon name="bell-off" className="text-secondary mb-2 opacity-50" style={{ width: '30px', height: '30px' }} />
                            <p className="small text-muted mb-0">No notifications yet</p>
                          </div>
                        ) : (
                          notifications.map(notif => (
                            <div key={notif.id} className="p-3 border-bottom d-flex align-items-start hover-bg-light cursor-pointer" style={{ transition: 'background 0.2s' }}>
                              <div className="bg-primary-subtle p-2 rounded-circle me-3">
                                <LucideIcon name="mail" className="icon-sm text-primary" />
                              </div>
                              <div className="flex-grow-1">
                                <p className="mb-0 fs-13px fw-bold text-body">{notif.formName}</p>
                                <p className="mb-1 fs-12px text-muted text-truncate" style={{ maxWidth: '180px' }}>{notif.dataSnippet}</p>
                                <p className="mb-0 fs-11px text-secondary">{notif.createdAt?.toDate ? notif.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now"}</p>
                                {!notif.read && <span className="position-absolute end-0 top-50 translate-middle-y me-3 bg-primary rounded-circle" style={{ width: '6px', height: '6px' }}></span>}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="p-2 text-center border-top">
                        <button className="btn btn-link text-primary fs-12px fw-bold p-0 text-decoration-none">View all notifications</button>
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
                     <LucideIcon name="user" className="icon-sm text-primary" />
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
                          <div className="rounded-circle bg-primary-subtle d-flex align-items-center justify-content-center border border-4 border-body shadow-sm mx-auto" style={{ width: '80px', height: '80px' }}>
                             <LucideIcon name="user" style={{ width: '40px', height: '40px' }} className="text-primary" />
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
                          onClick={() => {
                            setShowProfileMenu(false);
                            setShowEditProfile(true);
                          }}
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
          ) : (
            <FormDetails form={selectedForm} />
          )}
        </div>
      </div>

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1200 }}>
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header">
                <h5 className="modal-title">Edit Profile</h5>
                <button type="button" className="btn-close" onClick={() => setShowEditProfile(false)}></button>
              </div>
              <form onSubmit={handleUpdateProfile}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label fw-bold">Full Name</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-bold">Email</label>
                    <input 
                      type="email" 
                      className="form-control" 
                      value={currentUser?.email} 
                      disabled 
                    />
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
