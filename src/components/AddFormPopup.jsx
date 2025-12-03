import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useState } from "react";
import { db } from "../firebase";
import { generateFormId } from "../utils/generateFormId";
import { getFormUrl } from "../utils/getFormUrl";

export default function AddFormPopup({ onClose, onSelectForm }) {
  const [formName, setFormName] = useState("");

  const handleCreate = async () => {
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

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center px-4 z-[100]">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-xl p-8 space-y-6 animate-fadeIn">

        {/* Header */}
        <h2 className="text-2xl font-semibold text-gray-900">Create a new Form</h2>

        {/* Description */}
        <p className="text-sm text-gray-600">
          Enter a form endpoint name. A unique form URL will be generated automatically.
        </p>

        {/* Form Input */}
        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-800">
            Form Endpoint Name
          </label>
          <input
            type="text"
            className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm text-gray-800 
            placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="e.g. contact-form"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />
        </div>

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
            disabled={!formName.trim()}
          >
            Create
          </button>
        </div>

      </div>
    </div>
  );
}
