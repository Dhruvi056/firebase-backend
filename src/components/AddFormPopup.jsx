import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useState } from "react";
import { db } from "../firebase";
import { generateFormId } from "../utils/generateFormId";
import { getFormUrl } from "../utils/getFormUrl";

export default function AddFormPopup({ onClose, onSelectForm }) {
  const [activeTab, setActiveTab] = useState("Form");
  const [formName, setFormName] = useState("");
  const [folderName, setFolderName] = useState("");

  const handleCreate = async () => {
    if (activeTab === "Form") {
      if (!formName.trim()) {
        alert("Please enter a form name");
        return;
      }
      const id = generateFormId();
      const formUrl = getFormUrl(id);
      const newForm = {
        name: formName.trim(),
        formId: id,
        url: formUrl,
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
      if (!folderName.trim()) {
        alert("Please enter a folder name");
        return;
      }
      const id = generateFormId();
      await setDoc(doc(collection(db, "folders"), id), {
        name: folderName.trim(),
        folderId: id,
        createdAt: serverTimestamp(),
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center px-4">
      <div className="bg-white w-full max-w-[480px] rounded-3xl shadow-2xl p-8 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-gray-900">Create...</h2>
        </div>

        <div className="bg-gray-100 rounded-2xl p-1 flex gap-1 text-sm font-semibold">
          {["Form"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-2xl transition-colors ${
                activeTab === tab
                  ? "bg-white shadow text-gray-900"
                  : "text-gray-500"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <p className="text-sm text-gray-600">
          {activeTab === "Form"
            ? "Add a descriptive name to create your form endpoint."
            : null}
        </p>

        {activeTab === "Form" ? (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">
              <span className="mb-1 inline-block">
                Form Endpoint Name 
              </span>
              <input
                type="text"
                className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Form Endpoint Name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </label>
          </div>
        ) : (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">
              {/* <span className="mb-1 inline-block">Folder Name</span> */}
              {/* <input
                type="text"
                className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Folder Name (e.g. job-application)"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
              /> */}
            </label>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            className="px-5 py-2.5 rounded-2xl text-sm font-semibold text-gray-700 hover:bg-gray-100"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-6 py-2.5 rounded-2xl bg-blue-600 text-black text-sm font-semibold hover:bg-blue-700 disabled:bg-blue-300"
            onClick={handleCreate}
            disabled={
              activeTab === "Form" ? !formName.trim() : !folderName.trim()
            }
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}


