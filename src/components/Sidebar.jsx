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

  // Fetch forms from Firestore for current user only
  useEffect(() => {
    if (!currentUser) return;
    
    const unsub = onSnapshot(
      query(collection(db, "forms"), where("userId", "==", currentUser.uid)), 
      (snap) => {
        const arr = [];
        snap.forEach((doc) => {
          arr.push({
            formId: doc.id,  // Document ID as formId
            ...doc.data()
          });
        });
        setForms(arr);
      }
    );
    return () => unsub();
  }, [currentUser]);

  // Fetch folders from Firestore for current user only
  useEffect(() => {
    if (!currentUser) return;
    
    const unsub = onSnapshot(
      query(collection(db, "folders"), where("userId", "==", currentUser.uid)), 
      (snap) => {
        const arr = [];
        snap.forEach((doc) => {
          arr.push({
            id: doc.id,  // Document ID as id
            ...doc.data()
          });
        });
        setFolders(arr);
      }
    );
    return () => unsub();
  }, [currentUser]);

  const homeActive = !selectedForm;

  // Debug logs
  useEffect(() => {
    console.log("Folders:", folders);
    console.log("Forms:", forms);
  }, [folders, forms]);

  // Group forms by folder
  const formsByFolder = {};
  
  forms.forEach((form) => {
    if (form.folderId) {
      // Check if folder exists
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

  console.log("Forms by folder:", formsByFolder);

  // Separate forms with and without folder
  const formsWithoutFolder = forms.filter(form => !form.folderId);

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
          className={`mt-4 w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-colors ${
            homeActive
              ? "bg-blue-500 text-black shadow"
              : "text-gray-800 hover:bg-gray-200"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${homeActive ? "bg-blue-600" : "bg-gray-400"}`}></span>
          Home
        </button>

        {/* Forms without folder */}
        {formsWithoutFolder.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Without Folder
            </h3>
            <div className="flex flex-col gap-1.5">
              {formsWithoutFolder.map((f) => {
                const isSelected = selectedForm?.formId === f.formId;
                return (
                  <button
                    key={f.formId}
                    onClick={() => onSelectForm(f)}
                    className={`text-left text-sm px-3 py-2 rounded-xl transition-colors ${
                      isSelected
                        ? "bg-gray-300 text-black"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {f.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Folders Section */}
        {folders.map((folder) => {
          const folderForms = formsByFolder[folder.id] || [];
          const isFolderExpanded = expandedFolders[folder.id];
          
          return (
            <div key={folder.id} className="mt-4">
              <button
                onClick={() => setExpandedFolders(prev => ({
                  ...prev,
                  [folder.id]: !isFolderExpanded
                }))}
                className="w-full flex items-center justify-between text-sm font-semibold text-gray-700 hover:bg-gray-200 px-2 py-1.5 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-xs">{isFolderExpanded ? "▼" : "▶"}</span>
                  <span>{folder.name}</span>
                </div>
                <span className="text-xs bg-gray-300 text-gray-700 px-2 py-0.5 rounded-full">
                  {folderForms.length}
                </span>
              </button>

              {isFolderExpanded && (
                <div className="mt-1 ml-4 pl-2 border-l border-gray-300 flex flex-col gap-1">
                  {folderForms.length === 0 ? (
                    <p className="text-xs text-gray-500 italic px-2 py-1">
                      No forms in this folder
                    </p>
                  ) : (
                    folderForms.map((f) => {
                      const isSelected = selectedForm?.formId === f.formId;
                      return (
                        <button
                          key={f.formId}
                          onClick={() => onSelectForm(f)}
                          className={`text-left text-sm px-3 py-2 rounded-xl transition-colors ${
                            isSelected
                              ? "bg-gray-300 text-black font-medium"
                              : "text-gray-700 hover:bg-gray-100"
                          }`}
                        >
                          {f.name}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
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