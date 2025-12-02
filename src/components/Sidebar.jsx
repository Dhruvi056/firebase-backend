import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../firebase";
import AddFormPopup from "./AddFormPopup.jsx";

export default function Sidebar({ onSelectForm, selectedForm }) {
  const [showPopup, setShowPopup] = useState(false);
  const [forms, setForms] = useState([]);
  const [isAllExpanded, setIsAllExpanded] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "forms"), (snap) => {
      const arr = [];
      snap.forEach((d) => arr.push(d.data()));
      setForms(arr);
    });
    return () => unsub();
  }, []);

  const homeActive = !selectedForm;

  return (
    <aside className="w-[250px] h-full bg-white/90 rounded-3xl border border-gray-200 shadow-sm flex flex-col">
      <div className="px-6 pt-6 pb-4 flex items-center gap-3">
        <p className="text-sm font-semibold text-gray-900">Forms</p>
      </div>

      <div className="px-6">
        <button
          onClick={() => setShowPopup(true)}
          className="w-full text-left text-sm font-semibold text-gray-800 bg-gray-200 hover:bg-gray-300 transition-colors px-4 py-3 rounded-2xl"
        >
          + Create...
        </button>

        <button
          onClick={() => onSelectForm(null)}
          className={`mt-4 w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-colors ${homeActive
            ? "bg-purple-500 text-black shadow"
            : "text-gray-800 hover:bg-gray-200"
            }`}
        >
          <span className={`w-2.5 h-2.5 rounded-full ${homeActive ? "bg-black" : "bg-gray-400"}`}></span>
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
                      ? "bg-gray-900 text-black"
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

      <div className="mt-auto px-6 pb-6 pt-6 space-y-4">
        <div className="flex items-center justify-between pt-1 text-sm text-gray-700">
          <div className="flex items-center gap-3">
            <span>Dhruvi Radadiya</span>
          </div>
        </div>
      </div>

      {showPopup && <AddFormPopup onClose={() => setShowPopup(false)} onSelectForm={onSelectForm} />}
    </aside>
  );
}
