import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, query, onSnapshot, orderBy } from "firebase/firestore";

export default function FormDetails({ form }) {
  const [submissions, setSubmissions] = useState([]);

  useEffect(() => {
    if (!form) return;

    console.log("FormDetails: Loading submissions for formId:", form.formId);
    const ref = collection(db, `forms/${form.formId}/submissions`);
    
    let q;
    try {
      q = query(ref, orderBy("submittedAt", "desc"));
    } catch (error) {
      console.warn("Could not order by submittedAt, using default order:", error);
      q = query(ref);
    }

    const unsub = onSnapshot(
      q,
      (snap) => {
        console.log(`FormDetails: Received ${snap.docs.length} submissions`);
        const list = snap.docs.map((doc) => {
          const data = doc.data();
          console.log("Submission data:", { id: doc.id, data });
          return {
            id: doc.id,
            ...data,
            submittedAt: data.submittedAt?.toDate()?.toLocaleString() || data.submittedAt || "N/A",
          };
        });
        setSubmissions(list);
      },
      (error) => {
        console.error("FormDetails: Error fetching submissions:", error);
        setSubmissions([]);
      }
    );

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
        <h2 className="text-xl font-semibold mb-4">
          Submissions {submissions.length > 0 && <span className="text-sm font-normal text-gray-500">({submissions.length})</span>}
        </h2>

        {submissions.length === 0 ? (
          <div>
            <p className="text-gray-600">No submissions yet...</p>
            <p className="text-sm text-gray-500 mt-2">
              Submit a form using the endpoint above to see data here.
            </p>
          </div>
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