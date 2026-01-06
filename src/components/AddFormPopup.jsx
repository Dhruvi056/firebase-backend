import { collection, doc, serverTimestamp, setDoc, query, where } from "firebase/firestore";
import { useState, useEffect } from "react";
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
  const [timezone, setTimezone] = useState("");
  const [folders, setFolders] = useState([]);
  const { currentUser } = useAuth();

  // Fetch folders
  useEffect(() => {
    if (!currentUser) return;

    const unsub = onSnapshot(
      query(collection(db, "folders"), where("userId", "==", currentUser.uid)),
      (snap) => {
        const arr = [];
        snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
        setFolders(arr);
      }
    );
    return () => unsub();
  }, [currentUser]);

  const handleCreate = async () => {
    if (activeTab === "Form") {
      if (!formName.trim()) {
        alert("Please enter a form endpoint name");
        return;
      }

      const id = generateFormId();
      const formUrl = getFormUrl(id);

      const newForm = {
        name: formName.trim(),
        formId: id,
        url: formUrl,
        folderId: selectedFolder || null,
        timezone: timezone || null,
        userId: currentUser.uid,
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(collection(db, "forms"), id), newForm);

      if (onSelectForm) {
        onSelectForm({
          name: formName.trim(),
          formId: id,
          url: formUrl,
        });
      }
    } else {
      // Folder creation
      if (!folderName.trim()) {
        alert("Please enter a folder name");
        return;
      }

      const folderId = generateFormId();
      const newFolder = {
        name: folderName.trim(),
        folderId: folderId,
        userId: currentUser.uid,
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(collection(db, "folders"), folderId), newFolder);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center px-4 z-[100]">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-xl p-8 space-y-6 animate-fadeIn">

        {/* Header */}
        <h2 className="text-2xl font-semibold text-gray-900">Create...</h2>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("Form")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === "Form"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Form
          </button>
          <button
            onClick={() => setActiveTab("Folder")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === "Folder"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Folder
          </button>
        </div>

        {/* Form Tab Content */}
        {activeTab === "Form" && (
          <>
            <p className="text-sm text-gray-600">
              Add a descriptive name and set a timezone to create your form endpoint.
            </p>

            <div className="space-y-4">
              {/* Folder Dropdown */}
              {folders.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-2">
                    Folder
                  </label>
                  <select
                    value={selectedFolder}
                    onChange={(e) => setSelectedFolder(e.target.value)}
                    className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm text-gray-800 
                    focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
                  >
                    <option value="">Select Folder (Optional)</option>
                    {folders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Form Endpoint Name */}
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-2">
                  Form Endpoint Name
                </label>
                <input
                  type="text"
                  className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm text-gray-800 
                  placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Form Endpoint Name (e.g. job-application)"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>

              {/* Timezone Dropdown */}
              {/* <div>
                <label className="block text-sm font-medium text-gray-800 mb-2">
                  Timezone
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm text-gray-800 
                  focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
                >
                  <option value="">Select Timezone</option>
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">America/New_York (EST)</option>
                  <option value="America/Chicago">America/Chicago (CST)</option>
                  <option value="America/Denver">America/Denver (MST)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                  <option value="Europe/London">Europe/London (GMT)</option>
                  <option value="Europe/Paris">Europe/Paris (CET)</option>
                  <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                  <option value="Australia/Sydney">Australia/Sydney (AEST)</option>
                </select>
              </div> */}
            </div>
          </>
        )}

        {/* Folder Tab Content */}
        {activeTab === "Folder" && (
          <>
            <p className="text-sm text-gray-600">
              Enter a folder name.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-2">
                  Folder Name
                </label>
                <input
                  type="text"
                  className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm text-gray-800 
                  placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Folder Name (e.g. job-application)"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                />
              </div>
            </div>
          </>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            className="px-5 py-2.5 rounded-2xl text-sm font-semibold text-gray-700 
            hover:bg-gray-100 transition"
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            className="px-6 py-2.5 rounded-2xl bg-blue-600 text-white text-sm font-semibold 
            hover:bg-blue-700 disabled:bg-blue-300 transition"
            onClick={handleCreate}
            disabled={activeTab === "Form" ? !formName.trim() : !folderName.trim()}
          >
            Create
          </button>
        </div>

      </div>
    </div>
  );
}
