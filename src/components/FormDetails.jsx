// src/components/FormDetails.jsx
import { useState, useEffect } from "react";
import { db } from "../firebase.js";
import { collection, query, onSnapshot, orderBy } from "firebase/firestore";

export default function FormDetails({ form }) {
  const [submissions, setSubmissions] = useState([]);

  useEffect(() => {
    if (!form) return;

    const ref = collection(db, `forms/${form.formId}/submissions`);
    const q = query(ref, orderBy("submittedAt", "desc"));

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        submittedAt: doc.data().submittedAt?.toDate()?.toLocaleString() || "N/A",
      }));
      setSubmissions(list);
    });

    return () => unsub();
  }, [form]);

  if (!form) {
    return (
      <section className="flex-1 h-full flex items-center justify-center">
        <h1>Select a form</h1>
      </section>
    );
  }

  const allFields = new Set();
  submissions.forEach((s) => {
    Object.keys(s.data || {}).forEach((f) => allFields.add(f));
  });

  const fields = Array.from(allFields).filter((f) => f !== "_gotcha");

  return (
    <section className="flex-1 h-full bg-white rounded-xl border overflow-hidden">
      <div className="p-6 border-b">
        <h1 className="text-2xl font-semibold">{form.name}</h1>
        <p className="mt-2 text-blue-600">{form.url}</p>
      </div>

      <div className="p-6">
        <h2 className="text-xl font-semibold mb-4">Submissions</h2>

        {submissions.length === 0 ? (
          <p>No submissions yet...</p>
        ) : (
          <div className="overflow-auto border rounded-lg">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  {fields.map((f) => (
                    <th key={f} className="px-4 py-2 text-left text-sm font-semibold text-gray-700">{f}</th>
                  ))}
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Date</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((sub) => (
                  <tr key={sub.id} className="border-t hover:bg-gray-50">
                    {fields.map((f) => {
                      const value = sub.data?.[f];
                      // Handle arrays, objects, and other types
                      let displayValue = "-";
                      if (value !== undefined && value !== null && value !== "") {
                        if (Array.isArray(value)) {
                          displayValue = value.join(", ");
                        } else if (typeof value === "object") {
                          displayValue = JSON.stringify(value);
                        } else {
                          displayValue = String(value);
                        }
                      }
                      return (
                        <td key={f} className="px-4 py-2 text-sm">{displayValue}</td>
                      );
                    })}
                    <td className="px-4 py-2 text-gray-500 text-sm">{sub.submittedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
