import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";

export default function FormDetails({ form }) {
  const [submissions, setSubmissions] = useState([]);

  if (!form) {
    return (
      <section className="flex-1 h-full bg-white border border-gray-200 rounded-3xl shadow-sm flex flex-col items-center justify-center px-16 text-center">
        <div className="h-px w-16 bg-gray-200 mb-8"></div>

        <h1 className="text-4xl font-semibold text-gray-900 mb-4">
           Your <span className="text-blue-600">&lt;/form&gt;</span> connected
        </h1>

        <p className="text-gray-600 max-w-xl mb-6">
          Connect your form with popular applications.
        </p>
      </section>
    );
  }

  // Get all unique field names from submissions
  const allFields = new Set();
  submissions.forEach((sub) => {
    if (sub.data) {
      Object.keys(sub.data).forEach((key) => allFields.add(key));
    }
  });
  const fieldColumns = Array.from(allFields).filter((f) => f !== "_gotcha");

  return (
    <section className="flex-1 h-full bg-white border border-gray-200 rounded-3xl shadow-sm flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-10 py-6 z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm text-gray-500 mb-1">
                Home / <span className="text-gray-900">{form.name}</span>
              </div>
              <h1 className="text-2xl font-semibold text-gray-900">{form.name}</h1>
            </div>
          </div>
          <div className="mb-4">
            <p className="text-sm uppercase tracking-wide text-gray-500 mb-1">Form URL</p>
            <a href={form.url} target="_blank" className="text-purple-600 text-lg font-medium break-all">
              {form.url}
            </a>
          </div>
        </div>

        <div className="px-10 py-6">
          {/* Submissions Table */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Submissions</h2>
              <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium">
                Hide fields
              </button>
            </div>

            {submissions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>Waiting for first submission...</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <input type="checkbox" className="rounded border-gray-300" />
                      </th>
                      {fieldColumns.map((field) => (
                        <th
                          key={field}
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          {field}
                        </th>
                      ))}
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {submissions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <input type="checkbox" className="rounded border-gray-300" />
                        </td>
                        {fieldColumns.map((field) => (
                          <td key={field} className="px-4 py-3 text-sm text-gray-900">
                            {String(sub.data?.[field] || "-").length > 30 
                              ? `${String(sub.data?.[field]).substring(0, 30)}...` 
                              : (sub.data?.[field] || "-")}
                          </td>
                        ))}
                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                          {sub.submittedAt}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
