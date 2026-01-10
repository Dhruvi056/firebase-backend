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
  //const [timezone, setTimezone] = useState("");
  const [folders, setFolders] = useState([]);
  const { currentUser } = useAuth();

  // Fetch folders
  useEffect(() => {
    if (!currentUser) return;

    const unsub = onSnapshot(
      query(collection(db, "folders"), where("userId", "==", currentUser.uid)),
      (snap) => {
        const arr = [];
        snap.forEach((doc) => arr.push({ id: doc.id, ...doc.data() }));
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

      if (!selectedFolder) {
        alert("Please select a folder for your form");
        return;
      }

      const id = generateFormId();
      const formUrl = getFormUrl(id);
      
      const newForm = {
        name: formName.trim(),
        formId: id,
        url: formUrl,
        folderId: selectedFolder, // यहाँ folderId document ID के रूप में save हो रहा है
       // timezone: timezone || null,
        userId: currentUser.uid,
        createdAt: serverTimestamp(),
      };

      console.log("Creating form with data:", newForm);
      
      try {
        await setDoc(doc(collection(db, "forms"), id), newForm);
        console.log("Form created successfully");

        if (onSelectForm) {
          onSelectForm({
            name: formName.trim(),
            formId: id,
            url: formUrl,
            folderId: selectedFolder, // यह भी पास करें
          });
        }
      } catch (error) {
        console.error("Error creating form:", error);
        alert("Error creating form: " + error.message);
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
        userId: currentUser.uid,
        createdAt: serverTimestamp(),
      };

      console.log("Creating folder with data:", newFolder);
      
      try {
        await setDoc(doc(collection(db, "folders"), folderId), newFolder);
        console.log("Folder created successfully");
      } catch (error) {
        console.error("Error creating folder:", error);
        alert("Error creating folder: " + error.message);
      }
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
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-2">
                  Folder
                </label>
                <select
                  value={selectedFolder}
                  onChange={(e) => setSelectedFolder(e.target.value)}
                  className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm text-gray-800 
                  focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
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
                  required
                />
              </div>
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
                  required
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
            disabled={activeTab === "Form" ? !formName.trim() || !selectedFolder : !folderName.trim()}
          >
            Create
          </button>
        </div>

      </div>
    </div>
  );
}