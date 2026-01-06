import { collection, onSnapshot } from "firebase/firestore";
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

  // Fetch forms from Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "forms"), (snap) => {
      const arr = [];
      snap.forEach((d) => arr.push(d.data()));
      setForms(arr);
    });
    return () => unsub();
  }, []);

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

      <div className="px-6">
        <button
          onClick={() => setShowPopup(true)}
          className="w-full text-left text-sm font-semibold text-gray-800 bg-gray-200 hover:bg-gray-300 transition-colors px-4 py-3 rounded-2xl flex items-center gap-2"
        >
          <span>+</span>
          <span>Create...</span>
        </button>

        <button
          onClick={() => onSelectForm(null)}
          className={`mt-4 w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-colors ${homeActive
            ? "bg-blue-500 text-black shadow"
            : "text-gray-800 hover:bg-gray-200"
            }`}
        >
          <span className={`w-2 h-2 rounded-full ${homeActive ? "bg-blue-600" : "bg-gray-400"}`}></span>
          Home
        </button>


        <div className="mt-6">
          <button
            onClick={() => setIsAllExpanded((v) => !v)}
            className="w-full flex items-center justify-between text-sm font-semibold text-gray-700"
          >
            <span>Uncategorized</span>
            <span className="text-xs text-gray-900">{isAllExpanded ? "⌄" : "▶"}</span>
          </button>

          {isAllExpanded && (
            <div className="mt-2 pl-3 flex flex-col gap-1.5">
              {forms.length === 0 && (
                <p className="text-xs text-gray-500 px-2 py-1">No forms yet</p>
              )}
              {forms.map((f) => {
                const isSelected = selectedForm?.formId === f.formId;
                return (
                  <button
                    key={f.formId}
                    onClick={() => onSelectForm(f)}
                    className={`text-left text-sm px-3 py-2 rounded-xl transition-colors ${isSelected
                      ? "bg-gray-300 text-black"
                      : "text-gray-700 hover:bg-gray-100"
                      }`}
                  >
                    {f.name}
                  </button>
                );
              })}
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
