import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import AddFormPopup from "./AddFormPopup.jsx";

export default function Sidebar({ onSelectForm, selectedForm }) {
  const [showPopup, setShowPopup] = useState(false);
  const [forms, setForms] = useState([]);
  const [folders, setFolders] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState({});
  const [showLogoutMenu, setShowLogoutMenu] = useState(false);
  const { currentUser, logout } = useAuth();

  // Close logout menu when clicking outside
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

    const unsubForms = onSnapshot(
      query(collection(db, "forms"), where("userId", "==", currentUser.uid)),
      (snap) => {
        const arr = [];
        snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
        setForms(arr);
      }
    );

    const unsubFolders = onSnapshot(
      query(collection(db, "folders"), where("userId", "==", currentUser.uid)),
      (snap) => {
        const arr = [];
        snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
        setFolders(arr);
        // Auto-expand all folders by default
        const expanded = {};
        snap.forEach((d) => {
          expanded[d.id] = true;
        });
        setExpandedFolders(expanded);
      }
    );

    return () => {
      unsubForms();
      unsubFolders();
    };
  }, [currentUser]);

  const toggleFolder = (folderId) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
  };

  const homeActive = !selectedForm;

  // Group forms by folder
  const formsByFolder = {};
  const uncategorizedForms = [];

  forms.forEach((form) => {
    if (form.folderId && folders.find((f) => f.id === form.folderId)) {
      if (!formsByFolder[form.folderId]) {
        formsByFolder[form.folderId] = [];
      }
      formsByFolder[form.folderId].push(form);
    } else {
      uncategorizedForms.push(form);
    }
  });

  return (
    <aside className="w-[250px] h-full bg-gray-100 rounded-3xl border border-gray-200 shadow-sm flex flex-col">
      <div className="px-6 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">Forms</h1>
      </div>

      <div className="px-6 flex-1 overflow-y-auto">
        <button
          onClick={() => setShowPopup(true)}
          className="w-full text-left text-sm font-semibold text-gray-800 bg-gray-200 hover:bg-gray-300 transition-colors px-4 py-3 rounded-2xl flex items-center gap-2"
        >
          <span>+</span>
          <span>Create...</span>
        </button>

        <button
          onClick={() => onSelectForm(null)}
          className={`mt-4 w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-colors ${
            homeActive
              ? "bg-purple-100 text-blue-900"
              : "text-gray-800 hover:bg-gray-200"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${homeActive ? "bg-blue-600" : "bg-gray-400"}`}></span>
          Home
        </button>

        {/* Folders */}
        <div className="mt-6 space-y-1">
          {folders.map((folder) => {
            const folderForms = formsByFolder[folder.id] || [];
            const isExpanded = expandedFolders[folder.id] !== false;

            return (
              <div key={folder.id} className="mb-2">
                <div className="flex items-center justify-between group">
                  <button
                    onClick={() => toggleFolder(folder.id)}
                    className="flex items-center gap-2 flex-1 text-left text-sm font-semibold text-gray-700 hover:text-gray-900 py-2"
                  >
                    <span className="text-xs">{isExpanded ? "⌄" : "▶"}</span>
                    <span>{folder.name}</span>
                  </button>
                  <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded">
                    <span className="text-gray-600 text-sm">⋯</span>
                  </button>
                </div>

                {isExpanded && (
                  <div className="ml-6 mt-1 flex flex-col gap-0.5">
                    {folderForms.length === 0 ? (
                      <p className="text-xs text-gray-400 px-2 py-1">No forms</p>
                    ) : (
                      folderForms.map((form) => {
                        const isSelected = selectedForm?.formId === form.formId;
                        return (
                          <button
                            key={form.formId}
                            onClick={() => onSelectForm(form)}
                            className={`text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                              isSelected
                                ? "bg-blue-600 text-white"
                                : "text-gray-700 hover:bg-gray-200"
                            }`}
                          >
                            {form.name}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Uncategorized Forms */}
          {uncategorizedForms.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-semibold text-gray-500 uppercase mb-2 px-2">
                Uncategorized
              </div>
              <div className="flex flex-col gap-0.5">
                {uncategorizedForms.map((form) => {
                  const isSelected = selectedForm?.formId === form.formId;
                  return (
                    <button
                      key={form.formId}
                      onClick={() => onSelectForm(form)}
                      className={`text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                        isSelected
                          ? "bg-blue-600 text-white"
                          : "text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {form.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {folders.length === 0 && uncategorizedForms.length === 0 && (
            <div className="mt-6 text-center">
              <p className="text-xs text-gray-400 px-2 py-4">No forms or folders yet</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-auto px-6 pb-6 pt-6 border-t border-gray-200 relative logout-menu-container">
        <div className="flex items-center justify-between pt-1 text-sm text-gray-700">
          <div className="flex items-center gap-3">
            <span>{currentUser?.email || "User"}</span>
          </div>
          <button
            onClick={() => setShowLogoutMenu(!showLogoutMenu)}
            className="p-1 hover:bg-gray-200 rounded-full transition-colors"
          >
            <span className="text-gray-600 text-sm">⋯</span>
          </button>
        </div>

        {showLogoutMenu && (
          <div className="absolute bottom-16 right-6 bg-white rounded-lg shadow-lg border border-gray-200 p-2 min-w-[120px] z-50">
            <button
              onClick={async () => {
                try {
                  await logout();
                  setShowLogoutMenu(false);
                } catch (error) {
                  console.error("Failed to logout:", error);
                }
              }}
              className="w-full text-left px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors text-sm font-semibold"
            >
              Logout
            </button>
          </div>
        )}
      </div>

      {showPopup && <AddFormPopup onClose={() => setShowPopup(false)} onSelectForm={onSelectForm} />}
    </aside>
  );
}
